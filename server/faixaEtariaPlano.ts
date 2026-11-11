import { eq } from "drizzle-orm";
import { colaboradores, dependentes, planoSaude, tabelaPrecos } from "../drizzle/schema";
import { getDb } from "./db";
import { decidirFaixa, idadeNaData, type FaixaPrecoBase } from "../shared/faixaEtaria";

const soDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
const normNome = (s: string | null | undefined) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const paraIso = (d: unknown): string | null => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

export type ResultadoFaixas = {
  verificados: number;
  semDataNascimento: number;
  datasCompletadas: number;
  idadesAtualizadas: number;
  valoresAlterados: { nome: string; numeroBeneficiario: string; idade: number; de: number; para: number }[];
  /** Idade gravada diferente da data de nascimento em mais de 1 ano (ou menor): nada foi alterado. */
  aConferir: { nome: string; numeroBeneficiario: string; idadeGravada: number; idadePelaData: number; dataNascimento: string }[];
};

/**
 * Atualiza idade e mensalidade dos beneficiários ativos do plano de saúde conforme a data de nascimento.
 * A data vem do próprio beneficiário; se faltar, do cadastro do colaborador (titular, por vínculo ou CPF)
 * ou dos dependentes da ficha de registro (por CPF ou nome). Quando a idade muda de faixa na tabela de preços,
 * a mensalidade passa a ser o valor da tabela e o total da família do titular é recalculado.
 */
export async function atualizarFaixasEtariasPlanoSaude(hoje: Date = new Date()): Promise<ResultadoFaixas> {
  const db = await getDb();
  const res: ResultadoFaixas = { verificados: 0, semDataNascimento: 0, datasCompletadas: 0, idadesAtualizadas: 0, valoresAlterados: [], aConferir: [] };
  if (!db) return res;

  const [benefs, precosRaw, colabs, deps] = await Promise.all([
    db.select().from(planoSaude).where(eq(planoSaude.ativo, true)),
    db.select().from(tabelaPrecos),
    db.select({ id: colaboradores.id, cpf: colaboradores.cpf, dataNascimento: colaboradores.dataNascimento }).from(colaboradores),
    db.select({ cpf: dependentes.cpf, nome: dependentes.nome, dataNascimento: dependentes.dataNascimento }).from(dependentes),
  ]);
  const precos = precosRaw as unknown as FaixaPrecoBase[];

  const colabPorId = new Map(colabs.map((c) => [c.id, paraIso(c.dataNascimento)]));
  const colabPorCpf = new Map(colabs.filter((c) => soDigitos(c.cpf).length === 11).map((c) => [soDigitos(c.cpf), paraIso(c.dataNascimento)]));
  const depPorCpf = new Map(deps.filter((d) => soDigitos(d.cpf).length === 11).map((d) => [soDigitos(d.cpf), paraIso(d.dataNascimento)]));
  const depPorNome = new Map<string, string | null>();
  for (const d of deps) {
    const k = normNome(d.nome);
    depPorNome.set(k, depPorNome.has(k) ? null : paraIso(d.dataNascimento)); // nome repetido → ambíguo, não usa
  }

  const titularesAfetados = new Set<string>();
  for (const b of benefs) {
    res.verificados++;
    let data = paraIso(b.dataNascimento);
    let completouData = false;
    if (!data) {
      const cpf = soDigitos(b.cpf);
      data = b.tipo === "T"
        ? (b.colaboradorId ? colabPorId.get(b.colaboradorId) ?? null : null) ?? (cpf ? colabPorCpf.get(cpf) ?? null : null)
        : (cpf ? depPorCpf.get(cpf) ?? null : null) ?? depPorNome.get(normNome(b.nome)) ?? null;
      completouData = !!data;
    }
    if (!data) { res.semDataNascimento++; continue; }
    const idade = idadeNaData(data, hoje);
    if (idade === null) { res.semDataNascimento++; continue; }

    const decisao = decidirFaixa(precos, { empresa: b.empresa, plano: b.plano, tipo: b.tipo as "T" | "D", idade: b.idade, mensalidade: b.mensalidade }, idade);
    if (decisao.acao === "divergente") {
      res.aConferir.push({ nome: b.nome, numeroBeneficiario: b.numeroBeneficiario, idadeGravada: b.idade, idadePelaData: decisao.idade, dataNascimento: data });
      continue; // não completa a data nem mexe no valor até alguém conferir
    }
    const upd: Partial<typeof planoSaude.$inferInsert> = {};
    if (completouData) { upd.dataNascimento = data; res.datasCompletadas++; }
    if (decisao.acao === "idade" || decisao.acao === "faixa") { upd.idade = decisao.idade; res.idadesAtualizadas++; }
    if (decisao.acao === "faixa" && Math.abs(decisao.mensalidade - Number(b.mensalidade)) > 0.004) {
      upd.mensalidade = decisao.mensalidade.toFixed(2);
      res.valoresAlterados.push({ nome: b.nome, numeroBeneficiario: b.numeroBeneficiario, idade: decisao.idade, de: Number(b.mensalidade), para: decisao.mensalidade });
      const numTitular = b.tipo === "T" ? b.numeroBeneficiario : b.titularNumeroBeneficiario;
      if (numTitular) titularesAfetados.add(numTitular);
    }
    if (Object.keys(upd).length) {
      upd.updatedAt = new Date();
      await db.update(planoSaude).set(upd).where(eq(planoSaude.id, b.id));
    }
  }

  // Recalcula o total da família dos titulares cujo valor (dele ou de dependente) mudou.
  const { recalcularTotalFamilia } = await import("./planoSaudeExclusao");
  for (const numTitular of Array.from(titularesAfetados)) await recalcularTotalFamilia(numTitular);

  if (res.valoresAlterados.length) {
    console.log(`[faixa etária] ${res.valoresAlterados.length} mensalidade(s) atualizada(s):`,
      res.valoresAlterados.map((v) => `${v.numeroBeneficiario} ${v.idade}a ${v.de}→${v.para}`).join("; "));
  }
  return res;
}

let _agendado: ReturnType<typeof setInterval> | null = null;
/** Roda a atualização 1 minuto após o servidor subir e depois a cada 6 horas. */
export function agendarAtualizacaoFaixasEtarias() {
  if (_agendado) return;
  const rodar = () => atualizarFaixasEtariasPlanoSaude().catch((e) => console.error("[faixa etária] falhou:", e?.message ?? e));
  setTimeout(rodar, 60_000);
  _agendado = setInterval(rodar, 6 * 60 * 60 * 1000);
}
