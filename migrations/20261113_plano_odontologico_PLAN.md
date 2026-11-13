# Migração 20261113 — Plano Odontológico

**O que faz:** cria a tabela nova `public."planoOdontologico"` (e 3 índices), usada pela aba **Plano Odontológico**.
Não altera nenhuma tabela existente. É idempotente (`IF NOT EXISTS`).

**Ordem segura:** pode ser aplicada **antes ou depois** de publicar o código.
- Sem a migração, o sistema sobe normalmente (a tabela **não** está na pré-checagem obrigatória);
  só a aba Plano Odontológico mostra o aviso "tabela ainda não criada".
- Depois de aplicar, a aba passa a funcionar sem novo deploy.

**Como aplicar (papel proprietário, igual às migrações anteriores):**
```
psql "$DATABASE_URL_OWNER" -f migrations/20261113_plano_odontologico.sql
psql "$DATABASE_URL_OWNER" -f migrations/20261113_plano_odontologico_check.sql
```

**Reverter (se necessário):** `DROP TABLE public."planoOdontologico";` (só apaga os dados do plano odontológico).
