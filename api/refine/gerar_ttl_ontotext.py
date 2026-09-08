import subprocess
import os

REFINE_URL = "http://localhost:7333"
ARQUIVO_CSV = "planilhas_pet/planilha_tcc_pet.csv"
ARQUIVO_JSON = "refine/mapping.json"
ARQUIVO_TTL_SAIDA = "api/registros.ttl"

ONTOREFINE_CLI = r"C:\Users\evert\AppData\Local\Ontotext Refine\app\bin\ontorefine-cli.cmd"

def gerar_ttl(csv_path, mapping_path, saida_path, url=REFINE_URL):
    # 1. cria o projeto
    result = subprocess.run(
        [ONTOREFINE_CLI, "create", csv_path, "-u", url],
        capture_output=True, text=True, check=True
    )
    project_id = result.stdout.strip().split(": ")[-1]
    print(f"Projeto criado: {project_id}")

    try:
        # 2. exporta RDF usando o mapping, direto para o arquivo
        with open(saida_path, "w", encoding="utf-8") as f:
            subprocess.run(
                [ONTOREFINE_CLI, "rdf", project_id,
                 "-m", mapping_path, "-f", "turtle", "-u", url],
                stdout=f, check=True
            )
        print(f"TTL salvo em: {saida_path}")
    finally:
        # 3. sempre limpa o projeto, mesmo se der erro
        subprocess.run([ONTOREFINE_CLI, "delete", project_id, "-u", url], check=True)

if __name__ == "__main__":
    gerar_ttl(ARQUIVO_CSV, ARQUIVO_JSON, ARQUIVO_TTL_SAIDA)