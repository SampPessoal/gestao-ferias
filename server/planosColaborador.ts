import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { colaboradores, planoOdontologico, planoSaude, tabelaPrecos } from "../drizzle/schema";
import { protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";

const soDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const normNome = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const r2 = (n: number) => Math.round(n * 100) / 100;

const NOME_PLANO_SAUDE: Record<string, string> = {
  "967067": "Prata QC", "967068": "Prata QP", "967077": "Ouro QC", "967078": "Ouro QP", "963730": "AMIL S750",
};
const nomePlanoSaude = (plano: string) => {
  const cod = Object.keys(NOME_PLANO_SAUDE).find((c) => plano === c || plano.includes(c));
  return cod ? NOME_PLANO_SAUDE[cod] : plano;
};
const PARENTESCO: Record<string, string> = { Conjuge: "Cônjuge", "Filho/Filha": "Filho(a)", Agregado: "Agregado" };

export type LinhaPlano = {
  nome: string; numero: string; tipo: "T" | "D"; parentesco: string; plano: string;
  valor: number; empresaPaga: number; colaboradorPaga: number;
};
export type PlanoDoColaborador = {
  empresa: string; plano: string; linhas: LinhaPlano[];
  total: { valor: number; empresaPaga: number; colaboradorPaga: number };
};

function totais(linhas: LinhaPlano[]) {
  return {
    valor: r2(linhas.reduce((a, l) => a + l.valor, 0)),
    empresaPaga: r2(linhas.reduce((a, l) => a + l.empresaPaga, 0)),
    colaboradorPaga: r2(linhas.reduce((a, l) => a + l.colaboradorPaga, 0)),
  };
}

/** Plano de saúde (AMIL) e odontológico (OdontoPrev) do colaborador, com titular, dependentes e quem paga quanto. */
export async function planosDoColaborador(colaboradorId: number): Promise<{ saude: PlanoDoColaborador | null; odonto: PlanoDoColaborador | null }> {
  const db = await getDb();
  if (!db) return { saude: null, odonto: null };
  const [c] = await db.select({ id: colaboradores.id, nome: colaboradores.nome, cpf: colaboradores.cpf })
    .from(colaboradores).where(eq(colaboradores.id, colaboradorId));
  if (!c) return { saude: null, odonto: null };
  const cpf = soDigitos(c.cpf);
  const nome = normNome(c.nome);

  // ── Plano de saúde: titular pelo vínculo ou pelo CPF ──
  let saude: PlanoDoColaborador | null = null;
  const titularesS = (await db.select().from(planoSaude).where(and(eq(planoSaude.tipo, "T"), eq(planoSaude.ativo, true))))
    .filter((t) => t.colaboradorId === colaboradorId || (cpf.length === 11 && soDigitos(t.cpf) === cpf));
  if (titularesS.length === 1) {
    const t = titularesS[0];
    const deps = await db.select().from(planoSaude).where(and(
      eq(planoSaude.titularNumeroBeneficiario, t.numeroBeneficiario), eq(planoSaude.tipo, "D"), eq(planoSaude.ativo, true)));
    const precos = await db.select().from(tabelaPrecos).where(and(eq(tabelaPrecos.empresa, t.empresa), eq(tabelaPrecos.codigoPlano, "967067")));
    const faixa = precos.find((p) => p.faixaInicio <= t.idade && p.faixaFim >= t.idade);
    const subsidioTitular = faixa ? Math.min(Number(faixa.valorTitular) * 0.7, Number(t.mensalidade)) : 0;
    const linhas: LinhaPlano[] = [t, ...deps].map((b) => {
      const valor = r2(Number(b.mensalidade));
      const empresaPaga = b.tipo === "T" ? r2(subsidioTitular) : 0; // subsídio só para o titular
      return {
        nome: b.nome, numero: b.numeroBeneficiario, tipo: b.tipo as "T" | "D",
        parentesco: b.tipo === "T" ? "Titular" : PARENTESCO[b.tipoDepend ?? ""] ?? "Dependente",
        plano: nomePlanoSaude(b.plano), valor, empresaPaga, colaboradorPaga: r2(valor - empresaPaga),
      };
    });
    saude = { empresa: t.empresa, plano: nomePlanoSaude(t.plano), linhas, total: totais(linhas) };
  }

  // ── Plano odontológico: titular pelo vínculo, CPF ou nome completo (só se for único) ──
  let odonto: PlanoDoColaborador | null = null;
  try {
    const titularesO = (await db.select().from(planoOdontologico).where(and(eq(planoOdontologico.tipo, "T"), eq(planoOdontologico.ativo, true))));
    let achados = titularesO.filter((t) => t.colaboradorId === colaboradorId || (cpf.length === 11 && soDigitos(t.cpf) === cpf));
    if (!achados.length && nome) achados = titularesO.filter((t) => normNome(t.nome) === nome);
    if (achados.length === 1) {
      const t = achados[0];
      const deps = await db.select().from(planoOdontologico).where(and(
        eq(planoOdontologico.titularNumeroOdontoprev, t.numeroOdontoprev), eq(planoOdontologico.tipo, "D"), eq(planoOdontologico.ativo, true)));
      const linhas: LinhaPlano[] = [t, ...deps].map((b) => {
        const valor = r2(Number(b.valor));
        const empresaPaga = b.tipo === "T" ? Math.min(6.95, valor) : 0; // 50% do Integral DOC, só titular
        return {
          nome: b.nome, numero: b.numeroOdontoprev, tipo: b.tipo as "T" | "D",
          parentesco: b.tipo === "T" ? "Titular" : PARENTESCO[b.parentesco] ?? "Dependente",
          plano: b.plano, valor, empresaPaga, colaboradorPaga: r2(valor - empresaPaga),
        };
      });
      odonto = { empresa: t.empresa, plano: t.plano, linhas, total: totais(linhas) };
    }
  } catch {
    odonto = null; // tabela do odontológico ainda não criada
  }
  return { saude, odonto };
}

export const planosColaboradorProcedure = protectedProcedure
  .input(z.object({ colaboradorId: z.number().int() }))
  .query(({ input }) => planosDoColaborador(input.colaboradorId));
