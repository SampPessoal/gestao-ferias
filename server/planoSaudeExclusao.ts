import { and, eq, inArray } from "drizzle-orm";
import { colaboradores, planoSaude } from "../drizzle/schema";
import { getDb } from "./db";

const soDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

/** Recalcula o total da família (titular + dependentes ativos) do titular informado. */
export async function recalcularTotalFamilia(numeroTitular: string) {
  const db = await getDb();
  if (!db || !numeroTitular) return;
  const filtro = eq(planoSaude.ativo, true);
  const [titular] = await db.select().from(planoSaude)
    .where(and(filtro, eq(planoSaude.numeroBeneficiario, numeroTitular), eq(planoSaude.tipo, "T")));
  if (!titular) return;
  const deps = await db.select().from(planoSaude).where(and(filtro, eq(planoSaude.titularNumeroBeneficiario, numeroTitular)));
  const total = Number(titular.mensalidade) + deps.reduce((a, d) => a + Number(d.mensalidade), 0);
  await db.update(planoSaude).set({ totalFamilia: total.toFixed(2) }).where(eq(planoSaude.id, titular.id));
}

/** Recalcula o total da família à qual o beneficiário pertence (dele, se titular; do titular dele, se dependente). */
export async function recalcularFamiliaDoBeneficiario(id: number) {
  const db = await getDb();
  if (!db) return;
  const [b] = await db.select().from(planoSaude).where(eq(planoSaude.id, id));
  if (!b) return;
  const titular = b.tipo === "T" ? b.numeroBeneficiario : b.titularNumeroBeneficiario;
  if (titular) await recalcularTotalFamilia(titular);
}

/**
 * Tira um beneficiário do plano (fica inativo, sem apagar o histórico).
 * Titular: sai junto com os dependentes dele. Dependente: sai só ele e o total da família é recalculado.
 */
export async function excluirBeneficiarioDoPlano(id: number): Promise<{ excluidos: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [b] = await db.select().from(planoSaude).where(eq(planoSaude.id, id));
  if (!b) throw new Error("Beneficiário não encontrado");
  const ids = [b.id];
  const nomes = [b.nome];
  if (b.tipo === "T") {
    const deps = await db.select().from(planoSaude).where(and(
      eq(planoSaude.titularNumeroBeneficiario, b.numeroBeneficiario),
      eq(planoSaude.ativo, true),
    ));
    for (const d of deps) { ids.push(d.id); nomes.push(d.nome); }
  }
  await db.update(planoSaude).set({ ativo: false, updatedAt: new Date() }).where(inArray(planoSaude.id, ids));
  if (b.tipo === "D" && b.titularNumeroBeneficiario) await recalcularTotalFamilia(b.titularNumeroBeneficiario);
  return { excluidos: nomes };
}

/**
 * Ao inativar um colaborador, tira do plano de saúde o titular dele (pelo vínculo ou pelo CPF) e os dependentes.
 */
export async function inativarPlanoDoColaborador(colaboradorId: number): Promise<{ excluidos: string[] }> {
  const db = await getDb();
  if (!db) return { excluidos: [] };
  const [c] = await db.select({ id: colaboradores.id, cpf: colaboradores.cpf }).from(colaboradores).where(eq(colaboradores.id, colaboradorId));
  if (!c) return { excluidos: [] };
  const cpf = soDigitos(c.cpf);
  const titulares = (await db.select().from(planoSaude).where(and(eq(planoSaude.tipo, "T"), eq(planoSaude.ativo, true))))
    .filter((t) => t.colaboradorId === colaboradorId || (cpf.length === 11 && soDigitos(t.cpf) === cpf));
  const excluidos: string[] = [];
  for (const t of titulares) excluidos.push(...(await excluirBeneficiarioDoPlano(t.id)).excluidos);
  // Plano odontológico também (se a tabela já existir)
  const { inativarOdontoDoColaborador } = await import("./planoOdontologico");
  excluidos.push(...(await inativarOdontoDoColaborador(colaboradorId, c.cpf)));
  return { excluidos };
}
