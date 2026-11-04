# Plano de aplicação — venda de 10 dias em cada planejamento de férias

## Escopo

Na ficha de férias, cada planejamento (1, 2 e 3) ganha a opção "Venda de 10 dias".

- Adiciona `public.colaboradores."planejamento1Venda"`, `"planejamento2Venda"` e `"planejamento3Venda"`:
  `boolean NOT NULL DEFAULT false` (todos os colaboradores começam com "Não").
- Não altera dados existentes, privilégios nem proprietários.
- A checagem de inicialização (`server/databaseSchema.ts`) passa a exigir essas colunas:
  **sem a migração aplicada, esta versão não inicia**.

## Ordem obrigatória

1. Checagem (somente leitura) — antes: nenhuma linha.
2. Migração (transação única, `lock_timeout=15s`, recusa papel sem administração da tabela).
3. Checagem de novo — depois: 3 linhas `boolean | t | false`.
4. Só então publicar a versão.

```sh
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda_check.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda_check.sql
```

A migração é idempotente (`ADD COLUMN IF NOT EXISTS`): rodar de novo não tem efeito.
Com DEFAULT constante, o PostgreSQL adiciona as colunas sem reescrever a tabela.
