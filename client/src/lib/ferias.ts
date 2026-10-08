import { differenceInDays, parseISO, isValid } from "date-fns";

/**
 * Status de alerta de férias — baseado em PROXIMIDADE da data limite, não em vencimento.
 *
 * urgente  → passou da data limite (precisa de ação imediata)
 * critico  → ≤ 30 dias para a data limite (vermelho)
 * alerta   → ≤ 60 dias para a data limite (laranja)
 * atencao  → ≤ 90 dias para a data limite (amarelo)
 * em_dia   → > 90 dias para a data limite (verde)
 * sem_data → sem data limite cadastrada
 */
export type StatusFerias = "urgente" | "critico" | "alerta" | "atencao" | "em_dia" | "sem_data";

// Normaliza Date | string | null para string ISO "YYYY-MM-DD"
// IMPORTANTE: usa UTC para evitar bug de timezone (GMT-3 converte UTC midnight para dia anterior)
export function toDateStr(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).split("T")[0];
  return s || null;
}

// Retorna a data de hoje no fuso de Brasília (UTC-3) como string "YYYY-MM-DD"
function hojeUTC3(): string {
  const agora = new Date();
  const offsetBrasilia = -3 * 60;
  const localMs = agora.getTime() + (agora.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
  const hojeLocal = new Date(localMs);
  return `${hojeLocal.getUTCFullYear()}-${String(hojeLocal.getUTCMonth()+1).padStart(2,'0')}-${String(hojeLocal.getUTCDate()).padStart(2,'0')}`;
}

export function calcularStatus(dataLimite: Date | string | null | undefined): StatusFerias {
  const dl = toDateStr(dataLimite);
  if (!dl) return "sem_data";
  try {
    const hojeStr = hojeUTC3();
    const [ly, lm, ld] = dl.split("-").map(Number);
    const [hy, hm, hd] = hojeStr.split("-").map(Number);
    const limiteMs = Date.UTC(ly, lm - 1, ld);
    const hojeMs = Date.UTC(hy, hm - 1, hd);
    const diff = Math.round((limiteMs - hojeMs) / 86400000);

    if (diff < 0) return "urgente";   // passou da data limite
    if (diff <= 30) return "critico"; // ≤ 30 dias → vermelho
    if (diff <= 60) return "alerta";  // ≤ 60 dias → laranja
    if (diff <= 90) return "atencao"; // ≤ 90 dias → amarelo
    return "em_dia";                  // > 90 dias → verde
  } catch {
    return "sem_data";
  }
}

export function statusLabel(status: StatusFerias): string {
  const map: Record<StatusFerias, string> = {
    urgente:  "Urgente — passou da data limite",
    critico:  "Crítico — ≤ 30 dias",
    alerta:   "Alerta — ≤ 60 dias",
    atencao:  "Atenção — ≤ 90 dias",
    em_dia:   "Em dia",
    sem_data: "Sem data",
  };
  return map[status];
}

export function statusLabelCurto(status: StatusFerias): string {
  const map: Record<StatusFerias, string> = {
    urgente:  "Urgente",
    critico:  "Crítico",
    alerta:   "Alerta",
    atencao:  "Atenção",
    em_dia:   "Em dia",
    sem_data: "Sem data",
  };
  return map[status];
}

export function statusColor(status: StatusFerias): string {
  const map: Record<StatusFerias, string> = {
    urgente:  "bg-red-200 text-red-900 border-red-400",
    critico:  "bg-red-100 text-red-800 border-red-300",
    alerta:   "bg-orange-100 text-orange-800 border-orange-300",
    atencao:  "bg-amber-100 text-amber-800 border-amber-300",
    em_dia:   "bg-emerald-100 text-emerald-800 border-emerald-200",
    sem_data: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return map[status];
}

export function statusDot(status: StatusFerias): string {
  const map: Record<StatusFerias, string> = {
    urgente:  "bg-red-600",
    critico:  "bg-red-500",
    alerta:   "bg-orange-500",
    atencao:  "bg-amber-500",
    em_dia:   "bg-emerald-500",
    sem_data: "bg-gray-400",
  };
  return map[status];
}

export function statusRowBg(status: StatusFerias): string {
  const map: Record<StatusFerias, string> = {
    urgente:  "bg-red-50/70",
    critico:  "bg-red-50/40",
    alerta:   "bg-orange-50/40",
    atencao:  "bg-amber-50/30",
    em_dia:   "",
    sem_data: "",
  };
  return map[status];
}

export function formatDate(val: Date | string | null | undefined): string {
  const dl = toDateStr(val);
  if (!dl) return "—";
  const [y, m, d] = dl.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

// Alias para compatibilidade
export const formatDateBR = formatDate;

/**
 * Calcula vencimento e data limite CLT a partir do período aquisitivo.
 *
 * Regra CLT (vale para qualquer período — 1º, 2º, 3º...):
 *   - Período aquisitivo = data base informada (não muda)
 *   - Vencimento        = período aquisitivo + 1 ano - 1 dia
 *   - Data limite       = vencimento + 11 meses + 1 dia
 *
 * Para colaboradores já avançados (admitidos em 2015, 2018 etc.),
 * passe o período aquisitivo ATUAL cadastrado — não a admissão.
 *
 * @param periodoAquisitivoIso  Período aquisitivo no formato "YYYY-MM-DD"
 */
export function calcPeriodoFerias(periodoAquisitivoIso: string): {
  periodoAquisitivo: string;
  vencimento: string;
  dataLimite: string;
} {
  const [y, m, d] = periodoAquisitivoIso.split('-').map(Number);
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const vencDate = new Date(y + 1, m - 1, d - 1);
  const limDate  = new Date(vencDate);
  limDate.setMonth(limDate.getMonth() + 11);
  limDate.setDate(limDate.getDate() + 1);
  return {
    periodoAquisitivo: periodoAquisitivoIso,
    vencimento: toIso(vencDate),
    dataLimite: toIso(limDate),
  };
}

/**
 * Avança para o próximo período aquisitivo (soma 1 ano ao atual)
 * e recalcula vencimento e data limite.
 *
 * Exemplo:
 *   avancarPeriodoFerias("2026-07-20")
 *   → { periodoAquisitivo: "2027-07-20", vencimento: "2028-07-19", dataLimite: "2029-06-20" }
 *
 * @param periodoAquisitivoIso  Período aquisitivo atual no formato "YYYY-MM-DD"
 */
export function avancarPeriodoFerias(periodoAquisitivoIso: string): {
  periodoAquisitivo: string;
  vencimento: string;
  dataLimite: string;
} {
  const [y, m, d] = periodoAquisitivoIso.split('-').map(Number);
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const novoPA = new Date(y + 1, m - 1, d);
  return calcPeriodoFerias(toIso(novoPA));
}

export function diasRestantes(dataLimite: Date | string | null | undefined): number | null {
  const dl = toDateStr(dataLimite);
  if (!dl) return null;
  try {
    const hojeStr = hojeUTC3();
    const [ly, lm, ld] = dl.split("-").map(Number);
    const [hy, hm, hd] = hojeStr.split("-").map(Number);
    const limiteMs = Date.UTC(ly, lm - 1, ld);
    const hojeMs = Date.UTC(hy, hm - 1, hd);
    return Math.round((limiteMs - hojeMs) / 86400000);
  } catch {
    return null;
  }
}

// ─── Janela de saída antecipada e penalidade ──────────────────────────────────
// Regra da contabilidade: o colaborador pode sair até 1 mês ANTES do vencimento
// do período aquisitivo, mas perde dias:
//   • 30 dias corridos ............. perde 2 dias
//   • 20 dias + venda de 10 ........ perde 1 dia
//   • férias fracionadas ........... perde 1 dia no total
// Saída no próprio dia do vencimento (ou depois) não tem penalidade.
// Saída com mais de 1 mês de antecedência é bloqueada.

/** Mesmo dia do mês anterior; se não existir (ex.: 31/03 → 31/02), usa o último dia do mês. */
export function umMesAntes(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const ultimoDiaMesAnterior = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDiaMesAnterior);
  const ref = new Date(Date.UTC(y, m - 2, dia));
  return `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}-${String(ref.getUTCDate()).padStart(2, "0")}`;
}

export type SituacaoSaida = "bloqueada" | "com_penalidade" | "normal";

/** Classifica a data de saída em relação ao vencimento (datas em YYYY-MM-DD). */
export function situacaoSaida(saidaIso: string, vencimentoIso: string): SituacaoSaida {
  if (saidaIso >= vencimentoIso) return "normal";
  if (saidaIso >= umMesAntes(vencimentoIso)) return "com_penalidade";
  return "bloqueada";
}

/** Dias perdidos quando a saída cai dentro do mês anterior ao vencimento. */
export function diasPerdidosPenalidade(opts: {
  venda10: boolean;
  diasGozados: number;
  diasDireito?: number;
}): { dias: number; motivo: "venda" | "fracionada" | "corridos" } {
  const direito = opts.diasDireito ?? 30;
  if (opts.venda10) return { dias: 1, motivo: "venda" };
  if (opts.diasGozados < direito) return { dias: 1, motivo: "fracionada" };
  return { dias: 2, motivo: "corridos" };
}
