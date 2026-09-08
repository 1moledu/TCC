from neo4j import GraphDatabase
import rdflib
from rdflib.namespace import RDF
import re

URI_NEO4J = "neo4j://127.0.0.1:7687"
USER_NEO4J = "neo4j"
PASS_NEO4J = "eduardo1989"  
#FICHEIRO_TTL = "api/registros.ttl" 

PREFIXO_BASE = "https://github.com/peteco-utfpr/grupos-pet/"

def extrair_nome(uri):
    """Remove o prefixo da URI para deixar apenas o nome limpo no Neo4j."""
    nome = str(uri).replace(PREFIXO_BASE, "")
    # Substitui caracteres codificados de URL (ex: %20) por espaços
    from urllib.parse import unquote
    return unquote(nome)

def importar_para_neo4j(caminho_ttl):
    g = rdflib.Graph()
    g.parse(caminho_ttl, format="turtle")
    
    driver = GraphDatabase.driver(URI_NEO4J, auth=(USER_NEO4J, PASS_NEO4J))

    with driver.session() as session:
        # 1: Criar Nós e as suas Classes (Labels)
        for sujeito, predicado, objeto in g:
            sujeito_nome = extrair_nome(sujeito)
            
            if predicado == RDF.type:
                classe_nome = extrair_nome(objeto)
                # Cria o nó e COLOCA A ETIQUETA (Label) nele
                query = f"""
                MERGE (n {{uri: $uri}})
                SET n:{classe_nome}
                """
                session.run(query, uri=str(sujeito))

        # 2: Adicionar Propriedades (Textos, Datas, etc.)
        for sujeito, predicado, objeto in g:
            # Se o objeto for um Literal (texto ou número), é uma propriedade do nó
            if isinstance(objeto, rdflib.term.Literal):
                sujeito_nome = extrair_nome(sujeito)
                propriedade_nome = extrair_nome(predicado)
                
                # Usamos apenas a query nativa do Neo4j
                query_nativa = f"""
                MATCH (n {{uri: $uri}})
                SET n.`{propriedade_nome}` = $valor
                """
                session.run(query_nativa, uri=str(sujeito), valor=str(objeto))

        # 3: Criar Relacionamentos
        for sujeito, predicado, objeto in g:
            # Se o objeto for uma URI e não for do tipo 'rdf:type', é um relacionamento
            if isinstance(objeto, rdflib.term.URIRef) and predicado != RDF.type:
                sujeito_nome = extrair_nome(sujeito)
                objeto_nome = extrair_nome(objeto)
                relacionamento_nome = extrair_nome(predicado)
                
                query = f"""
                MATCH (a {{uri: $uri_a}})
                MATCH (b {{uri: $uri_b}})
                MERGE (a)-[r:`{relacionamento_nome}`]->(b)
                """
                session.run(query, uri_a=str(sujeito), uri_b=str(objeto))

    driver.close()
    print("Ingestão concluída com sucesso!")

if __name__ == "__main__":
    importar_para_neo4j()