import requests
from bs4 import BeautifulSoup
import ollama
import json
import csv
import os

# ==========================================
# 1. EXTRAÇÃO DA URL 
# ==========================================

url = "https://utfpr.curitiba.br/peteco/2013/11/22/mini-curso-de-arduino/"

print(f"1. Acessando a página: {url}...")
resposta = requests.get(url)

if resposta.status_code == 200:
    soup = BeautifulSoup(resposta.text, 'html.parser')
    
    # Extrai o texto limpo da página
    texto_bruto = soup.get_text(separator=' ', strip=True)
    
    texto_para_ia = texto_bruto[:50000]
    print("   -> HTML limpo com sucesso!")
else:
    print(f"Erro ao acessar a URL. Código de status: {resposta.status_code}")
    exit()

# ==========================================
# 2. TRANSFORMAÇÃO COM IA (LLAMA 3.1)
# ==========================================

print("2. Enviando o texto para o Llama 3.1 estruturar na planilha...")


prompt_sistema = """
Você é um agente especializado em extração de dados e Web Semântica.
Sua única tarefa é ler o texto fornecido e retornar ESTRITAMENTE um único objeto JSON válido.

REGRAS GERAIS DE FORMATAÇÃO:
1. A sua resposta deve começar OBRIGATORIAMENTE com o caractere `{` e terminar com `}`.
2. NÃO utilize blocos de código Markdown (como ```json).
3. NÃO inclua saudações, notas ou explicações antes ou depois do JSON.
4. Se a informação não estiver presente no texto e não puder ser logicamente deduzida, retorne uma string vazia "".

REGRAS DE PREENCHIMENTO:
- "nome_grupo": Nome do grupo (ex: PETECO).
- "tipo_grupo": Estritamente "Curso" ou "Multidisciplinar".
- "universidade": Nome completo ou sigla da instituição (ex: UTFPR).
- "estado": Estado brasileiro por extenso (ex: Paraná).
- "cidade": Nome da cidade.
- "campos": Nome do campus da universidade.
- "titulo_atividade": Título oficial e limpo da atividade (remova chamadas de marketing como "Inscreva-se", "Venha participar").
- "tipo_atividade": Estritamente "Ensino", "Pesquisa" ou "Extensão".
- "area": Estritamente UMA destas opções exatas: ComputerScience, Engineering, Mathematics, Physics, Chemistry, Biology, Medicine, Education, Economics, Architecture, Law, Agriculture, EnvironmentalScience, Psychology, Linguistics, Arts, Sociology.
- "data_inicio": Formato exato DD-MM-AAAA. Considere que o ano atual é 2026 para inferir datas incompletas.
- "data_fim": Formato exato DD-MM-AAAA. Se for um evento de um único dia, repita a data_inicio. Assuma 2026 se não houver ano.
- "descricao": Resumo objetivo de no máximo duas frases.

ESTRUTURA DO JSON ESPERADO:
{
  "nome_grupo": "",
  "tipo_grupo": "",
  "universidade": "",
  "estado": "",
  "cidade": "",
  "campos": "",
  "titulo_atividade": "",
  "tipo_atividade": "",
  "area": "",
  "data_inicio": "",
  "data_fim": "",
  "descricao": ""
}
"""

resposta_ia = ollama.chat(
    model='llama3.1:8b', 
    messages=[
        {'role': 'system', 'content': prompt_sistema},
        {'role': 'user', 'content': f"Texto do blog para extrair: '{texto_para_ia}'"}
    ]
)

# ==========================================
# 3. SALVANDO NA PLANILHA
# ==========================================

nome_arquivo_csv = "planilhas_pet/planilha_tcc_pet.csv"
colunas = [
    "nome_grupo", "tipo_grupo", "universidade", "estado", "cidade", 
    "campos", "titulo_atividade", "tipo_atividade", "area", 
    "data_inicio", "data_fim", "uri", "descricao"
]

print("3. Processando a resposta e salvando no CSV...")

try:
    # Transforma o texto do Llama em um Dicionário Python
    dados = json.loads(resposta_ia['message']['content'])
    
    if dados.get("titulo_atividade"):
        dados["uri"] = url
    
    # Verifica se a planilha já existe na pasta
    arquivo_existe = os.path.isfile(nome_arquivo_csv)
    
    # Abre o arquivo para adicionar a nova linha (mode='a' é Append)
    with open(nome_arquivo_csv, mode='w', newline='', encoding='utf-8') as arquivo:
        # Usamos ponto e vírgula (;) porque o Excel em português lê isso direto como coluna separada
        writer = csv.DictWriter(arquivo, fieldnames=colunas, delimiter=';')
        
        # Se for um arquivo novo, cria o cabeçalho primeiro
        
        writer.writeheader()
            
        writer.writerow(dados)
        
    print(f"\nSUCESSO! Linha adicionada com perfeição no arquivo '{nome_arquivo_csv}'.")
    print("\n--- Veja exatamente o que foi salvo na sua planilha ---")
    for chave, valor in dados.items():
        print(f"{chave.ljust(18)}: {valor}")

except Exception as e:
    print(f"\nErro ao converter o JSON da IA ou salvar o CSV: {e}")
    print("Conteúdo cru que o Llama respondeu:")
    print(resposta_ia['message']['content'])