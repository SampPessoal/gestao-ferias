/**
 * Registro de Empregado: campos complementares da Ficha de Registro e dependentes.
 * Os campos vêm da definição única em shared/registroEmpregado.ts.
 */
import { z } from "zod/v4";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { colaboradores, dependentes, movimentacaoAuxilioNotebook, planoSaude } from "../drizzle/schema";
import { CAMPOS_REGISTRO, PARENTESCOS, type CampoRegistro, type Dependente, type RegistroEmpregado } from "../shared/registroEmpregado";

const so = (d: string) => d.replace(/\D/g, "");

/** Validação de um campo conforme o tipo. Vazio = null (apaga o valor). */
function validador(c: CampoRegistro) {
  const vazioParaNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
  let base: z.ZodType<string>;
  switch (c.tipo) {
    case "opcao":
      base = z.enum(c.opcoes!.map(o => o.valor) as [string, ...string[]]);
      break;
    case "data":
      base = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${c.rotulo}: data inválida`);
      break;
    case "moeda":
      base = z.string().trim().transform(v => v.replace(/\./g, "").replace(",", "."))
        .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, `${c.rotulo}: valor inválido`)) as any;
      break;
    case "hora":
      base = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${c.rotulo}: horário inválido`);
      break;
    case "cpf":
      base = z.string().refine(v => so(v).length === 11, `${c.rotulo}: CPF deve ter 11 dígitos`);
      break;
    case "cnpj":
      base = z.string().refine(v => so(v).length === 14, `${c.rotulo}: CNPJ deve ter 14 dígitos`);
      break;
    case "email":
      base = z.string().trim().email(`${c.rotulo}: e-mail inválido`).max(c.max ?? 200);
      break;
    default:
      base = z.string().trim().max(c.max ?? 40, `${c.rotulo}: até ${c.max ?? 40} caracteres`);
  }
  return z.preprocess(vazioParaNull, base.nullable()).optional();
}

/** Valor em R$ digitado ("1.234,56" ou "1234.56") → "1234.56"; vazio = null. */
const valorReais = (rotulo: string) => z.preprocess(
  v => (typeof v === "string" ? (v.trim() === "" ? null : v.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) : v),
  z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, `${rotulo}: valor inválido`).nullable(),
).optional();

/** Benefícios que já existiam no cadastro e passam a ser editados no cartão Benefícios. */
const beneficiosSchema = z.object({
  valorVR: valorReais("Vale-refeição"),
  valorVT: valorReais("Vale-transporte"),
  temSeguroVida: z.boolean().optional(),
  valorSeguroVida: z.preprocess(v => (v === "" ? null : v), z.string().trim().max(20).nullable()).optional(),
}).strict();

export const camposSchema = z.object(Object.fromEntries(CAMPOS_REGISTRO.map(c => [c.chave, validador(c)]))).strict();

const dependenteSchema = z.object({
  id: z.number().int().positive().optional(),
  colaboradorId: z.number().int().positive(),
  nome: z.string().trim().min(2, "Informe o nome do dependente").max(200),
  parentesco: z.enum(PARENTESCOS.map(p => p.valor) as [string, ...string[]]),
  dataNascimento: z.preprocess(v => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  cpf: z.preprocess(v => (v === "" ? null : v), z.string().refine(v => so(v).length === 11, "CPF do dependente deve ter 11 dígitos").nullable()),
  rg: z.preprocess(v => (v === "" ? null : v), z.string().trim().max(20).nullable()),
  dependenteIR: z.boolean(),
});

/** Dependente informado no cadastro de um colaborador novo (ainda sem id). */
export const dependenteNovoSchema = dependenteSchema.omit({ id: true, colaboradorId: true });

/** Registro de Empregado enviado junto com o cadastro de um colaborador novo. */
export const registroInicialSchema = z.object({
  campos: camposSchema,
  dependentes: z.array(dependenteNovoSchema).max(20),
});

/** Grava os campos complementares e os dependentes de um colaborador recém-criado. */
export async function salvarRegistroInicial(colaboradorId: number, registro: z.infer<typeof registroInicialSchema>) {
  const db = await dbOuErro();
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(registro.campos)) if (v !== undefined && v !== null) patch[k] = v;
  if (Object.keys(patch).length) {
    await db.update(colaboradores).set(patch as any).where(eq(colaboradores.id, colaboradorId));
  }
  if (registro.dependentes.length) {
    await db.insert(dependentes).values(registro.dependentes.map(d => ({ ...d, colaboradorId })) as any);
  }
}

async function dbOuErro() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return db;
}

const dataStr = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

