# Relatório de Auditoria de Segurança — GestãoFérias

## Status: EM ANDAMENTO

## Vulnerabilidades Encontradas e Corrigidas

### ✅ Dependências Atualizadas
- `@trpc/server` 11.6.0 → 11.18.0 (Prototype Pollution corrigido)
- `@trpc/client` 11.6.0 → 11.18.0
- `@trpc/react-query` 11.6.0 → 11.18.0
- `vitest` 2.1.4 → 4.1.10 (Arbitrary file read via UI server corrigido)
- `exceljs` instalado como alternativa segura ao xlsx

### ✅ Headers de Segurança (server/_core/index.ts)
- Helmet configurado com CSP, X-Frame-Options: DENY, HSTS, noSniff, XSS filter
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
- X-Permitted-Cross-Domain-Policies: none
- Body parser limit reduzido de 10mb → 2mb (prevenção DoS)

### ✅ Rate Limiting (server/_core/index.ts)
- Rate limit geral: 300 req/min por IP
- Rate limit de login: 30 tentativas/15min com resposta JSON (não HTML)
- Aplicado em /api/trpc/systemUsers.login e /api/oauth

### ✅ Validação de Inputs (server/systemUsersRouter.ts)
- Email: max 254 chars, trim, toLowerCase
- Senha: max 128 chars
- Nome: max 120 chars, trim
- ID: int().positive()
- changePassword: min 8 chars, regex maiúscula + número

### ✅ Autenticação e Autorização
- Todas as rotas de dados usam protectedProcedure ✅
- Rotas admin verificam me.role === "admin" ✅
- JWT com expiração de 7 dias ✅
- httpOnly cookies ✅
- Rotas de scheduled autenticadas via isCron ✅

### ✅ SQL Injection
- Todas as queries usam Drizzle ORM com queries parametrizadas ✅
- Busca por nome usa sql template tag com parâmetros (não concatenação) ✅

### ✅ Exposição de Dados
- Nenhuma credencial hardcoded encontrada ✅
- Logs de banco mascaram senha na URL ✅
- API de /me retorna apenas: id, nome, email, role (não passwordHash) ✅

## Vulnerabilidades Pendentes de Correção

### ⚠️ xlsx (SheetJS) v0.18.5
- Prototype Pollution e ReDoS
- Não há versão mais recente no npm público
- Mitigação: usado apenas para ESCRITA (não parsing de uploads externos)
- Risco: BAIXO (não processa arquivos enviados por usuários)

### ⚠️ Dependências transitivas (não diretas)
- tar, rollup, fast-xml-parser, path-to-regexp, lodash — vulnerabilidades em deps de deps
- Risco: BAIXO a MODERADO (não expostos diretamente ao usuário)

## Verificações Restantes
- [ ] Validação de busca (max chars) nas procedures de lista
- [ ] Verificar se CPF/dados sensíveis são logados em algum lugar
- [ ] Verificar se há IDOR em procedures que recebem IDs
