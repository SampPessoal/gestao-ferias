import openpyxl
from datetime import datetime
import unicodedata
import re

def normalizar(nome):
    """Remove acentos, cedilha, espaços extras e converte para maiúsculo"""
    nome = nome.upper().strip()
    # Remove acentos
    nome = unicodedata.normalize('NFKD', nome)
    nome = ''.join(c for c in nome if not unicodedata.combining(c))
    # Remove caracteres especiais exceto letras e espaços
    nome = re.sub(r'[^A-Z\s]', '', nome)
    # Normaliza espaços
    nome = re.sub(r'\s+', ' ', nome).strip()
    return nome

def similaridade(a, b):
    """Calcula % de palavras em comum entre dois nomes normalizados"""
    palavras_a = set(normalizar(a).split())
    palavras_b = set(normalizar(b).split())
    if not palavras_a or not palavras_b:
        return 0
    intersecao = palavras_a & palavras_b
    uniao = palavras_a | palavras_b
    return len(intersecao) / len(uniao)

# Nomes do banco sem aniversário
sem_aniversario = [
    (119, "ADRIELLE DOS SANTOS NASCIMENTO"),
    (64,  "ANDRE LUIS SILVA DO CARMO"),
    (28,  "BRENO SANTOS DE OLIVEIRA"),
    (78,  "BRUNO NOVAIS DOS SANTOS"),
    (169, "ERE BARBOSA DE FREITAS MATOS"),
    (134, "HUGO CHAGAS DOS SANTOS MIGUEL"),
    (30005, "ISABELLE MARTA BULHOES BRITO DE JESUS"),
    (30003, "JUAN LUIS SOUZA BARBOSA"),
    (180001, "KAYLA DA HORA FALCAO"),
    (180002, "LUCAS KELVIM SILVA CASTRO"),
    (180003, "LUIZ ARTHUR TAVARES DE BARROS"),
    (150001, "LAZARO RAMON DA HORA SANTOS"),
    (150002, "MARCLEY LUIS ANDRADE VIANA"),
    (30004,  "MARCO ANTONIO BARRETO DOS SANTOS"),
    (30001,  "PEDRO VINICIUS TAVARES SANTOS FERREIRA"),
    (74,     "STHEFANY THAIANY SANTOS NOVAES"),
]

# Extrair todos os nomes e datas da planilha
wb = openpyxl.load_workbook('/home/ubuntu/upload/data.xlsx')
ws = wb.active
planilha = []
for row in ws.iter_rows(min_row=3, values_only=True):
    if row[0] and isinstance(row[0], str) and row[1] and isinstance(row[1], datetime):
        planilha.append((row[0].strip(), row[1].strftime('%Y-%m-%d')))
    if row[4] and isinstance(row[4], str) and row[5] and isinstance(row[5], datetime):
        planilha.append((row[4].strip(), row[5].strftime('%Y-%m-%d')))

print(f"Planilha: {len(planilha)} registros")
print(f"Banco sem aniversário: {len(sem_aniversario)} colaboradores\n")

# Para cada colaborador sem aniversário, encontrar o melhor match na planilha
print("=" * 80)
matches_para_sql = []
for id_banco, nome_banco in sem_aniversario:
    melhor_score = 0
    melhor_match = None
    melhor_data = None
    
    for nome_plan, data_plan in planilha:
        score = similaridade(nome_banco, nome_plan)
        if score > melhor_score:
            melhor_score = score
            melhor_match = nome_plan
            melhor_data = data_plan
    
    status = "✓ MATCH" if melhor_score >= 0.5 else "? BAIXA CONFIANÇA" if melhor_score >= 0.3 else "✗ SEM MATCH"
    print(f"[{status} {melhor_score:.0%}] ID:{id_banco}")
    print(f"  Banco:    {nome_banco}")
    print(f"  Planilha: {melhor_match} -> {melhor_data}")
    print()
    
    if melhor_score >= 0.4:
        matches_para_sql.append((id_banco, melhor_data, nome_banco, melhor_match, melhor_score))

print("=" * 80)
print(f"\nSQL para atualizar {len(matches_para_sql)} registros com score >= 40%:")
for id_banco, data, nome_banco, nome_plan, score in matches_para_sql:
    print(f"UPDATE colaboradores SET dataNascimento = '{data}' WHERE id = {id_banco}; -- {nome_banco} -> {nome_plan} ({score:.0%})")
