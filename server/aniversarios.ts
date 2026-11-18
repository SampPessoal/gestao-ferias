import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { colaboradores, empresas, setores } from "../drizzle/schema";
import { protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";

/** Aniversariantes ativos de um mês (1–12), só com os campos que a relação usa. */
export const aniversariantesProcedure = protectedProcedure
  .input(z.object({ mes: z.number().int().min(1).max(12) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: colaboradores.id,
        nome: colaboradores.nome,
        dataNascimento: colaboradores.dataNascimento,
        empresa: empresas.nome,
        setor: setores.nome,
      })
      .from(colaboradores)
      .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
      .leftJoin(setores, eq(colaboradores.setorId, setores.id))
      .where(and(
        eq(colaboradores.status, "ativo"),
        isNotNull(colaboradores.dataNascimento),
        sql`extract(month from ${colaboradores.dataNascimento}) = ${input.mes}`,
      ));
    return rows
      .map((r) => {
        const d = String(r.dataNascimento).slice(0, 10); // YYYY-MM-DD
        return { id: r.id, nome: r.nome, dataNascimento: d, dia: Number(d.slice(8, 10)), anoNascimento: Number(d.slice(0, 4)), empresa: r.empresa ?? "", setor: r.setor ?? "" };
      })
      .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  });
