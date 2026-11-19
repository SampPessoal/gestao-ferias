-- Migração aditiva: cria public."folgas" (aba Relação de Folgas — só controle, não mexe no VR/VT).
-- Não altera nenhuma tabela existente. Idempotente (IF NOT EXISTS).
-- Executar com o papel proprietário das tabelas (o mesmo das migrações anteriores).

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '1min';

CREATE TABLE IF NOT EXISTS public."folgas" (
  "id" serial PRIMARY KEY,
  "colaboradorId" integer NOT NULL,
  "tipo" varchar(20) NOT NULL,
  "titulo" varchar(100),
  "dataInicio" varchar(10) NOT NULL,
  "dataFim" varchar(10) NOT NULL,
  "dias" integer NOT NULL,
  "motivo" text,
  "registradoPor" varchar(120),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_folgas_colaborador" ON public."folgas" ("colaboradorId");
CREATE INDEX IF NOT EXISTS "idx_folgas_inicio" ON public."folgas" ("dataInicio");

-- Mesmas permissões da tabela planoSaude para o papel da aplicação
DO $grants$
DECLARE r record;
BEGIN
  FOR r IN SELECT grantee, privilege_type FROM information_schema.role_table_grants
            WHERE table_schema = 'public' AND table_name = 'planoSaude' AND grantee <> current_user
  LOOP
    EXECUTE format('GRANT %s ON public."folgas" TO %I', r.privilege_type, r.grantee);
  END LOOP;
  FOR r IN SELECT DISTINCT grantee FROM information_schema.role_usage_grants
            WHERE object_schema = 'public' AND object_name LIKE 'planoSaude_id_seq' AND grantee <> current_user
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public."folgas_id_seq" TO %I', r.grantee);
  END LOOP;
END
$grants$;

COMMIT;
