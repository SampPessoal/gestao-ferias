import re

with open("server/routers.ts", "r") as f:
    content = f.read()

# Substituir busca: z.string().optional() por busca: z.string().max(200).trim().optional()
# Mas não substituir se já tiver .max(
pattern = r'(busca:\s*z\.string\(\))(?!\.max)(.optional\(\))'
replacement = r'\1.max(200).trim()\2'

new_content = re.sub(pattern, replacement, content)

count = content.count('busca: z.string().optional()') + content.count('busca: z.string().optional()')
replaced = content.count('busca: z.string().optional()')

with open("server/routers.ts", "w") as f:
    f.write(new_content)

print(f"Substituições feitas: {content.count('busca: z.string().optional()')} → verificar")
print("Done!")
