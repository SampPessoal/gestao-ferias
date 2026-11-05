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
  n integer;
  names text[] := ARRAY['planejamento1Venda', 'planejamento2Venda', 'planejamento3Venda'];
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

  LOCK TABLE public.colaboradores IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO n FROM pg_attribute
   WHERE attrelid='public.colaboradores'::regclass AND attnum>0
     AND NOT attisdropped AND attname=ANY(names);
  IF n NOT IN (0,3) THEN
    RAISE EXCEPTION 'SCHEMA_PARTIAL';
  END IF;
  IF n=3 AND EXISTS (
    SELECT 1 FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.colaboradores'::regclass AND a.attname=ANY(names)
      AND a.attnum>0 AND NOT a.attisdropped
      AND (a.atttypid <> 'boolean'::regtype OR NOT a.attnotnull
        OR coalesce(pg_get_expr(d.adbin,d.adrelid),'') <> 'false')
  ) THEN
    RAISE EXCEPTION 'SCHEMA_INCOMPATIBLE';
  END IF;
  IF n=0 THEN
    ALTER TABLE public.colaboradores
      ADD COLUMN "planejamento1Venda" boolean NOT NULL DEFAULT false,
      ADD COLUMN "planejamento2Venda" boolean NOT NULL DEFAULT false,
      ADD COLUMN "planejamento3Venda" boolean NOT NULL DEFAULT false;
  END IF;
END
$migration_guard$;

COMMIT;
