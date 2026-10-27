import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DatabaseSchemaError,
  findDatabaseSchemaIssues,
  REQUIRED_DATABASE_COLUMNS,
  REQUIRED_DATABASE_COLUMN_TYPES,
  REQUIRED_DATABASE_INDEXES,
} from "./databaseSchema";

const completeSnapshot = () => ({
  columns: Object.entries(REQUIRED_DATABASE_COLUMNS).flatMap(([table_name, columns]) =>
    columns.map(column_name => ({
      table_name,
      column_name,
      actual_type: REQUIRED_DATABASE_COLUMN_TYPES[table_name][column_name],
      is_not_null: (table_name === "dependentes" && [
        "id", "colaboradorId", "nome", "parentesco", "dependenteIR", "createdAt",
      ].includes(column_name)) || (table_name === "systemUsers" && column_name === "sessionVersion"),
      has_default: (table_name === "dependentes" && [
        "id", "dependenteIR", "createdAt",
      ].includes(column_name)) || (table_name === "systemUsers" && column_name === "sessionVersion"),
      default_expression: table_name === "systemUsers" && column_name === "sessionVersion" ? "0" : null,
    })),
  ),
  indexes: [...REQUIRED_DATABASE_INDEXES],
  primaryKeyOnDependentesId: true,
  foreignKeyCascade: true,
  runtimeDependentesDml: true,
  runtimeDependentesSequenceUsage: true,
  runtimeSystemUsersSelectUpdate: true,
});

describe("database schema preflight", () => {
  it("accepts the complete required schema", () => {
    expect(findDatabaseSchemaIssues(completeSnapshot())).toEqual([]);
  });

  it("reports a missing application column without reading employee data", () => {
    const snapshot = completeSnapshot();
    snapshot.columns = snapshot.columns.filter(
      column => !(column.table_name === "colaboradores" && column.column_name === "cidadeInterior"),
    );
    expect(findDatabaseSchemaIssues(snapshot)).toContain("colaboradores.cidadeInterior (ausente)");
  });

  it("requires the per-account session version with type, default and not-null", () => {
    const snapshot = completeSnapshot();
    const column = snapshot.columns.find(
      item => item.table_name === "systemUsers" && item.column_name === "sessionVersion",
    )!;
    column.actual_type = "bigint";
    column.is_not_null = false;
    column.has_default = false;
    column.default_expression = "1";
    expect(findDatabaseSchemaIssues(snapshot)).toEqual([
      "systemUsers.sessionVersion (esperado integer; encontrado bigint)",
      "systemUsers.sessionVersion (esperado NOT NULL)",
      "systemUsers.sessionVersion (esperado DEFAULT)",
      "systemUsers.sessionVersion (esperado DEFAULT 0)",
    ]);
  });

  it("reports an incompatible column type", () => {
    const snapshot = completeSnapshot();
    const column = snapshot.columns.find(
      item => item.table_name === "colaboradores" && item.column_name === "cidadeInterior",
    )!;
    column.actual_type = "text";
    expect(findDatabaseSchemaIssues(snapshot)).toContain(
      "colaboradores.cidadeInterior (esperado character varying(100); encontrado text)",
    );
  });

  it("reports a missing index separately", () => {
    const snapshot = completeSnapshot();
    snapshot.indexes = [];
    expect(findDatabaseSchemaIssues(snapshot)).toEqual(["index:idx_dependentes_colab (ausente)"]);
  });

  it("requires the dependentes cascading foreign key", () => {
    const snapshot = completeSnapshot();
    snapshot.foreignKeyCascade = false;
    expect(findDatabaseSchemaIssues(snapshot)).toEqual([
      "constraint:dependentes.colaboradorId->colaboradores.id ON DELETE CASCADE",
    ]);
  });

  it("requires dependentes defaults, not-null constraints and primary key", () => {
    const snapshot = completeSnapshot();
    const id = snapshot.columns.find(
      item => item.table_name === "dependentes" && item.column_name === "id",
    )!;
    id.is_not_null = false;
    id.has_default = false;
    snapshot.primaryKeyOnDependentesId = false;
    expect(findDatabaseSchemaIssues(snapshot)).toEqual([
      "dependentes.id (esperado NOT NULL)",
      "dependentes.id (esperado DEFAULT)",
      "constraint:dependentes.id PRIMARY KEY",
    ]);
  });

  it("requires existing runtime privileges without granting them", () => {
    const snapshot = completeSnapshot();
    snapshot.runtimeDependentesDml = false;
    snapshot.runtimeDependentesSequenceUsage = false;
    snapshot.runtimeSystemUsersSelectUpdate = false;
    expect(findDatabaseSchemaIssues(snapshot)).toEqual([
      "privilege:runtime dependentes SELECT/INSERT/UPDATE/DELETE",
      "privilege:runtime dependentes_id_seq USAGE",
      "privilege:runtime systemUsers SELECT/UPDATE",
    ]);
  });

  it("keeps the startup error concise while retaining the complete list", () => {
    const missing = Array.from({ length: 12 }, (_, index) => `t.c${index}`);
    const error = new DatabaseSchemaError(missing);
    expect(error.message).toContain("12 divergência(s)");
    expect(error.message).toContain("(+4)");
    expect(error.issues).toEqual(missing);
  });

  it("keeps the reviewed migration minimal and free of data or privilege changes", () => {
    const migration = readFileSync(
      path.resolve(import.meta.dirname, "../migrations/20261027_required_schema.sql"),
      "utf8",
    );
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("COMMIT;");
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "cidadeInterior" varchar(100)',
    );
    expect(migration.match(/\bALTER\s+TABLE\b/gi)).toHaveLength(1);
    expect(migration).not.toMatch(/\bCREATE\s+(TABLE|INDEX)\b/i);
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toContain("sudoeste");
    expect(migration).not.toMatch(/\bGRANT\b|ALTER\s+TABLE[\s\S]*\bOWNER\s+TO\b/i);
  });

  it("keeps PR 20 dynamic discovery read-only and removes runtime repair", () => {
    const dbSource = readFileSync(path.resolve(import.meta.dirname, "./db.ts"), "utf8");
    const registroSource = readFileSync(
      path.resolve(import.meta.dirname, "./registroEmpregado.ts"),
      "utf8",
    );
    expect(dbSource).toContain("export async function colunasExistentes");
    expect(registroSource).toContain("async function camposDisponiveis");
    expect(dbSource).not.toMatch(/ALTER\s+TABLE|CREATE\s+TABLE|CREATE\s+INDEX/i);
    expect(dbSource).not.toContain("empresaEstagio\" = 'empresa'");
    expect(dbSource).not.toContain("garantirEstruturaBanco");
    expect(registroSource).not.toContain("garantirEstruturaBanco");
  });

  it("keeps the session-version migration additive and free of grants or global key changes", () => {
    const migration = readFileSync(
      path.resolve(import.meta.dirname, "../migrations/20261027_system_user_session_version.sql"),
      "utf8",
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0');
    expect(migration).not.toMatch(/\bDELETE\b|\bGRANT\b|JWT_SECRET|passwordHash/i);
    expect(migration).not.toMatch(/UPDATE\s+public\."systemUsers"/i);
  });

  it("coordinates Railway deployment with the database-backed health endpoint", () => {
    const railway = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, "../railway.json"), "utf8"),
    );
    expect(railway.deploy).toMatchObject({
      healthcheckPath: "/healthz",
      healthcheckTimeout: 300,
    });
  });
});
