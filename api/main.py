from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import csv
import os

from refine.gerar_ttl_ontotext import gerar_ttl
from import_ttl_neo4j import importar_para_neo4j
from neo4j_connection import driver
from neo4j import READ_ACCESS
from typing import List, Optional
from text2cypher import consultar_grafo, extrair_grafo, formatar_registro # Garantindo os imports

app = FastAPI(title="API PET Neo4j")

# Configuração de CORS (Permite que o Next.js no localhost:3000 chame a API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define o formato dos dados que o Next.js vai enviar (igual ao formData)
class Atividade(BaseModel):
    nome_grupo: str
    tipo_grupo: str
    universidade: str
    estado: str
    cidade: str
    campos: str
    titulo_atividade: str
    tipo_atividade: str
    area: str
    data_inicio: str
    data_fim: str
    uri: str
    descricao: str

@app.post("/api/cadastrar")
async def cadastrar_atividade(dados: Atividade):
    csv_temp_path = "temp_entrada.csv"
    ttl_temp_path = "temp_saida.ttl"
    mapping_path = "refine/mapping.json" # Caminho do seu JSON de mapeamento
    
    try:
        # 1. Transforma o JSON recebido em um arquivo CSV de 1 linha
        with open(csv_temp_path, mode="w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=dados.dict().keys(), delimiter=";")
            writer.writeheader()
            writer.writerow(dados.dict())

        # 2. Chama o seu script de gerar TTL (Ontotext Refine)
        gerar_ttl(csv_temp_path, mapping_path, ttl_temp_path)
        
        # 3. Chama o seu script de ingestão no Neo4j
        importar_para_neo4j(ttl_temp_path)
        
        return {"status": "sucesso", "mensagem": "Atividade salva com sucesso no Grafo!"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Limpa os arquivos temporários para não sujar o servidor
        if os.path.exists(csv_temp_path):
            os.remove(csv_temp_path)
        if os.path.exists(ttl_temp_path):
            os.remove(ttl_temp_path)


class ConsultaRequest(BaseModel):
    query: str
    filters: dict | None = None

@app.post("/api/buscar")
def buscar(dados: ConsultaRequest):
    try:
        return consultar_grafo(dados.query, dados.filters)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar o grafo: {e}")


class CypherRequest(BaseModel):
    query: str    

class CypherRequest(BaseModel):
    query: str

@app.post("/api/cypher")
def executar_cypher_direto(dados: CypherRequest):
    try:
        with driver.session(default_access_mode=READ_ACCESS) as session:
            registros = list(session.run(dados.query))
            tabela = [formatar_registro(r) for r in registros]
            grafo = extrair_grafo(registros)
        return {"cypher": dados.query, "resultados": tabela, "grafo": grafo}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class FiltrosBuscaGuiada(BaseModel):
    regioes: List[str] = []
    areas: List[str] = []
    categorias: List[str] = []
    ano: Optional[str] = ""
    universidade: Optional[str] = ""

@app.post("/api/buscar-por-filtros")
def buscar_por_filtros(filtros: FiltrosBuscaGuiada):
    try:
        match_clauses = ["MATCH (g:PETgroup)-[r:isParticipantOf|hasParticipatingGroup]-(a:PETactivity)"]
        where_clauses = []

        # Filtro 1: Categoria (Ensino, Pesquisa, Extensão)
        if filtros.categorias:
            labels = []
            if 'Ensino' in filtros.categorias: labels.append("'TeachingActivity'")
            if 'Pesquisa' in filtros.categorias: labels.append("'ResearchActivity'")
            if 'Extensão' in filtros.categorias: labels.append("'CommunityActivity'")
            
            if labels:
                where_clauses.append(f"any(label IN [{', '.join(labels)}] WHERE label IN labels(a))")

        # Filtro 2: Ano
        if filtros.ano:
            ano = filtros.ano.strip()
            where_clauses.append(f"(a.hasStartDate CONTAINS '{ano}' OR a.hasEndDate CONTAINS '{ano}')")

        # Filtro 3: Universidade
        if filtros.universidade:
            universidade = filtros.universidade.strip()
            # Conecta o Grupo à Universidade e traz o nó 'u' para a memória da query
            match_clauses.append("MATCH (g)-[:isPETgroupOf|hasPETgroup]-(u:University)")
            # toLower permite buscar "utfpr", "Utfpr" ou "UTFPR"
            where_clauses.append(f"toLower(u.hasName) CONTAINS toLower('{universidade}')")

        # 3. Montagem final da query Cypher
        cypher_query = " ".join(match_clauses)
        if where_clauses:
            cypher_query += " WHERE " + " AND ".join(where_clauses)
            
        cypher_query += " RETURN DISTINCT g, r, a LIMIT 100"

        # 4. Executa no Neo4j
        with driver.session(default_access_mode=READ_ACCESS) as session:
            registros = list(session.run(cypher_query))
            tabela = [formatar_registro(row) for row in registros]
            grafo = extrair_grafo(registros)

        return {"cypher": cypher_query, "resultados": tabela, "grafo": grafo}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao executar busca guiada: {str(e)}")