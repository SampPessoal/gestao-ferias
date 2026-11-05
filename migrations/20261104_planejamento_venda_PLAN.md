# Plano de aplicação — venda de 10 dias em cada planejamento de férias

## Escopo

Na ficha de férias, cada planejamento (1, 2 e 3) ganha a opção "Venda de 10 dias".

- Adiciona `public.colaboradores."planejamento1Venda"`, `"planejamento2Venda"` e `"planejamento3Venda"`:
  `boolean NOT NULL DEFAULT false` (todos os colaboradores começam com "Não").
- Não altera dados existentes, privilégios nem proprietários.
- A checagem de inicialização (`server/databaseSchema.ts`) passa a exigir essas colunas:
  **sem a migração aplicada, esta versão não inicia**.

## Ordem obrigatória

1. Confirmar backup recuperável e restauração ensaiada em homologação; checar o catálogo somente em leitura. Antes: zero colunas, ou as três já compatíveis.
2. Migração (transação única, `lock_timeout=15s`, recusa papel sem administração da tabela).
3. Checagem de novo — depois: 3 linhas `boolean | t | false`.
4. Só então publicar a versão.

```sh
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda_check.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261104_planejamento_venda_check.sql
```

A migração recusa estruturas parciais e tipo, nullabilidade ou default incompatíveis.
Com zero colunas cria as três em uma transação; com as três corretas não altera nada.
O bloqueio da tabela mantém validação e DDL atômicos. Não corrige dados nem converte colunas existentes.
A pré-checagem da aplicação também exige NOT NULL e DEFAULT false para as três colunas.
Com DEFAULT constante, o PostgreSQL adiciona as colunas sem reescrever a tabela.
