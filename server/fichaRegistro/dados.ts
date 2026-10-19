/**
 * Dados do colaborador usados na Ficha de Registro e o mapeamento de cada campo
 * do modelo para o dado correspondente do cadastro.
 */
import { and, desc, eq } from "drizzle-orm";
import { colaboradores, planoSaude } from "../../drizzle/schema";
import { getColaboradorById, getDb } from "../db";
import type { MapaPreenchimento } from "./index";
import { lerRegistroEmpregado } from "../registroEmpregado";
import { ehNaoSeAplica } from "../../shared/registroEmpregado";
import { escolherModelo } from "./index";

export type DadosFichaRegistro = NonNullable<Awaited<ReturnType<typeof getColaboradorById>>> & {
  valorVR: string | null;
  valorVT: string | null;
  auxilioVeiculo: string | null;
  auxilioVeiculoFolha: string | null;
  auxilioCelularFolha: string | null;
  planoSaude: { titular: boolean; conjuge?: Dependente; filhos: Dependente[] } | null;
  /** Registro de Empregado: campos complementares, dependentes e auxílio notebook */
  registro?: Awaited<ReturnType<typeof lerRegistroEmpregado>>;
};
type Dependente = { nome: string; nascimento: string | null; cpf: string | null; rg?: string | null };

/** Lê do banco, na hora, tudo o que a ficha precisa (sem cache). */
export async function carregarDadosFichaRegistro(id: number): Promise<DadosFichaRegistro | null> {
  const base = await getColaboradorById(id);
  if (!base) return null;
  const db = await getDb();
  if (!db) return null;

  const [extra] = await db
    .select({
      valorVR: colaboradores.valorVR,
      valorVT: colaboradores.valorVT,
      auxilioVeiculo: colaboradores.auxilioVeiculo,
      auxilioVeiculoFolha: colaboradores.auxilioVeiculoFolha,
      auxilioCelularFolha: colaboradores.auxilioCelularFolha,
    })
    .from(colaboradores)
    .where(eq(colaboradores.id, id))
    .limit(1);

  // Plano de saúde: competência mais recente em que o colaborador é titular
  let plano: DadosFichaRegistro["planoSaude"] = null;
  const [titular] = await db
    .select()
    .from(planoSaude)
    .where(and(eq(planoSaude.colaboradorId, id), eq(planoSaude.tipo, "T"), eq(planoSaude.ativo, true)))
    .orderBy(desc(planoSaude.anoReferencia), desc(planoSaude.mesReferencia))
    .limit(1);
  if (titular) {
    const deps = await db
      .select()
      .from(planoSaude)
      .where(and(
        eq(planoSaude.empresa, titular.empresa),
        eq(planoSaude.titularNumeroBeneficiario, titular.numeroBeneficiario),
        eq(planoSaude.tipo, "D"),
        eq(planoSaude.ativo, true),
        eq(planoSaude.mesReferencia, titular.mesReferencia),
        eq(planoSaude.anoReferencia, titular.anoReferencia),
      ))
      .orderBy(planoSaude.id);
    const dep = (d: typeof deps[number]): Dependente => ({ nome: d.nome, nascimento: d.dataNascimento, cpf: d.cpf });
    const tipo = (d: typeof deps[number]) => (d.tipoDepend ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const conj = deps.find(d => tipo(d).includes("CONJUGE"));
    plano = {
      titular: true,
      conjuge: conj ? dep(conj) : undefined,
      filhos: deps.filter(d => /FILH/.test(tipo(d))).map(dep),
    };
  }

  const registro = await lerRegistroEmpregado(id);
  return { ...base, ...(extra ?? {}), planoSaude: plano, registro } as DadosFichaRegistro;
}

// ─── Formatação ──────────────────────────────────────────────────────────────

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const txt = (v: unknown): string | undefined => (vazio(v) ? undefined : String(v).trim());

/** AAAA-MM-DD (string ou Date) → DD/MM/AAAA, sem conversão de fuso. */
export function dataBR(v: unknown): string | undefined {
  if (vazio(v)) return undefined;
  let iso: string;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return undefined;
    iso = v.toISOString().slice(0, 10);
  } else iso = String(v).split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
}

