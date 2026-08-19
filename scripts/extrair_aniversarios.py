import openpyxl
from datetime import datetime

wb = openpyxl.load_workbook('/home/ubuntu/upload/data.xlsx')
ws = wb.active

aniversarios = []

# A planilha tem colunas: A=Nome, B=Data, C=Dia | D=vazio | E=Nome, F=Data, G=Dia
# Linhas de dados começam na linha 3
for row in ws.iter_rows(min_row=3, values_only=True):
    # Coluna esquerda (A, B)
    nome_esq = row[0]
    data_esq = row[1]
    if nome_esq and data_esq and isinstance(data_esq, datetime):
        aniversarios.append((str(nome_esq).strip().upper(), data_esq.strftime('%Y-%m-%d')))
    
    # Coluna direita (E, F)
    nome_dir = row[4]
    data_dir = row[5]
    if nome_dir and data_dir and isinstance(data_dir, datetime):
        aniversarios.append((str(nome_dir).strip().upper(), data_dir.strftime('%Y-%m-%d')))

print(f"Total de aniversários extraídos: {len(aniversarios)}")
for nome, data in aniversarios[:10]:
    print(f"  {nome} -> {data}")

# Gerar SQL de atualização
# O campo de aniversário no banco pode ser 'dataNascimento' ou 'aniversario'
# Vamos verificar o schema primeiro
print("\n--- Gerando SQL ---")
with open('/home/ubuntu/ferias-manager/scripts/atualizar_aniversarios.sql', 'w') as f:
    for nome, data in aniversarios:
        # Normalizar nome para busca (remover acentos não é necessário pois o banco usa utf8mb4)
        sql = f"UPDATE colaboradores SET dataNascimento = '{data}' WHERE UPPER(nome) = '{nome.replace(chr(39), chr(39)+chr(39))}';\n"
        f.write(sql)

print(f"SQL gerado com {len(aniversarios)} registros em /home/ubuntu/ferias-manager/scripts/atualizar_aniversarios.sql")
