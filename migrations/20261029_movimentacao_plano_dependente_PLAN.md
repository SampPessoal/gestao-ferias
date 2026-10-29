# Plano de aplicação — nome do dependente na Movimentação do Mês (plano de saúde)

## Escopo

Permite registrar até 3 dependentes de uma vez na Movimentação do Mês → Plano de Saúde.
Cada dependente vira um lançamento próprio, com o nome em `nomeDependente`.

- Adiciona somente `public."movimentacaoPlanoSaude"."nomeDependente" varchar(200)` (nulo permitido).
- Não altera dados existentes, privilégios nem proprietários.
- A checagem de inicialização (`server/databaseSchema.ts`) passa a exigir essa coluna:
  **sem a migração aplicada, esta versão não inicia** (encerra com mensagem de divergência).

## Ordem obrigatória

1. Executar a checagem (somente leitura) — antes: nenhuma linha e `f|f|f`.
2. Executar a migração (transação única, `lock_timeout=15s`, recusa papel sem administração da tabela).
3. Executar a checagem de novo — depois: `nomeDependente | character varying(200)` e `t|t|t`.
4. Só então publicar a versão.

```sh
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261029_movimentacao_plano_dependente_check.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261029_movimentacao_plano_dependente.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261029_movimentacao_plano_dependente_check.sql
```

A migração é idempotente (`ADD COLUMN IF NOT EXISTS`): rodar de novo não tem efeito.

## Testado

Em banco local: checagem antes/depois, migração, segunda execução sem efeito, e a aplicação
recusando iniciar sem a coluna e iniciando normalmente com ela.
