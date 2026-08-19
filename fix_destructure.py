#!/usr/bin/env python3
import re

with open("client/src/pages/MovimentacaoMes.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix: the destructuring only has { mes, ano, empresa } but onDataLoad is in the type
# We need to add onDataLoad to the destructuring parameter
old = '{ mes, ano, empresa }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }'
new = '{ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }'

count = content.count(old)
content = content.replace(old, new)
print(f"Fixed {count} destructurings")

with open("client/src/pages/MovimentacaoMes.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
