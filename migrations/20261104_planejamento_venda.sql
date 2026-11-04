-- Migração aditiva: venda de 10 dias (abono pecuniário) em cada planejamento de férias.
-- Três colunas boolean NOT NULL DEFAULT false em public.colaboradores.
-- Não altera dados existentes, privilégios nem proprietários.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '1min';

DO $migration_guard$
DECLARE
  table_owner oid;
  is_superuser boolean;
  coluna text;
BEGIN
  SELECT c.relowner INTO table_owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'colaboradores' AND c.relkind IN ('r', 'p');
  IF table_owner IS NULL THEN
    RAISE EXCEPTION 'Tabela public.colaboradores não existe';
  END IF;

  SELECT rolsuper INTO is_superuser FROM pg_roles WHERE rolname = current_user;
  IF NOT is_superuser AND NOT pg_has_role(current_user, table_owner, 'USAGE') THEN
    RAISE EXCEPTION 'O papel % não administra public.colaboradores', current_user;
  END IF;

  FOREACH coluna IN ARRAY ARRAY['planejamento1Venda', 'planejamento2Venda', 'planejamento3Venda'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = coluna
         AND a.attnum > 0 AND NOT a.attisdropped
         AND format_type(a.atttypid, a.atttypmod) <> 'boolean'
    ) THEN
      RAISE EXCEPTION 'public.colaboradores.% existe com tipo incompatível', coluna;
    END IF;
  END LOOP;
END
$migration_guard$;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS "planejamento1Venda" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "planejamento2Venda" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "planejamento3Venda" boolean NOT NULL DEFAULT false;

COMMIT;
