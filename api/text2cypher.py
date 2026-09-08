import re
import requests
from neo4j import READ_ACCESS
from neo4j_connection import driver, get_schema_description

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.1:8b"

# Se aparecer qualquer uma dessas palavras na consulta gerada, ela é rejeitada
PALAVRAS_PROIBIDAS = [
    "CREATE", "MERGE", "DELETE", "SET ", "REMOVE",
    "DROP", "LOAD CSV", "APOC.PERIODIC", "DBMS.",
]

# TODO: troque os nomes de label/relação (Grupo, Atividade, REALIZOU...) pelos
# que realmente existem no seu grafo, depois de conferir o TTL gerado pelo mapping.json
EXEMPLOS_FEW_SHOT = """
Pergunta: Quais PETs realizaram atividades de ensino?
Cypher: MATCH (g:PETgroup)-[:isParticipantOf|hasParticipatingGroup]-(a:TeachingActivity) RETURN DISTINCT g.hasName AS grupo LIMIT 50

Pergunta: Quais são as atividades do PETECO?
Cypher: MATCH (g:PETgroup {hasName: 'PETECO'})-[:isParticipantOf|hasParticipatingGroup]-(a:PETactivity) RETURN a.hasTitle AS atividade, a.hasStartDate AS data_inicio LIMIT 50

Pergunta: Liste todos os campi da universidade UTFPR.
Cypher: MATCH (c:Campus)-[:isCampusOf]-(u:University {hasName: 'UTFPR'}) RETURN c.hasName AS campus LIMIT 50
""".strip()


def _montar_prompt(pergunta: str, filtros: dict | None, schema: str) -> str:
    filtros_texto = ""
    if filtros:
        partes = []
        if filtros.get("regioes"):
            partes.append(f"regiões: {', '.join(filtros['regioes'])}")
        if filtros.get("areas"):
            partes.append(f"áreas: {', '.join(filtros['areas'])}")
        if filtros.get("categorias"):
            partes.append(f"categorias de atividade: {', '.join(filtros['categorias'])}")
        if filtros.get("ano"):
            partes.append(f"ano: {filtros['ano']}")
        if partes:
            filtros_texto = "Filtros adicionais informados pelo usuário: " + "; ".join(partes) + "\n\n"

    return f"""Você traduz perguntas em português para consultas Cypher (Neo4j).

Regras obrigatórias:
- Use APENAS os rótulos, relações e propriedades listados no schema abaixo.
- Gere SOMENTE a consulta Cypher, sem explicações, sem markdown, sem crases.
- Nunca gere CREATE, MERGE, DELETE, SET, REMOVE ou qualquer operação de escrita.
- Sempre inclua um LIMIT razoável (até 100), a menos que seja uma agregação (COUNT, etc).

Schema do grafo:
{schema}

Exemplos:
{EXEMPLOS_FEW_SHOT}

{filtros_texto}Pergunta: {pergunta}
Cypher:"""


def _chamar_ollama(prompt: str) -> str:
    resposta = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"temperature": 0},
        },
        timeout=60,
    )
    resposta.raise_for_status()
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


def _formatar_registro(registro) -> dict:
    resultado = {}
    for chave, valor in registro.items():
        resultado[chave] = dict(valor.items()) if hasattr(valor, "items") else valor
    return resultado


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
                registros = session.run(cypher_gerado)
                dados = [_formatar_registro(r) for r in registros]
            return {"cypher": cypher_gerado, "resultados": dados}
        except Exception as e:
            ultimo_erro = str(e)
            continue

    raise ValueError(
        f"Não foi possível gerar uma consulta válida após {max_tentativas + 1} tentativas. Último erro: {ultimo_erro}"
    )