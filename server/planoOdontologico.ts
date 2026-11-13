import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import { planoOdontologico } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
const soDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

/** Erro do Postgres "tabela não existe" (migração ainda não aplicada). */
function tabelaAusente(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string }; message?: string };
  return err?.code === "42P01" || err?.cause?.code === "42P01" || /planoOdontologico.*does not exist/i.test(err?.message || "");
}
async function comTabela<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (tabelaAusente(e)) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "TABELA_ODONTO_AUSENTE: a tabela do plano odontológico ainda não foi criada no banco (migração 20261113_plano_odontologico.sql).",
      });
    }
    throw e;
  }
}
async function db() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return d;
}

const dadosBeneficiario = z.object({
  empresa: z.enum(EMPRESAS),
  numeroOdontoprev: z.string().trim().min(1, "Informe o número OdontoPrev").max(30),
  nome: z.string().trim().min(2, "Informe o nome").max(200),
  cpf: z.string().max(14).optional().nullable(),
  tipo: z.enum(["T", "D"]),
  parentesco: z.string().max(20).optional().nullable(),
  titularNumeroOdontoprev: z.string().max(30).optional().nullable(),
  dataInclusao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().nullable(),
  valor: z.number().min(0).max(100000),
});

export const planoOdontologicoRouter = router({
  list: protectedProcedure
    .input(z.object({ empresa: z.enum(EMPRESAS).optional(), busca: z.string().max(100).optional() }).optional())
    .query(({ input }) => comTabela(async () => {
      const d = await db();
      const conds = [eq(planoOdontologico.ativo, true)];
      if (input?.empresa) conds.push(eq(planoOdontologico.empresa, input.empresa));
      let rows = await d.select().from(planoOdontologico).where(and(...conds)).orderBy(planoOdontologico.nome);
      const busca = (input?.busca || "").trim().toUpperCase();
      if (busca) {
        // Mantém a família inteira quando o titular ou um dependente bate com a busca
        const dig = soDigitos(busca);
        const bate = (r: typeof rows[number]) =>
          r.nome.toUpperCase().includes(busca) || r.numeroOdontoprev.includes(busca) || (dig.length >= 3 && soDigitos(r.cpf).includes(dig));
        const familias = new Set(rows.filter(bate).map((r) => (r.tipo === "T" ? r.numeroOdontoprev : r.titularNumeroOdontoprev || r.numeroOdontoprev)));
        rows = rows.filter((r) => familias.has(r.tipo === "T" ? r.numeroOdontoprev : r.titularNumeroOdontoprev || r.numeroOdontoprev));
      }
      return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
    })),

  create: protectedProcedure
    .input(dadosBeneficiario)
    .mutation(({ input }) => comTabela(async () => {
      const d = await db();
      if (input.tipo === "D" && !input.titularNumeroOdontoprev) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha o titular do dependente" });
      }
      const [existe] = await d.select({ id: planoOdontologico.id }).from(planoOdontologico)
        .where(and(eq(planoOdontologico.numeroOdontoprev, input.numeroOdontoprev), eq(planoOdontologico.ativo, true)));
      if (existe) throw new TRPCError({ code: "CONFLICT", message: "Já existe um beneficiário ativo com esse número OdontoPrev" });
      const [novo] = await d.insert(planoOdontologico).values({
        empresa: input.empresa,
        numeroOdontoprev: input.numeroOdontoprev,
        nome: input.nome.toUpperCase(),
        cpf: soDigitos(input.cpf) || null,
        tipo: input.tipo,
        parentesco: input.tipo === "D" ? input.parentesco || "" : "",
        titularNumeroOdontoprev: input.tipo === "D" ? input.titularNumeroOdontoprev || null : null,
        dataInclusao: input.dataInclusao || null,
        valor: input.valor.toFixed(2),
      }).returning({ id: planoOdontologico.id });
      return novo;
    })),

  update: protectedProcedure
    .input(dadosBeneficiario.partial().extend({ id: z.number().int() }))
    .mutation(({ input }) => comTabela(async () => {
      const d = await db();
      const { id, ...rest } = input;
      const [atual] = await d.select().from(planoOdontologico).where(eq(planoOdontologico.id, id));
      if (!atual) throw new TRPCError({ code: "NOT_FOUND", message: "Beneficiário não encontrado" });
      const upd: Partial<typeof planoOdontologico.$inferInsert> = { updatedAt: new Date() };
      if (rest.empresa !== undefined) upd.empresa = rest.empresa;
      if (rest.nome !== undefined) upd.nome = rest.nome.toUpperCase();
      if (rest.cpf !== undefined) upd.cpf = soDigitos(rest.cpf) || null;
      if (rest.tipo !== undefined) upd.tipo = rest.tipo;
      if (rest.parentesco !== undefined) upd.parentesco = rest.parentesco || "";
      if (rest.titularNumeroOdontoprev !== undefined) upd.titularNumeroOdontoprev = rest.titularNumeroOdontoprev || null;
      if (rest.dataInclusao !== undefined) upd.dataInclusao = rest.dataInclusao || null;
      if (rest.valor !== undefined) upd.valor = rest.valor.toFixed(2);
      if (rest.numeroOdontoprev !== undefined && rest.numeroOdontoprev !== atual.numeroOdontoprev) {
        upd.numeroOdontoprev = rest.numeroOdontoprev;
        // Dependentes acompanham a troca de número do titular
        if (atual.tipo === "T") {
          await d.update(planoOdontologico).set({ titularNumeroOdontoprev: rest.numeroOdontoprev })
            .where(and(eq(planoOdontologico.titularNumeroOdontoprev, atual.numeroOdontoprev), eq(planoOdontologico.ativo, true)));
        }
      }
      await d.update(planoOdontologico).set(upd).where(eq(planoOdontologico.id, id));
      return { success: true };
    })),

  /** Tira do plano (fica inativo, sem apagar). Titular sai com os dependentes; dependente sai sozinho. */
  excluir: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => comTabela(() => excluirBeneficiarioOdonto(input.id))),
});

