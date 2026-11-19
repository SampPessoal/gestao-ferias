-- Conferência (somente leitura) após aplicar 20261119_folgas.sql — esperado: 11 colunas
SELECT a.attname AS coluna, format_type(a.atttypid, a.atttypmod) AS tipo
  FROM pg_attribute a
 WHERE a.attrelid = to_regclass('public."folgas"') AND a.attnum > 0 AND NOT a.attisdropped
 ORDER BY a.attnum;
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'folgas' ORDER BY 1, 2;
