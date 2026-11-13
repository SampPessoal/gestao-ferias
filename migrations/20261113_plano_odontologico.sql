-- Migração aditiva: cria public."planoOdontologico" (aba Plano Odontológico / OdontoPrev).
-- Não altera nenhuma tabela existente, dados, privilégios nem proprietários.
-- Idempotente: pode ser executada mais de uma vez (IF NOT EXISTS).
-- Executar com o papel proprietário das tabelas (o mesmo das migrações anteriores).

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '1min';

DO $guard$
BEGIN
  IF to_regtype('public.empresa_enum') IS NULL THEN
    RAISE EXCEPTION 'Tipo public.empresa_enum não existe';
  END IF;
  IF to_regtype('public.tipo_beneficiario_enum') IS NULL THEN
    RAISE EXCEPTION 'Tipo public.tipo_beneficiario_enum não existe';
  END IF;
END
$guard$;

CREATE TABLE IF NOT EXISTS public."planoOdontologico" (
  "id" serial PRIMARY KEY,
  "empresa" public.empresa_enum NOT NULL,
  "numeroOdontoprev" varchar(30) NOT NULL,
  "nome" varchar(200) NOT NULL,
  "cpf" varchar(11),
  "tipo" public.tipo_beneficiario_enum NOT NULL,
  "parentesco" varchar(20) NOT NULL DEFAULT '',
  "titularNumeroOdontoprev" varchar(30),
  "dataInclusao" varchar(10),
  "valor" numeric(10, 2) NOT NULL DEFAULT 0.00,
  "colaboradorId" integer,
  "ativo" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_planoOdonto_empresa" ON public."planoOdontologico" ("empresa");
CREATE INDEX IF NOT EXISTS "idx_planoOdonto_numero" ON public."planoOdontologico" ("numeroOdontoprev");
CREATE INDEX IF NOT EXISTS "idx_planoOdonto_titular" ON public."planoOdontologico" ("titularNumeroOdontoprev");

-- Mesmas permissões da tabela planoSaude para o papel da aplicação
DO $grants$
DECLARE r record;
BEGIN
  FOR r IN SELECT grantee, privilege_type FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND table_name = 'planoSaude' AND grantee <> current_user
  LOOP
    EXECUTE format('GRANT %s ON public."planoOdontologico" TO %I', r.privilege_type, r.grantee);
  END LOOP;
  FOR r IN SELECT DISTINCT grantee FROM information_schema.role_usage_grants
            WHERE object_schema = 'public' AND object_name LIKE 'planoSaude_id_seq' AND grantee <> current_user
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public."planoOdontologico_id_seq" TO %I', r.grantee);
  END LOOP;
END
$grants$;

COMMIT;