/** Campos do Registro de Empregado, dependentes e auxílio notebook de um colaborador. */
export async function lerRegistroEmpregado(colaboradorId: number) {
  const db = await dbOuErro();
  const sel = Object.fromEntries(CAMPOS_REGISTRO.map(c => [c.chave, (colaboradores as any)[c.chave]]));
  const [linha] = await db.select(sel as any).from(colaboradores).where(eq(colaboradores.id, colaboradorId)).limit(1);
  if (!linha) return null;
  const campos: RegistroEmpregado = {};
  for (const c of CAMPOS_REGISTRO) {
    const v = (linha as any)[c.chave];
    campos[c.chave] = c.tipo === "data" ? dataStr(v) : v === null || v === undefined ? null : String(v);
  }
  const deps = await db.select().from(dependentes)
    .where(eq(dependentes.colaboradorId, colaboradorId)).orderBy(dependentes.id);
  // Auxílio notebook: ativo se a movimentação mais recente for uma inclusão
  const [mov] = await db.select().from(movimentacaoAuxilioNotebook)
    .where(eq(movimentacaoAuxilioNotebook.colaboradorId, colaboradorId))
    .orderBy(desc(movimentacaoAuxilioNotebook.dataInicio), desc(movimentacaoAuxilioNotebook.id))
    .limit(1);
  // Benefícios que já existiam no cadastro (VR, VT e seguro de vida) e o plano de saúde
  const [ben] = await db.select({
    valorVR: colaboradores.valorVR, valorVT: colaboradores.valorVT,
    temSeguroVida: colaboradores.temSeguroVida, valorSeguroVida: colaboradores.valorSeguroVida,
  }).from(colaboradores).where(eq(colaboradores.id, colaboradorId)).limit(1);
  const [plano] = await db.select({ plano: planoSaude.plano, mes: planoSaude.mesReferencia, ano: planoSaude.anoReferencia })
    .from(planoSaude)
    .where(and(eq(planoSaude.colaboradorId, colaboradorId), eq(planoSaude.tipo, "T"), eq(planoSaude.ativo, true)))
    .orderBy(desc(planoSaude.anoReferencia), desc(planoSaude.mesReferencia))
    .limit(1);
  return {
    campos,
    beneficios: {
      valorVR: ben?.valorVR ?? null,
      valorVT: ben?.valorVT ?? null,
      temSeguroVida: ben?.temSeguroVida ?? null,
      valorSeguroVida: ben?.valorSeguroVida ?? null,
      planoSaude: plano ? { plano: plano.plano, competencia: `${String(plano.mes).padStart(2, "0")}/${plano.ano}` } : null,
    },
    dependentes: deps.map((d): Dependente => ({
      id: d.id, nome: d.nome, parentesco: d.parentesco, dataNascimento: dataStr(d.dataNascimento),
      cpf: d.cpf, rg: d.rg, dependenteIR: d.dependenteIR,
    })),
    notebook: mov ? { ativo: mov.tipo === "incluir", valor: mov.valor, desde: dataStr(mov.dataInicio) } : null,
  };
}

export const registroEmpregadoRouter = router({
  get: protectedProcedure
    .input(z.object({ colaboradorId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const r = await lerRegistroEmpregado(input.colaboradorId);
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não encontrado" });
      return r;
    }),

  salvar: protectedProcedure
    .input(z.object({
      colaboradorId: z.number().int().positive(),
      campos: camposSchema,
      beneficios: beneficiosSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await dbOuErro();
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input.campos)) if (v !== undefined) patch[k] = v;
      for (const [k, v] of Object.entries(input.beneficios ?? {})) if (v !== undefined) patch[k] = v;
      if (!Object.keys(patch).length) return { success: true };
      const r = await db.update(colaboradores).set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(colaboradores.id, input.colaboradorId)).returning({ id: colaboradores.id });
      if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não encontrado" });
      return { success: true };
    }),

  salvarDependente: protectedProcedure
    .input(dependenteSchema)
    .mutation(async ({ input }) => {
      const db = await dbOuErro();
      const { id, ...dados } = input;
      if (id) {
        const r = await db.update(dependentes).set(dados as any)
          .where(and(eq(dependentes.id, id), eq(dependentes.colaboradorId, input.colaboradorId)))
          .returning({ id: dependentes.id });
        if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Dependente não encontrado" });
        return { id };
      }
      const [novo] = await db.insert(dependentes).values(dados as any).returning({ id: dependentes.id });
      return { id: novo.id };
    }),

  removerDependente: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), colaboradorId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await dbOuErro();
      await db.delete(dependentes).where(and(eq(dependentes.id, input.id), eq(dependentes.colaboradorId, input.colaboradorId)));
      return { success: true };
    }),
});