/** Valor monetário do banco ("12.50") → "12,50". Zero ou vazio = sem valor. */
function moeda(v: unknown): string | undefined {
  if (vazio(v)) return undefined;
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return undefined;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** CNPJ → 00.000.000/0000-00 (mantém como está se não tiver 14 dígitos). */
function cnpjFmt(v: unknown): string | undefined {
  const s = txt(v);
  if (!s) return undefined;
  const d = s.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : s;
}

/** CPF só com dígitos → 000.000.000-00 (mantém como está se não tiver 11 dígitos). */
function cpfFmt(v: unknown): string | undefined {
  const s = txt(v);
  if (!s) return undefined;
  const d = s.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : s;
}

function idadeEm(nascIso: string, hojeIso: string): number {
  const [na, nm, nd] = nascIso.split("-").map(Number);
  const [ra, rm, rd] = hojeIso.split("-").map(Number);
  let i = ra - na;
  if (rm < nm || (rm === nm && rd < nd)) i--;
  return i;
}

const ESTADOS_CIVIS: Record<string, string> = {
  solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)", uniao_estavel: "União Estável", outro: "Outro",
};

// ─── Mapeamento campo do modelo → dado do cadastro ───────────────────────────

export function montarMapaFichaRegistro(c: DadosFichaRegistro, hojeIso: string): MapaPreenchimento {
  const nasc = dataBR(c.dataNascimento);
  const nascIso = nasc ? nasc.split("/").reverse().join("-") : null;

  const endereco = [
    [txt(c.enderecoLogradouro), txt(c.enderecoNumero)].filter(Boolean).join(", "),
    txt(c.enderecoComplemento),
    txt(c.enderecoBairro),
    [txt(c.enderecoCidade), txt(c.enderecoEstado)].filter(Boolean).join("/"),
  ].filter(Boolean).join(" - ") || undefined;

  const expedicao = [dataBR(c.rgExpedicao), txt(c.rgOrgaoExpedidor)].filter(Boolean).join(" - ") || undefined;

  const ctps = c.ctpsDigital
    ? (txt(c.ctpsNumero) ? `${txt(c.ctpsNumero)} (CTPS Digital)` : undefined)
    : [txt(c.ctpsNumero), txt(c.ctpsSerie)].filter(Boolean).join(" / ") || undefined;

  const titulo = txt(c.tituloEleitor)
    ? [txt(c.tituloEleitor), txt(c.zonaEleitoral) && `Zona ${txt(c.zonaEleitoral)}`, txt(c.secaoEleitoral) && `Seção ${txt(c.secaoEleitoral)}`]
        .filter(Boolean).join(" — ")
    : undefined;

  const emergencia = txt(c.contatoEmergenciaTelefone)
    ? `${txt(c.contatoEmergenciaTelefone)}${txt(c.contatoEmergenciaNome) ? ` (${txt(c.contatoEmergenciaNome)})` : ""}`
    : undefined;

  const banco = c.bancoCodigo && c.bancoNome ? `${c.bancoCodigo.trim()} – ${c.bancoNome.trim()}` : txt(c.bancoNome || c.bancoCodigo);

  const auxTel = moeda(c.auxilioCelularFolha);
  const auxVeic = moeda(c.auxilioVeiculoFolha) ?? moeda(c.auxilioVeiculo);
  const vt = moeda(c.valorVT);
  const vr = moeda(c.valorVR);

  const plano = c.planoSaude;
  const r = c.registro?.campos ?? {};
  const deps = c.registro?.dependentes ?? [];
  // Dependentes: cadastro próprio; quem ainda não tem, usa os do plano de saúde
  const depConj = deps.find(d => d.parentesco === "conjuge");
  const depFilhos = deps.filter(d => ["filho", "filha", "enteado"].includes(d.parentesco));
  const conj: Dependente | undefined = depConj
    ? { nome: depConj.nome, nascimento: depConj.dataNascimento, cpf: depConj.cpf, rg: depConj.rg }
    : plano?.conjuge;
  const filhos: Dependente[] = depFilhos.length
    ? depFilhos.map(d => ({ nome: d.nome, nascimento: d.dataNascimento, cpf: d.cpf, rg: d.rg }))
    : plano?.filhos ?? [];
  const filho = filhos[0];
  const outrosFilhos = filhos.length - 1;

  const op = (chave: string, mapa: Record<string, string>) => (r[chave] ? [mapa[r[chave]!]].filter(Boolean) : []);
  const remuneracao = moeda(r.remuneracao);
  const cnh = ehNaoSeAplica(r.cnhNumero) ? "NÃO SE APLICA"
    : txt(r.cnhNumero)
    ? [txt(r.cnhNumero), r.cnhCategoria && `Cat. ${r.cnhCategoria}`, dataBR(r.cnhValidade) && `Val. ${dataBR(r.cnhValidade)}`].filter(Boolean).join(" — ")
    : undefined;
  const supervisor = [r.supervisorNome, r.supervisorCpf, r.supervisorFuncao].some(v => txt(v))
    ? `NOME: ${txt(r.supervisorNome) ?? "…"}     CPF: ${cpfFmt(r.supervisorCpf) ?? "…"}\nFUNÇÃO: ${txt(r.supervisorFuncao) ?? "…"}`
    : undefined;
  const instituicao = txt(r.instituicaoEnsino) || txt(r.instituicaoCnpj)
    ? `${txt(r.instituicaoEnsino) ?? "…"}\n\nCNPJ: ${cnpjFmt(r.instituicaoCnpj) ?? "… / … - …"}`
    : undefined;
  const jornada = txt(r.jornadaEntrada) || txt(r.jornadaSaida) || txt(r.jornadaIntervalo)
    ? `DAS ${txt(r.jornadaEntrada) ?? "… : …"}  ÀS ${txt(r.jornadaSaida) ?? "… : …"}\n\nC/ ${txt(r.jornadaIntervalo) ?? "…"} H DE INTERVALO`
    : undefined;
  const semestreNum = r.semestre && /^\d+$/.test(r.semestre) ? r.semestre : null;
  const nb = c.registro?.notebook;
  const nbValor = nb?.ativo ? moeda(nb.valor) : undefined;
  const depIR = deps.length ? (deps.some(d => d.dependenteIR) ? "SIM" : "NÃO") : undefined;
  const empresaFicha = escolherModelo(c.empresaNome)?.empresa ?? (txt(c.empresaNome) ?? "").toUpperCase();
  const RACA: Record<string, string> = { preta: "PRETA", branca: "BRANCA", parda: "PARDA", amarela: "AMARELA", indigena: "INDIGENA" };

  const mapa: MapaPreenchimento = {
    "NOME COMPLETO": { valores: [txt(c.nome)] },
    "FILIACAO — PAI": { valores: [txt(c.nomePai)] },
    "FILIACAO — MAE": { valores: [txt(c.nomeMae)] },
    // NACIONALIDADE e NACIONALIDADE#2 são as do pai e da mãe: o cadastro não tem esse dado
    "DATA DE NASCIMENTO": { valores: [nasc] },
    "IDADE": { valores: [nascIso ? `${idadeEm(nascIso, hojeIso)} anos` : undefined] },
    "NACIONALIDADE#3": { valores: [txt(c.nacionalidade)] },
    "NATURALIDADE": { valores: [txt(c.naturalidade)] },
    "ESTADO": { valores: [txt(c.estado)] },
    "SEXO": { marcar: c.sexo === "masculino" ? ["MASCULINO", "MASC."] : c.sexo === "feminino" ? ["FEMININO", "FEM."] : [] },
    "ESTADO CIVIL": { valores: [c.estadoCivil ? ESTADOS_CIVIS[c.estadoCivil] ?? txt(c.estadoCivil) : undefined] },
    "FILHOS (AS)": { marcar: c.temFilhos === true ? ["SIM"] : c.temFilhos === false ? ["NÃO"] : [] },
    "QUANTIDADE": { valores: [c.temFilhos ? String(c.qtdFilhos ?? 0) : c.temFilhos === false ? "0" : undefined] },
    "CEDULA DE IDENTIDADE / RG": { valores: [txt(c.rg)] },
    "EXPEDICAO RG": { valores: [expedicao] },
    "CPF / CIC": { valores: [txt(c.cpf)] },
    "CTPS — SERIE / UF": { valores: [[ctps, txt(r.ctpsUf)].filter(Boolean).join(" / ") || undefined] },
    "TITULO DE ELEITOR — ZONA / SECAO": { valores: [titulo] },
    "PIS": { valores: [txt(c.pis)] },
    "CNH": { valores: [cnh] },
    "RACA": r.raca ? { substituir: [[`\\b(${RACA[r.raca]})\\s*\\(\\s*\\)`, "", "$1 (X)"]] } : {},
    "NACIONALIDADE": { valores: [txt(r.nacionalidadePai)] },
    "NACIONALIDADE#2": { valores: [txt(r.nacionalidadeMae)] },
    "E-MAIL PESSOAL": { valores: [txt(r.emailPessoal)] },
    "CBO": { valores: [txt(r.cbo)] },
    "REMUNERACAO": { valorMonetario: true, valores: [remuneracao] },
    "SUPERVISOR / CPF": supervisor ? { reescrever: supervisor } : {},
    "PERIODO DE ESTAGIO": { marcar: op("periodoEstagio", { sim: "SIM", nao_se_aplica: "NÃO SE APLICA" }) },
    // O modelo traz "SUDOESTE" impresso nas quatro empresas: troca pelo nome da empresa da ficha
    "EMPRESA": {
      substituir: [["\\bSUDOESTE\\b", "g", empresaFicha]],
      marcar: op("empresaEstagio", { a3_estagios: "A3 ESTÁGIOS", empresa: empresaFicha, sudoeste: empresaFicha, nao_se_aplica: "NÃO SE APLICA" }),
    },
    "APOLICE DE SEGURO": ehNaoSeAplica(r.apoliceSeguro) ? { marcar: ["NÃO SE APLICA"] }
      : txt(r.apoliceSeguro) ? { reescrever: `(  ) NÃO SE APLICA\nApólice nº ${txt(r.apoliceSeguro)}` } : {},
    "1º TRABALHO": { marcar: op("primeiroTrabalho", { sim: "SIM", nao: "NÃO", estagio: "ESTÁGIO" }) },
    "GRAU DE INSTRUCAO": { marcar: op("grauInstrucao", { ensino_medio: "ENSINO MÉDIO", graduacao: "GRADUAÇÃO", pos_graduacao: "PÓS-GRADUAÇÃO", mestrado: "MESTRADO" }) },
    "SITUACAO": { marcar: op("situacaoCurso", { em_andamento: "EM ANDAMENTO", concluida: "CONCLUÍDA", trancada: "TRANCADA" }) },
    "INSTITUICAO / CNPJ": instituicao ? { reescrever: instituicao } : {},
    "CURSO": { valores: [txt(r.curso)] },
    "SEMESTRE": semestreNum
      ? { substituir: [["\\(\\s*\\)\\s*SEMESTRE", "", `(X) ${semestreNum}º SEMESTRE`]] }
      : { marcar: r.semestre === "nao_se_aplica" ? ["NÃO SE APLICA"] : [] },
    "JORNADA": jornada ? { reescrever: jornada } : {},
    "VCT EXPERIENCIA": { marcar: op("contratoExperiencia", { "45_45": "45 + 45 DIAS", "01_ano": "01 ANO", nao_se_aplica: "NÃO SE APLICA" }) },
    "VINCULO": { marcar: op("vinculo", { clt: "CLT", estagio: "ESTÁGIO" }) },
    "SINDICATO": { marcar: op("sindicato", { sindados: "SINDADOS", a3_estagios: "A3 ESTÁGIOS" }) },
    "CONT. SINDICAL": { marcar: op("contribuicaoSindical", { sim: "SIM", nao: "NÃO", nao_se_aplica: "NÃO SE APLICA" }) },
    "AUXILIO NOTEBOOK": nb ? { valorMonetario: true, valores: [nbValor], marcar: [nb.ativo ? "SIM" : "NÃO"] } : {},
    "PLANO ODONTOLOGICO": { marcar: op("planoOdontologico", { sim: "SIM", nao: "NÃO", na: "N/A" }) },
    "TOTALPASS \\ GINASTICA LABORAL": { marcar: op("totalpass", { sim: "SIM", nao: "NÃO", na: "N/A" }) },
    "DESCONTO VALE TRANSPORTE": r.descontoVT === "sim" ? { substituir: [["\\(\\s*\\)(\\s*SIM)", "", "(X)$1"]] }
      : r.descontoVT === "opcao_nao" ? { substituir: [["(OPÇÃO NÃO\\s*)\\(\\s*\\)", "", "$1(X)"]] }
      : r.descontoVT === "na" ? { marcar: ["N/A"] } : {},
    "DEP. P/ IR": { marcar: depIR ? [depIR] : [] },
    "ENDERECO RESIDENCIAL": { valores: [endereco] },
    "CEP": { valores: [txt(c.enderecoCep)] },
    "TELEFONE DE EMERGENCIA": { valores: [emergencia] },
    "CELULAR": { valores: [txt(c.celular)] },
    "E-MAIL CORPORATIVO": { valores: [txt(c.emailCorporativo)] },
    "DATA DE ADMISSAO": { valores: [dataBR(c.admissao)] },
    "CARGO": { valores: [txt(c.cargo)] },
    "BANCO": { valores: [banco] },
    "NUMERO DA AGENCIA": { valores: [txt(c.bancoAgencia)] },
    "CONTA CORRENTE": { valores: [txt(c.bancoConta)] },
    "DEPARTAMENTO": { valores: [txt(c.setorNome)] },
    "AUXILIO TELEFONIA": { valorMonetario: true, valores: [auxTel], marcar: auxTel ? ["SIM"] : [] },
    "AUXILIO VEICULO": { valorMonetario: true, valores: [auxVeic], marcar: auxVeic ? ["SIM"] : [] },
    "VALE TRANSPORTE": { valorMonetario: true, valores: [vt], marcar: vt ? ["R$*"]
      : r.motivoSemVT === "home_office" ? ["NÃO SE APLICA EM REGIME HOME OFFICE"]
      : r.motivoSemVT === "opcao_nao" ? ["OPÇÃO POR NÃO"] : [] },
    "VALE REFEICAO": { valorMonetario: true, valores: [vr] },
    "OBSERVACAO FUNCIONAL": { valores: [txt(c.observacoes)] },
    "PLANO DE SAUDE": { marcar: plano?.titular ? ["SIM"] : [] },
    "SEGURO DE VIDA": { marcar: c.temSeguroVida === true ? ["SIM"] : c.temSeguroVida === false ? ["NÃO"] : [] },
    "CONJUGE": conj ? { valores: [txt(conj.nome), dataBR(conj.nascimento), cpfFmt(conj.cpf), txt(conj.rg)] } : {},
    "FILHOS (AS))": filho
      ? { valores: [`${filho.nome}${outrosFilhos > 0 ? ` (+${outrosFilhos})` : ""}`, dataBR(filho.nascimento), cpfFmt(filho.cpf)] }
      : {},
  };
  return mapa;
}
