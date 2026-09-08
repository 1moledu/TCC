import os
from neo4j import GraphDatabase, READ_ACCESS

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "eduardo1989") # Ajustado com a sua senha

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

_schema_cache = None

# Filtros para esconder a sujeira do RDF/Ontotext do LLM
IGNORAR_LABELS = {"Resource", "_GraphConfig", "ObjectProperty", "DatatypeProperty", "Class", "FunctionalProperty", "Ontology"}
IGNORAR_RELS = {"range", "inverseOf", "domain", "subClassOf", "versionIRI", "subPropertyOf"}

def get_schema_description(force_refresh: bool = False) -> str:
    global _schema_cache
    if _schema_cache is not None and not force_refresh:
        return _schema_cache

    with driver.session(default_access_mode=READ_ACCESS) as session:
        # Puxa as labels, mas ignora as estruturais do RDF
        labels = [r["label"] for r in session.run("CALL db.labels() YIELD label RETURN label") if r["label"] not in IGNORAR_LABELS]
        
        # Puxa relações, ignorando as estruturais
        rel_types = [r["relationshipType"] for r in session.run("CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType") if r["relationshipType"] not in IGNORAR_RELS]
        
        # Puxa propriedades, ignorando metadados que começam com underline (_)
        prop_keys = [r["propertyKey"] for r in session.run("CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey") if not r["propertyKey"].startswith("_")]

        amostras = {}
        for label in labels:
            registro = session.run(f"MATCH (n:`{label}`) RETURN n LIMIT 1").single()
            if registro:
                amostras[label] = dict(registro["n"])

    descricao = "Rótulos de nós: " + ", ".join(labels) + "\n"
    descricao += "Tipos de relacionamento: " + ", ".join(rel_types) + "\n"
    descricao += "Propriedades existentes: " + ", ".join(prop_keys) + "\n\n"
    descricao += "Exemplo de nó por rótulo:\n"
    for label, exemplo in amostras.items():
        descricao += f"  ({label}): {exemplo}\n"

    _schema_cache = descricao
    return descricao


def close_driver():
    driver.close()