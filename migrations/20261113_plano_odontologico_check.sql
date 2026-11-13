-- Conferência (somente leitura) após aplicar 20261113_plano_odontologico.sql
SELECT a.attname AS coluna, format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull AS not_null
  FROM pg_attribute a
 WHERE a.attrelid = to_regclass('public."planoOdontologico"') AND a.attnum > 0 AND NOT a.attisdropped
 ORDER BY a.attnum;
-- Esperado: 14 colunas (id, empresa, numeroOdontoprev, nome, cpf, tipo, parentesco,
-- titularNumeroOdontoprev, dataInclusao, valor, colaboradorId, ativo, createdAt, updatedAt)
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'planoOdontologico' ORDER BY 1;
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'planoOdontologico' ORDER BY 1, 2;
