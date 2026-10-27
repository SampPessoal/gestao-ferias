-- Migração aditiva para revogação seletiva de sessões por conta.
-- Não revoga contas, não altera senhas e não modifica chaves globais.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '1min';

DO $migration_guard$
DECLARE
  table_owner oid;
  is_superuser boolean;
BEGIN
  SELECT c.relowner
    INTO table_owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'systemUsers'
     AND c.relkind IN ('r', 'p');

  IF table_owner IS NULL THEN
    RAISE EXCEPTION 'Tabela public.systemUsers não existe';
  END IF;

  SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname = current_user;
  IF NOT is_superuser AND NOT pg_has_role(current_user, table_owner, 'USAGE') THEN
    RAISE EXCEPTION 'O papel % não administra public.systemUsers', current_user;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public."systemUsers"'::regclass
       AND a.attname = 'sessionVersion'
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND (
         format_type(a.atttypid, a.atttypmod) <> 'integer'
         OR NOT a.attnotnull
         OR NOT a.atthasdef
         OR COALESCE((
           SELECT pg_get_expr(ad.adbin, ad.adrelid)
             FROM pg_attrdef ad
            WHERE ad.adrelid = a.attrelid
              AND ad.adnum = a.attnum
         ), '') <> '0'
       )
  ) THEN
    RAISE EXCEPTION 'public.systemUsers.sessionVersion existe com definição incompatível';
  END IF;
END
$migration_guard$;

ALTER TABLE public."systemUsers"
  ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0;

COMMIT;
