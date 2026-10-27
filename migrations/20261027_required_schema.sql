-- Correção estrutural mínima confirmada pela pré-checagem de produção em 2026-10-27.
-- EXECUTAR SOMENTE com papel proprietário/administrador e autorização explícita.
-- Não altera dados, privilégios, proprietários, constraints ou outros objetos.

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
     AND c.relname = 'colaboradores'
     AND c.relkind IN ('r', 'p');

  IF table_owner IS NULL THEN
    RAISE EXCEPTION 'Tabela base public.colaboradores não existe';
  END IF;

  SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname = current_user;
  IF NOT is_superuser AND NOT pg_has_role(current_user, table_owner, 'USAGE') THEN
    RAISE EXCEPTION 'O papel % não administra public.colaboradores (proprietário: %)',
      current_user, pg_get_userbyid(table_owner);
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public.colaboradores'::regclass
       AND a.attname = 'cidadeInterior'
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND format_type(a.atttypid, a.atttypmod) <> 'character varying(100)'
  ) THEN
    RAISE EXCEPTION 'public.colaboradores.cidadeInterior existe com tipo incompatível';
  END IF;
END
$migration_guard$;

ALTER TABLE public."colaboradores"
  ADD COLUMN IF NOT EXISTS "cidadeInterior" varchar(100);

COMMIT;
