export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ── Auxílio Creche ──────────────────────────────────────────────────────────
export const SALARIO_BASE_CRECHE = 1685.93;
export const CRECHE_PERC_0_2 = 0.30;   // 30% para filhos de 0 a 2 anos
export const CRECHE_PERC_2_5 = 0.20;   // 20% para filhos de 2a1d a 5 anos

export const CRECHE_VALOR_0_2 = parseFloat((SALARIO_BASE_CRECHE * CRECHE_PERC_0_2).toFixed(2)); // R$ 505.78
export const CRECHE_VALOR_2_5 = parseFloat((SALARIO_BASE_CRECHE * CRECHE_PERC_2_5).toFixed(2)); // R$ 337.19

/**
 * Calcula o valor do Auxílio Creche com base na data de nascimento do filho.
 * Regra:
 *   - 0 a 730 dias (0 a 2 anos): 30% do salário base = R$ 505,78
 *   - 731 dias a 5 anos completos: 20% do salário base = R$ 337,19
 *   - Acima de 5 anos: não recebe (retorna 0)
 * @param dataNascimento - Data de nascimento do filho (string ISO ou Date)
 * @param dataRef - Data de referência para cálculo (padrão: hoje)
 */
export function calcularValorCreche(dataNascimento: string | Date, dataRef?: Date): number {
  const nasc = new Date(dataNascimento);
  const ref = dataRef ?? new Date();

  const diasVividos = Math.floor((ref.getTime() - nasc.getTime()) / (1000 * 60 * 60 * 24));

  // Calcular anos completos
  let anosCompletos = ref.getFullYear() - nasc.getFullYear();
  const mesRef = ref.getMonth();
  const mesNasc = nasc.getMonth();
  if (mesRef < mesNasc || (mesRef === mesNasc && ref.getDate() < nasc.getDate())) {
    anosCompletos--;
  }

  if (diasVividos <= 730) {
    // 0 a 2 anos (inclusive 730 dias)
    return CRECHE_VALOR_0_2;
  } else if (anosCompletos < 5) {
    // 2 anos e 1 dia até 4 anos e 364 dias
    return CRECHE_VALOR_2_5;
  } else {
    // 5 anos ou mais — não recebe
    return 0;
  }
}
