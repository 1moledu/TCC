


import os
import re


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


if __name__ == "__main__":
    resumo = _ler_ontologia_completa()
    print(resumo)