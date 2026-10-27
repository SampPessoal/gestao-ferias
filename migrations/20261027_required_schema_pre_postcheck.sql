-- SOMENTE LEITURA. Execute antes e depois de 20261027_required_schema.sql.
-- Não consulta linhas de funcionários; inspeciona apenas o catálogo PostgreSQL.

-- 1) Deve retornar zero linhas após a migração.
WITH expected(table_name, column_name, expected_type) AS (
  VALUES
    ('historicoFerias', 'periodoAquisitivoAnterior', 'date'),
    ('historicoFerias', 'vencimentoAnterior', 'date'),
    ('historicoFerias', 'dataLimiteAnterior', 'date'),
    ('historicoFerias', 'saldoAnterior', 'integer'),
    ('colaboradores', 'raca', 'character varying(40)'),
    ('colaboradores', 'nacionalidadePai', 'character varying(60)'),
    ('colaboradores', 'nacionalidadeMae', 'character varying(60)'),
    ('colaboradores', 'ctpsUf', 'character varying(40)'),
    ('colaboradores', 'cnhNumero', 'character varying(20)'),
    ('colaboradores', 'cnhCategoria', 'character varying(40)'),
    ('colaboradores', 'cnhValidade', 'date'),
    ('colaboradores', 'emailPessoal', 'character varying(200)'),
    ('colaboradores', 'cidadeInterior', 'character varying(100)'),
    ('colaboradores', 'vinculo', 'character varying(40)'),
    ('colaboradores', 'primeiroTrabalho', 'character varying(40)'),
    ('colaboradores', 'contratoExperiencia', 'character varying(40)'),
    ('colaboradores', 'cbo', 'character varying(10)'),
    ('colaboradores', 'remuneracao', 'numeric(12,2)'),
    ('colaboradores', 'jornadaEntrada', 'character varying(40)'),
    ('colaboradores', 'jornadaSaida', 'character varying(40)'),
    ('colaboradores', 'jornadaIntervalo', 'character varying(10)'),
    ('colaboradores', 'supervisorNome', 'character varying(200)'),
    ('colaboradores', 'supervisorCpf', 'character varying(14)'),
    ('colaboradores', 'supervisorFuncao', 'character varying(100)'),
    ('colaboradores', 'grauInstrucao', 'character varying(40)'),
    ('colaboradores', 'situacaoCurso', 'character varying(40)'),
    ('colaboradores', 'curso', 'character varying(200)'),
    ('colaboradores', 'semestre', 'character varying(40)'),
    ('colaboradores', 'instituicaoEnsino', 'character varying(200)'),
    ('colaboradores', 'instituicaoCnpj', 'character varying(18)'),
    ('colaboradores', 'periodoEstagio', 'character varying(40)'),
    ('colaboradores', 'empresaEstagio', 'character varying(40)'),
    ('colaboradores', 'apoliceSeguro', 'character varying(50)'),
    ('colaboradores', 'sindicato', 'character varying(40)'),
    ('colaboradores', 'contribuicaoSindical', 'character varying(40)'),
    ('colaboradores', 'motivoSemVT', 'character varying(40)'),
    ('colaboradores', 'descontoVT', 'character varying(40)'),
    ('colaboradores', 'planoOdontologico', 'character varying(40)'),
    ('colaboradores', 'totalpass', 'character varying(40)'),
    ('dependentes', 'id', 'integer'),
    ('dependentes', 'colaboradorId', 'integer'),
    ('dependentes', 'nome', 'character varying(200)'),
    ('dependentes', 'parentesco', 'character varying(20)'),
    ('dependentes', 'dataNascimento', 'date'),
    ('dependentes', 'cpf', 'character varying(14)'),
    ('dependentes', 'rg', 'character varying(20)'),
    ('dependentes', 'dependenteIR', 'boolean'),
    ('dependentes', 'createdAt', 'timestamp without time zone')
), actual AS (
  SELECT c.relname AS table_name, a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS actual_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('historicoFerias', 'colaboradores', 'dependentes')
     AND a.attnum > 0
     AND NOT a.attisdropped
)
SELECT e.table_name, e.column_name, e.expected_type,
       COALESCE(a.actual_type, '<ausente>') AS actual_type
  FROM expected e
  LEFT JOIN actual a USING (table_name, column_name)
 WHERE a.column_name IS NULL OR a.actual_type <> e.expected_type
 ORDER BY e.table_name, e.column_name;

