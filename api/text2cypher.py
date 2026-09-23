import re
import os
import requests
from neo4j import READ_ACCESS
from neo4j.graph import Node, Relationship, Path
from neo4j_connection import driver, get_schema_description

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.1:8b"

PALAVRAS_PROIBIDAS = [
    "CREATE", "MERGE", "DELETE", "SET ", "REMOVE",
    "DROP", "LOAD CSV", "APOC.PERIODIC", "DBMS.",
]

EXEMPLOS_FEW_SHOT = """
Pergunta: Quais PETs realizaram atividades de ensino?
Cypher: MATCH (g:PETgroup)-[r:isParticipantOf|hasParticipatingGroup]-(a:TeachingActivity) RETURN DISTINCT g, r, a LIMIT 50

Pergunta: Quais são os grupos PET da universidade UFPR?
Cypher: MATCH (g:PETgroup)-[r:isPETgroupOf|hasPETgroup]-(u:University {hasName: 'UFPR'}) RETURN g, r, u LIMIT 50

Pergunta: Traga apenas 5 universidades presentes no sistema
Cypher: MATCH (u:University) RETURN u LIMIT 5

Pergunta: Quais são as atividades do PETECO?
Cypher: MATCH (g:PETgroup {hasName: 'PETECO'})-[r:isParticipantOf|hasParticipatingGroup]-(a:PETactivity) RETURN g, r, a LIMIT 50

Pergunta: Existem atividades feitas pelo PETECO que não são de pesquisa?
Cypher: MATCH (g:PETgroup {hasName: 'PETECO'})-[r:isParticipantOf|hasParticipatingGroup]-(a:PETactivity) WHERE NOT a:ResearchActivity RETURN DISTINCT g, r, a LIMIT 50
""".strip()


def _ler_ontologia_completa() -> str:
    """Lê o arquivo TTL e mapeia toda a hierarquia, relacionamentos e traduções."""
    # Sobe uma pasta (..) e entra na pasta ontologias
    caminho_ttl = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ontologias", "grupos-pet-setembro.ttl"))
    
    try:
        with open(caminho_ttl, "r", encoding="utf-8") as f:
            conteudo = f.read()
    except Exception as e:
        print(f"Erro ao ler TTL: {e}")
        return "Erro ao carregar ontologia."

    # Divide o arquivo sempre que uma linha começar com ":" (ex: ":PETactivity rdf:type owl:Class")
    blocos = re.split(r'\n(?=:)', "\n" + conteudo)
    
    classes = []
    rels = []
    props = []

    for bloco in blocos:
        if not bloco.strip() or not bloco.startswith(':'): 
            continue
        
        # O nome do nó é a primeira palavra sem o ":"
        nome = bloco.split()[0][1:] 
        
        # Pega todas as strings marcadas com @pt-br neste bloco (nomes e comentários)
        pt_strings = re.findall(r'"([^"]+)"@pt-br', bloco)
        descricao = " | ".join(set(pt_strings)) if pt_strings else nome
        
        # Se for uma CLASSE (Nó)
        if "owl:Class" in bloco:
            subclass = re.search(r'rdfs:subClassOf\s+:(\w+)', bloco)
            hierarquia = f" (Subclasse de :{subclass.group(1)})" if subclass else ""
            classes.append(f"- Nó :{nome}{hierarquia} -> Tradução/Contexto: {descricao}")
            
        # Se for um RELACIONAMENTO (Aresta)
        elif "owl:ObjectProperty" in bloco:
            domain = re.search(r'rdfs:domain\s+:(\w+)', bloco)
            range_ = re.search(r'rdfs:range\s+:(\w+)', bloco)
            d_str = f":{domain.group(1)}" if domain else "Qualquer"
            r_str = f":{range_.group(1)}" if range_ else "Qualquer"
            rels.append(f"- [:{nome}] conecta ({d_str}) a ({r_str}) -> Contexto: {descricao}")
            
        # Se for uma PROPRIEDADE (Dado)
        elif "owl:DatatypeProperty" in bloco:
            props.append(f"- Atributo '{nome}' -> Contexto: {descricao}")

    resumo = "=== MAPEAMENTO SEMÂNTICO DA ONTOLOGIA ===\n"
    resumo += "1. CLASSES (NÓS) DO BANCO:\n" + "\n".join(classes) + "\n\n"
    resumo += "2. RELACIONAMENTOS PERMITIDOS:\n" + "\n".join(rels) + "\n\n"
    resumo += "3. ATRIBUTOS:\n" + "\n".join(props)
    
    return resumo