export async function excluirBeneficiarioOdonto(id: number): Promise<{ excluidos: string[] }> {
  const d = await db();
  const [b] = await d.select().from(planoOdontologico).where(eq(planoOdontologico.id, id));
  if (!b) throw new TRPCError({ code: "NOT_FOUND", message: "Beneficiário não encontrado" });
  const alvo = b.tipo === "T"
    ? await d.select().from(planoOdontologico).where(and(eq(planoOdontologico.ativo, true), or(
        eq(planoOdontologico.id, b.id), eq(planoOdontologico.titularNumeroOdontoprev, b.numeroOdontoprev))))
    : [b];
  await d.update(planoOdontologico).set({ ativo: false, updatedAt: new Date() })
    .where(inArray(planoOdontologico.id, alvo.map((r) => r.id)));
  return { excluidos: alvo.map((r) => r.nome) };
}

/** Ao inativar um colaborador: tira do plano odontológico o titular dele (vínculo ou CPF) e os dependentes. */
export async function inativarOdontoDoColaborador(colaboradorId: number, cpfColaborador: string | null): Promise<string[]> {
  try {
    const d = await db();
    const cpf = soDigitos(cpfColaborador);
    const titulares = await d.select().from(planoOdontologico).where(and(
      eq(planoOdontologico.ativo, true), eq(planoOdontologico.tipo, "T"),
      cpf.length === 11
        ? or(eq(planoOdontologico.colaboradorId, colaboradorId), eq(planoOdontologico.cpf, cpf))
        : eq(planoOdontologico.colaboradorId, colaboradorId),
    ));
    const nomes: string[] = [];
    for (const t of titulares) nomes.push(...(await excluirBeneficiarioOdonto(t.id)).excluidos);
    return nomes;
  } catch (e) {
    if (tabelaAusente(e)) return []; // migração ainda não aplicada: nada a fazer
    throw e;
  }
}