-- 2) Todas as linhas devem mostrar owner_access=true. Não concede privilégios.
SELECT c.relname AS object_name,
       pg_get_userbyid(c.relowner) AS owner_role,
       current_user AS executing_role,
       pg_has_role(current_user, c.relowner, 'USAGE')
         OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS owner_access
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('historicoFerias', 'colaboradores', 'dependentes')
 ORDER BY c.relname;

-- 3) Depois da migração: todos os campos devem ser true. Também detecta uma
-- tabela dependentes preexistente com nulabilidade/defaults/PK incompatíveis.
SELECT
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'dependentes'
       AND indexname = 'idx_dependentes_colab'
  ) AS index_exists,
  NOT EXISTS (
    SELECT 1
      FROM (VALUES
        ('id', true, true),
        ('colaboradorId', true, false),
        ('nome', true, false),
        ('parentesco', true, false),
        ('dataNascimento', false, false),
        ('cpf', false, false),
        ('rg', false, false),
        ('dependenteIR', true, true),
        ('createdAt', true, true)
      ) AS expected(column_name, expected_not_null, expected_default)
      LEFT JOIN (
        SELECT a.attname AS column_name,
               a.attnotnull AS is_not_null,
               a.atthasdef AS has_default
          FROM pg_attribute a
         WHERE a.attrelid = to_regclass('public.dependentes')
           AND a.attnum > 0
           AND NOT a.attisdropped
      ) actual USING (column_name)
     WHERE actual.column_name IS NULL
        OR actual.is_not_null <> expected.expected_not_null
        OR (expected.expected_default AND NOT actual.has_default)
  ) AS dependentes_column_constraints,
  EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_attribute a
        ON a.attrelid = con.conrelid
       AND a.attnum = ANY(con.conkey)
     WHERE con.conrelid = to_regclass('public.dependentes')
       AND con.contype = 'p'
     GROUP BY con.oid
    HAVING array_agg(a.attname ORDER BY a.attname) = ARRAY['id']::name[]
  ) AS primary_key_on_dependentes_id,
  EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_attribute source_column
        ON source_column.attrelid = con.conrelid
       AND source_column.attnum = con.conkey[1]
      JOIN pg_attribute target_column
        ON target_column.attrelid = con.confrelid
       AND target_column.attnum = con.confkey[1]
     WHERE con.conrelid = to_regclass('public.dependentes')
       AND con.confrelid = to_regclass('public.colaboradores')
       AND con.contype = 'f'
       AND con.confdeltype = 'c'
       AND cardinality(con.conkey) = 1
       AND cardinality(con.confkey) = 1
       AND source_column.attname = 'colaboradorId'
       AND target_column.attname = 'id'
  ) AS foreign_key_cascade;

-- 4) Executar também com a conexão/papel de runtime após a migração. Todos os
-- campos devem ser true. Apenas verifica privilégios existentes; não concede nada.
SELECT current_user AS runtime_role,
       COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'SELECT'), false)
         AS can_select_dependentes,
       COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'INSERT'), false)
         AS can_insert_dependentes,
       COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'UPDATE'), false)
         AS can_update_dependentes,
       COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'DELETE'), false)
         AS can_delete_dependentes,
       CASE WHEN to_regclass('public.dependentes') IS NULL THEN false ELSE
         COALESCE(
           has_sequence_privilege(
             current_user,
             pg_get_serial_sequence('public.dependentes', 'id'),
             'USAGE'
           ),
           false
         )
       END AS can_use_dependentes_sequence;
