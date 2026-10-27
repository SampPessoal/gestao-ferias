import type postgres from "postgres";
import { CAMPOS_REGISTRO, tipoSql } from "../shared/registroEmpregado";

export type DatabaseColumn = {
  table_name: string;
  column_name: string;
  actual_type: string;
  is_not_null: boolean;
  has_default: boolean;
};

const catalogType = (sqlType: string) =>
  sqlType.replace(/^varchar\((\d+)\)$/, "character varying($1)");

export const REQUIRED_DATABASE_COLUMN_TYPES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  historicoFerias: {
    periodoAquisitivoAnterior: "date",
    vencimentoAnterior: "date",
    dataLimiteAnterior: "date",
    saldoAnterior: "integer",
  },
  colaboradores: Object.fromEntries(
    CAMPOS_REGISTRO.map(campo => [campo.chave, catalogType(tipoSql(campo))]),
  ),
  dependentes: {
    id: "integer",
    colaboradorId: "integer",
    nome: "character varying(200)",
    parentesco: "character varying(20)",
    dataNascimento: "date",
    cpf: "character varying(14)",
    rg: "character varying(20)",
    dependenteIR: "boolean",
    createdAt: "timestamp without time zone",
  },
};

export const REQUIRED_DATABASE_COLUMNS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(REQUIRED_DATABASE_COLUMN_TYPES).map(([table, columns]) => [
      table,
      Object.keys(columns),
    ]),
  );

export const REQUIRED_DATABASE_INDEXES = ["idx_dependentes_colab"] as const;
export const REQUIRED_NOT_NULL_COLUMNS = new Set([
  "dependentes.id",
  "dependentes.colaboradorId",
  "dependentes.nome",
  "dependentes.parentesco",
  "dependentes.dependenteIR",
  "dependentes.createdAt",
]);
export const REQUIRED_DEFAULT_COLUMNS = new Set([
  "dependentes.id",
  "dependentes.dependenteIR",
  "dependentes.createdAt",
]);

export type DatabaseSchemaSnapshot = {
  columns: readonly DatabaseColumn[];
  indexes: readonly string[];
  primaryKeyOnDependentesId: boolean;
  foreignKeyCascade: boolean;
  runtimeDependentesDml: boolean;
  runtimeDependentesSequenceUsage: boolean;
};

/** Retorna somente divergências de catálogo; nunca consulta ou registra dados de funcionários. */
export function findDatabaseSchemaIssues(snapshot: DatabaseSchemaSnapshot): string[] {
  const existingColumns = new Map(
    snapshot.columns.map(column => [
      `${column.table_name}.${column.column_name}`,
      column.actual_type,
    ]),
  );
  const existingIndexes = new Set(snapshot.indexes);
  const issues: string[] = [];

  for (const [table, columns] of Object.entries(REQUIRED_DATABASE_COLUMN_TYPES)) {
    for (const [column, expectedType] of Object.entries(columns)) {
      const objectName = `${table}.${column}`;
      const actualType = existingColumns.get(objectName);
      if (!actualType) issues.push(`${objectName} (ausente)`);
      else if (actualType !== expectedType) {
        issues.push(`${objectName} (esperado ${expectedType}; encontrado ${actualType})`);
      }
    }
  }
  for (const column of snapshot.columns) {
    const objectName = `${column.table_name}.${column.column_name}`;
    if (REQUIRED_NOT_NULL_COLUMNS.has(objectName) && !column.is_not_null) {
      issues.push(`${objectName} (esperado NOT NULL)`);
    }
    if (REQUIRED_DEFAULT_COLUMNS.has(objectName) && !column.has_default) {
      issues.push(`${objectName} (esperado DEFAULT)`);
    }
  }
  for (const index of REQUIRED_DATABASE_INDEXES) {
    if (!existingIndexes.has(index)) issues.push(`index:${index} (ausente)`);
  }
  if (!snapshot.primaryKeyOnDependentesId) {
    issues.push("constraint:dependentes.id PRIMARY KEY");
  }
  if (!snapshot.foreignKeyCascade) {
    issues.push("constraint:dependentes.colaboradorId->colaboradores.id ON DELETE CASCADE");
  }
  if (!snapshot.runtimeDependentesDml) {
    issues.push("privilege:runtime dependentes SELECT/INSERT/UPDATE/DELETE");
  }
  if (!snapshot.runtimeDependentesSequenceUsage) {
    issues.push("privilege:runtime dependentes_id_seq USAGE");
  }
  return issues;
}

export class DatabaseSchemaError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    const preview = issues.slice(0, 8).join(", ");
    const remainder = issues.length > 8 ? ` (+${issues.length - 8})` : "";
    super(
      `Esquema do banco incompatível: ${issues.length} divergência(s): ${preview}${remainder}. ` +
      "Execute a migração revisada com o papel proprietário antes de iniciar esta versão.",
    );
    this.name = "DatabaseSchemaError";
    this.issues = issues;
  }
}

type PostgresClient = ReturnType<typeof postgres>;

/** Pré-checagem somente leitura usada na inicialização; o runtime nunca executa DDL. */
export async function assertRequiredDatabaseSchema(client: PostgresClient): Promise<void> {
  const columns = await client.unsafe<DatabaseColumn[]>(`
    SELECT c.relname AS table_name,
           a.attname AS column_name,
           format_type(a.atttypid, a.atttypmod) AS actual_type,
           a.attnotnull AS is_not_null,
           a.atthasdef AS has_default
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname IN ('historicoFerias', 'colaboradores', 'dependentes')
       AND a.attnum > 0
       AND NOT a.attisdropped
  `);
  const indexRows = await client.unsafe<Array<{ indexname: string }>>(`
    SELECT indexname
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'dependentes'
  `);
  const [constraintRow] = await client.unsafe<Array<{
    primary_key_on_dependentes_id: boolean;
    foreign_key_cascade: boolean;
  }>>(`
    SELECT EXISTS (
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
    ) AS foreign_key_cascade
  `);
  const [privilegeRow] = await client.unsafe<Array<{
    dependentes_dml: boolean;
    dependentes_sequence_usage: boolean;
  }>>(`
    SELECT
      COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'SELECT'), false)
        AND COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'INSERT'), false)
        AND COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'UPDATE'), false)
        AND COALESCE(has_table_privilege(current_user, to_regclass('public.dependentes'), 'DELETE'), false)
        AS dependentes_dml,
      CASE WHEN to_regclass('public.dependentes') IS NULL THEN false ELSE
        COALESCE(
          has_sequence_privilege(
            current_user,
            pg_get_serial_sequence('public.dependentes', 'id'),
            'USAGE'
          ),
          false
        )
      END AS dependentes_sequence_usage
  `);
  const issues = findDatabaseSchemaIssues({
    columns,
    indexes: indexRows.map(row => row.indexname),
    primaryKeyOnDependentesId: constraintRow?.primary_key_on_dependentes_id === true,
    foreignKeyCascade: constraintRow?.foreign_key_cascade === true,
    runtimeDependentesDml: privilegeRow?.dependentes_dml === true,
    runtimeDependentesSequenceUsage: privilegeRow?.dependentes_sequence_usage === true,
  });
  if (issues.length) throw new DatabaseSchemaError(issues);
}
