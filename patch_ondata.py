#!/usr/bin/env python3
with open("client/src/pages/MovimentacaoMes.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update all 6 function signatures to add onDataLoad prop
old_sig = '}: { mes: number; ano: number; empresa: string })'
new_sig = '}: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void })'
count = content.count(old_sig)
content = content.replace(old_sig, new_sig)
print(f"Signatures updated: {count}")

# 2. Add useEffect for each aba query
# We need to add "useEffect" to the import at the top first
content = content.replace(
    'import { useState, useMemo } from "react";',
    'import { useState, useMemo, useEffect, useRef } from "react";',
    1
)
print("Import updated")

# 3. For each aba, add useEffect after the useQuery line
abas_queries = [
    'trpc.movimentacao.seguroVida.list.useQuery({ empresa: empresa || undefined, mes, ano });',
    'trpc.movimentacao.auxNotebook.list.useQuery({ empresa: empresa || undefined, mes, ano });',
    'trpc.movimentacao.planoSaude.list.useQuery({ empresa: empresa || undefined, mes, ano });',
    'trpc.movimentacao.valeTransporte.list.useQuery({ empresa: empresa || undefined, mes, ano });',
    'trpc.movimentacao.auxCreche.list.useQuery({ empresa: empresa || undefined, mes, ano });',
    'trpc.movimentacao.bonusIndicacao.list.useQuery({ empresa: empresa || undefined, mes, ano });',
]

effect_code = '''
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);'''

for q in abas_queries:
    old = f'  const {{ data, isLoading }} = {q}'
    new = f'  const {{ data, isLoading }} = {q}{effect_code}'
    if old in content:
        content = content.replace(old, new, 1)
        print(f"Added useEffect for: {q[:50]}...")
    else:
        print(f"WARNING: not found: {q[:50]}...")

with open("client/src/pages/MovimentacaoMes.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
