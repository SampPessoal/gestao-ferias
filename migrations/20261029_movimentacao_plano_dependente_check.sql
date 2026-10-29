-- SOMENTE LEITURA. Execute antes e depois da migração de nomeDependente.
-- Antes: nenhuma linha. Depois: uma linha com actual_type = character varying(200).
SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS actual_type,
  a.attnotnull AS is_not_null
FROM pg_attribute a
WHERE a.attrelid = to_regclass('public."movimentacaoPlanoSaude"')
  AND a.attname = 'nomeDependente'
  AND a.attnum > 0
  AND NOT a.attisdropped;

-- Após a migração deve retornar true em todos os campos (antes dela, false).
WITH coluna AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_attribute a
     WHERE a.attrelid = to_regclass('public."movimentacaoPlanoSaude"')
       AND a.attname = 'nomeDependente' AND a.attnum > 0 AND NOT a.attisdropped
  ) AS existe
)
SELECT
  CASE WHEN existe THEN has_column_privilege(current_user, 'public."movimentacaoPlanoSaude"', 'nomeDependente', 'SELECT') ELSE false END AS pode_ler,
  CASE WHEN existe THEN has_column_privilege(current_user, 'public."movimentacaoPlanoSaude"', 'nomeDependente', 'INSERT') ELSE false END AS pode_inserir,
  CASE WHEN existe THEN has_column_privilege(current_user, 'public."movimentacaoPlanoSaude"', 'nomeDependente', 'UPDATE') ELSE false END AS pode_atualizar
FROM coluna;
