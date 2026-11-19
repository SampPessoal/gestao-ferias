import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod/v4";
import { colaboradores, empresas, folgas, setores } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

function tabelaAusente(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string }; message?: string };
  return err?.code === "42P01" || err?.cause?.code === "42P01" || /"folgas".*does not exist/i.test(err?.message || "");
}
async function comTabela<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (tabelaAusente(e)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TABELA_FOLGAS_AUSENTE: a tabela de folgas ainda não foi criada no banco (migração 20261119_folgas.sql)." });
    throw e;
  }
}
async function db() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return d;
}

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
/** Dias corridos entre as datas, contando as duas pontas. */
export function diasEntre(inicio: string, fim: string): number {
  const a = Date.UTC(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10));
  const b = Date.UTC(+fim.slice(0, 4), +fim.slice(5, 7) - 1, +fim.slice(8, 10));
  return Math.round((b - a) / 86400000) + 1;
}
const dados = z.object({
  colaboradorId: z.number().int(),
  tipo: z.enum(["compensatoria", "normal", "outros"]),
  titulo: z.string().trim().max(100).optional().nullable(),
  dataInicio: DATA,
  dataFim: DATA,
  motivo: z.string().max(2000).optional().nullable(),
}).refine((d) => d.dataFim >= d.dataInicio, { message: "A data final não pode ser antes da inicial", path: ["dataFim"] })
  .refine((d) => d.tipo !== "outros" || !!d.titulo?.trim(), { message: "Informe o título da folga", path: ["titulo"] });

export const folgasRouter = router({
  /** Folgas do ano (e do mês, se informado), com nome, empresa e setor do colaborador. */
  list: protectedProcedure
    .input(z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12).optional() }))
    .query(({ input }) => comTabela(async () => {
      const d = await db();
      const ini = input.mes ? `${input.ano}-${String(input.mes).padStart(2, "0")}-01` : `${input.ano}-01-01`;
      const fimMes = input.mes ? new Date(Date.UTC(input.ano, input.mes, 0)).toISOString().slice(0, 10) : `${input.ano}-12-31`;
      const rows = await d.select({
        id: folgas.id, colaboradorId: folgas.colaboradorId, tipo: folgas.tipo, titulo: folgas.titulo,
        dataInicio: folgas.dataInicio, dataFim: folgas.dataFim, dias: folgas.dias, motivo: folgas.motivo,
        registradoPor: folgas.registradoPor, colaboradorNome: colaboradores.nome,
        empresaId: colaboradores.empresaId, empresaNome: empresas.nome, setorId: colaboradores.setorId, setorNome: setores.nome,
      }).from(folgas)
        .innerJoin(colaboradores, eq(folgas.colaboradorId, colaboradores.id))
        .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
        .leftJoin(setores, eq(colaboradores.setorId, setores.id))
        // folga que toca o período (começa antes do fim e termina depois do início)
        .where(and(lte(folgas.dataInicio, fimMes), gte(folgas.dataFim, ini)));
      return rows.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || (a.colaboradorNome ?? "").localeCompare(b.colaboradorNome ?? "", "pt-BR"));
    })),

  create: protectedProcedure.input(dados).mutation(({ input, ctx }) => comTabela(async () => {
    const d = await db();
    const [novo] = await d.insert(folgas).values({
      colaboradorId: input.colaboradorId, tipo: input.tipo,
      titulo: input.tipo === "outros" ? input.titulo!.trim() : null,
      dataInicio: input.dataInicio, dataFim: input.dataFim, dias: diasEntre(input.dataInicio, input.dataFim),
      motivo: input.motivo?.trim() || null,
      registradoPor: (ctx.user as { name?: string } | undefined)?.name ?? null,
    }).returning({ id: folgas.id });
    return novo;
  })),

  update: protectedProcedure.input(z.object({ id: z.number().int(), dados })).mutation(({ input }) => comTabela(async () => {
    const d = await db(); const v = input.dados;
    await d.update(folgas).set({
      colaboradorId: v.colaboradorId, tipo: v.tipo, titulo: v.tipo === "outros" ? v.titulo!.trim() : null,
      dataInicio: v.dataInicio, dataFim: v.dataFim, dias: diasEntre(v.dataInicio, v.dataFim),
      motivo: v.motivo?.trim() || null, updatedAt: new Date(),
    }).where(eq(folgas.id, input.id));
    return { success: true };
  })),

  delete: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(({ input }) => comTabela(async () => {
    const d = await db();
    await d.delete(folgas).where(eq(folgas.id, input.id));
    return { success: true };
  })),
});
