-- Migração aditiva: nome do dependente nos lançamentos de plano de saúde da
-- Movimentação do Mês. Não altera dados existentes, privilégios nem proprietários.

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
     AND c.relname = 'movimentacaoPlanoSaude'
     AND c.relkind IN ('r', 'p');

  IF table_owner IS NULL THEN
    RAISE EXCEPTION 'Tabela public.movimentacaoPlanoSaude não existe';
  END IF;

  SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname = current_user;
  IF NOT is_superuser AND NOT pg_has_role(current_user, table_owner, 'USAGE') THEN
    RAISE EXCEPTION 'O papel % não administra public.movimentacaoPlanoSaude', current_user;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_attribute a
     WHERE a.attrelid = 'public."movimentacaoPlanoSaude"'::regclass
       AND a.attname = 'nomeDependente'
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND format_type(a.atttypid, a.atttypmod) <> 'character varying(200)'
  ) THEN
    RAISE EXCEPTION 'public.movimentacaoPlanoSaude.nomeDependente existe com tipo incompatível';
  END IF;
END
$migration_guard$;

ALTER TABLE public."movimentacaoPlanoSaude"
  ADD COLUMN IF NOT EXISTS "nomeDependente" varchar(200);

COMMIT;