def _montar_prompt(pergunta: str, filtros: dict | None, schema: str) -> str:
    ontologia = _ler_ontologia_completa()

    return f"""Você é um especialista em Neo4j traduzindo perguntas em português para consultas Cypher.

Regras obrigatórias:
- Use APENAS os rótulos, relações e propriedades listados na ontologia e no schema abaixo.
- Gere SOMENTE a consulta Cypher, sem explicações, sem markdown, sem crases.
- Nunca gere CREATE, MERGE, DELETE, SET, REMOVE ou qualquer operação de escrita.
- Regra: se o usuário solicitar explicitamente uma quantidade de resultados, como "os 10 primeiros", "5 registros" ou "liste 20 itens", essa quantidade deve ser interpretada como o valor do LIMIT.
- Prefira retornar os nós e relacionamentos completos (ex: RETURN g, r, a).
- PARADOXOS PROIBIDOS: Se a pergunta tiver uma negação de tipo (ex: "não são de extensão"), faça o MATCH SEMPRE na classe geral (ex: a:PETactivity) e coloque a restrição apenas no WHERE (ex: WHERE NOT a:CommunityActivity). Nunca repita a mesma classe no MATCH e no WHERE NOT.
- Se a pergunta pedir apenas UMA entidade solta (ex: apenas atividades), retorne APENAS o nó (ex: RETURN a).
- Sempre inclua um LIMIT razoável (até 100).

{ontologia}

--- SCHEMA FÍSICO DO BANCO DE DADOS ---
{schema}

--- EXEMPLOS DE TRADUÇÃO ---
{EXEMPLOS_FEW_SHOT}

Pergunta: {pergunta}
Cypher:"""


def _chamar_ollama(prompt: str) -> str:
    resposta = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "keep_alive": "20m",
            "options": {
                "temperature": 0,
                "num_predict": 150, 
                "num_ctx": 4096,
                "num_thread": 6     
            },
        },
        timeout=60,
    )
    if not resposta.ok:
        raise RuntimeError(f"Erro do Ollama ({resposta.status_code}): {resposta.text}")
    return resposta.json()["message"]["content"]


def _extrair_cypher(texto_llm: str) -> str:
    texto = re.sub(r"```(?:cypher)?", "", texto_llm, flags=re.IGNORECASE)
    return texto.strip("` \n")


def _validar_cypher(query: str) -> None:
    if not query:
        raise ValueError("O modelo não gerou nenhuma consulta.")
    upper = query.upper()
    for palavra in PALAVRAS_PROIBIDAS:
        if palavra in upper:
            raise ValueError(f"Consulta rejeitada por segurança: contém operação não permitida ({palavra.strip()}).")


def _legenda(no: Node) -> str:
    props = dict(no.items())
    valor = props.get("hasName") or props.get("hasTitle") or props.get("nome")
    return str(valor) if valor else next(iter(no.labels), "Nó")


def formatar_registro(registro) -> dict:
    resultado = {}
    for chave, valor in registro.items():
        if isinstance(valor, Node):
            resultado[chave] = _legenda(valor)
        elif isinstance(valor, Relationship):
            resultado[chave] = valor.type
        elif isinstance(valor, Path):
            resultado[chave] = " → ".join(_legenda(n) for n in valor.nodes)
        elif hasattr(valor, "items"):
            resultado[chave] = dict(valor.items())
        else:
            resultado[chave] = valor
    return resultado


def extrair_grafo(registros_brutos) -> dict:
    nodes: dict[str, dict] = {}
    rels: dict[str, dict] = {}

    def registrar_no(no: Node):
        if no.element_id not in nodes:
            nodes[no.element_id] = {
                "id": no.element_id,
                "labels": list(no.labels),
                "caption": _legenda(no),
                "properties": dict(no.items()),
            }

    def registrar_rel(rel: Relationship):
        if rel.element_id not in rels:
            registrar_no(rel.start_node)
            registrar_no(rel.end_node)
            rels[rel.element_id] = {
                "id": rel.element_id,
                "from": rel.start_node.element_id,
                "to": rel.end_node.element_id,
                "type": rel.type,
            }

    for registro in registros_brutos:
        for valor in registro.values():
            if isinstance(valor, Node):
                registrar_no(valor)
            elif isinstance(valor, Relationship):
                registrar_rel(valor)
            elif isinstance(valor, Path):
                for no in valor.nodes:
                    registrar_no(no)
                for rel in valor.relationships:
                    registrar_rel(rel)

    return {"nodes": list(nodes.values()), "relationships": list(rels.values())}


def consultar_grafo(pergunta: str, filtros: dict | None = None, max_tentativas: int = 2) -> dict:
    schema = get_schema_description()
    prompt = _montar_prompt(pergunta, filtros, schema)

    ultimo_erro = None
    cypher_gerado = ""

    for tentativa in range(max_tentativas + 1):
        if tentativa > 0:
            prompt += (
                f"\n\nVocê gerou esta consulta, mas ela falhou:\n{cypher_gerado}\n"
                f"Erro do banco: {ultimo_erro}\n"
                "Corrija e gere apenas a nova consulta Cypher:"
            )

        texto_llm = _chamar_ollama(prompt)
        cypher_gerado = _extrair_cypher(texto_llm)

        try:
            _validar_cypher(cypher_gerado)
            with driver.session(default_access_mode=READ_ACCESS) as session:
                registros = list(session.run(cypher_gerado))
                tabela = [formatar_registro(r) for r in registros]
                grafo = extrair_grafo(registros)
            return {"cypher": cypher_gerado, "resultados": tabela, "grafo": grafo}
        except Exception as e:
            ultimo_erro = str(e)
            continue

    raise ValueError(
        f"Não foi possível gerar uma consulta válida após {max_tentativas + 1} tentativas. Último erro: {ultimo_erro}"
    )