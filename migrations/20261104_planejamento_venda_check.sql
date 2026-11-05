-- SOMENTE LEITURA. Execute antes e depois da migração.
-- Antes: nenhuma linha. Depois: 3 linhas boolean, NOT NULL, default false.
SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS actual_type,
  a.attnotnull AS is_not_null,
  pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = to_regclass('public.colaboradores')
  AND a.attname IN ('planejamento1Venda', 'planejamento2Venda', 'planejamento3Venda')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attname;
