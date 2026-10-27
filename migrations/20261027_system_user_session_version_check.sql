-- SOMENTE LEITURA. Execute antes e depois da migração de sessionVersion.
SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS actual_type,
  a.attnotnull AS is_not_null,
  a.atthasdef AS has_default,
  pg_get_expr(ad.adbin, ad.adrelid) AS default_expression
FROM pg_attribute a
LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE a.attrelid = to_regclass('public."systemUsers"')
  AND a.attname = 'sessionVersion'
  AND a.attnum > 0
  AND NOT a.attisdropped;

-- Após a migração deve retornar true em todos os campos.
SELECT
  COALESCE(has_table_privilege(current_user, to_regclass('public."systemUsers"'), 'SELECT'), false)
    AS can_select_system_users,
  COALESCE(has_table_privilege(current_user, to_regclass('public."systemUsers"'), 'UPDATE'), false)
    AS can_update_system_users;

-- Verificação agregada sem expor identificadores ou hashes.
SELECT
  count(*) AS total_accounts,
  count(*) FILTER (WHERE "sessionVersion" < 0) AS invalid_versions,
  min("sessionVersion") AS minimum_version,
  max("sessionVersion") AS maximum_version
FROM public."systemUsers";
