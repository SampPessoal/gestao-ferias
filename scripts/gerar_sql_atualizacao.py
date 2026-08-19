"""
Gera SQL de UPDATE para atualizar as datas de férias dos colaboradores
com base nos dados extraídos das planilhas Excel.

Regras:
- Só atualiza admissao, periodoAquisitivo, vencimento, dataLimite
- Cruza pelo nome (normalizado: maiúsculas, sem espaços duplos)
- Registros sem nome válido ou sem datas são ignorados
- Gera arquivo SQL para revisão antes de executar
"""
import json
import unicodedata
import re

def normalizar(nome):
    """Remove acentos, maiúsculas, espaços duplos para comparação."""
    if not nome:
        return ""
    nome = str(nome).strip().upper()
    nome = unicodedata.normalize("NFD", nome)
    nome = "".join(c for c in nome if unicodedata.category(c) != "Mn")
    nome = re.sub(r"\s+", " ", nome)
    return nome

# Carrega dados extraídos das planilhas
with open("/home/ubuntu/ferias-manager/scripts/dados_planilhas.json", "r", encoding="utf-8") as f:
    registros = json.load(f)

# Filtra registros válidos (com nome e pelo menos uma data)
validos = []
for r in registros:
    nome = r.get("nome", "").strip()
    # Ignora linhas de totais, cabeçalhos ou sem nome real
    if not nome or len(nome) < 3:
        continue
    if any(x in nome for x in ["QUANTIDADE", "TOTAL", "NOME DO", "COLABORADOR", "SUBTOTAL"]):
        continue
    # Verifica se tem pelo menos uma data válida
    tem_data = any(r.get(k) and len(str(r.get(k, ""))) == 10 
                   for k in ["admissao", "periodoAquisitivo", "vencimento", "dataLimite"])
    if not tem_data:
        continue
    validos.append(r)

print(f"Registros válidos para atualização: {len(validos)}")

# Gera SQL
linhas_sql = []
linhas_sql.append("-- Atualização de datas de férias a partir das planilhas Excel")
linhas_sql.append("-- Gerado automaticamente em 08/07/2026")
linhas_sql.append("-- APENAS admissao, periodoAquisitivo, vencimento, dataLimite são atualizados")
linhas_sql.append("")

nomes_vistos = set()
duplicados = []

for r in validos:
    nome_orig = r["nome"].strip()
    nome_norm = normalizar(nome_orig)
    
    if nome_norm in nomes_vistos:
        duplicados.append(nome_orig)
        continue
    nomes_vistos.add(nome_norm)
    
    sets = []
    if r.get("admissao") and len(str(r["admissao"])) == 10:
        sets.append(f"admissao = '{r['admissao']}'")
    if r.get("periodoAquisitivo") and len(str(r["periodoAquisitivo"])) == 10:
        sets.append(f"periodoAquisitivo = '{r['periodoAquisitivo']}'")
    if r.get("vencimento") and len(str(r["vencimento"])) == 10:
        sets.append(f"vencimento = '{r['vencimento']}'")
    if r.get("dataLimite") and len(str(r["dataLimite"])) == 10:
        sets.append(f"dataLimite = '{r['dataLimite']}'")
    
    if not sets:
        continue
    
    # Escapa aspas simples no nome
    nome_sql = nome_orig.replace("'", "''")
    set_clause = ", ".join(sets)
    linhas_sql.append(f"UPDATE colaboradores SET {set_clause} WHERE UPPER(TRIM(nome)) = '{nome_sql}';")

linhas_sql.append("")
linhas_sql.append(f"-- Total de UPDATEs gerados: {len(nomes_vistos)}")
if duplicados:
    linhas_sql.append(f"-- Nomes duplicados ignorados: {', '.join(duplicados)}")

sql_content = "\n".join(linhas_sql)
with open("/home/ubuntu/ferias-manager/scripts/atualizar_datas.sql", "w", encoding="utf-8") as f:
    f.write(sql_content)

print(f"SQL gerado: {len(nomes_vistos)} UPDATEs")
if duplicados:
    print(f"Duplicados ignorados: {duplicados}")
print("Arquivo: scripts/atualizar_datas.sql")

# Mostra primeiros 20 para revisão
print("\nPrimeiros 20 registros:")
for linha in linhas_sql[4:24]:
    print(linha)
