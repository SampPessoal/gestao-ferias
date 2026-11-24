import { describe, expect, it } from "vitest";
import { diasPerdidosAntecipacao, umMesAntesIso } from "../shared/penalidadeFerias";
describe("diasPerdidosAntecipacao", () => {
  it("Jeferson: saída 14/12/2026, vencimento 12/01/2027, com venda → 1 dia", () => {
    expect(diasPerdidosAntecipacao({ dataSaida: "2026-12-14", vencimento: "2027-01-12", venda10: true, diasGozados: 10 })).toBe(1);
  });
  it("Kailan: 15 dias fracionados no mês anterior → 1 dia", () => {
    expect(diasPerdidosAntecipacao({ dataSaida: "2026-06-17", vencimento: "2026-07-03", venda10: false, diasGozados: 15 })).toBe(1);
  });
  it("30 corridos no mês anterior → 2 dias", () => {
    expect(diasPerdidosAntecipacao({ dataSaida: "2026-06-17", vencimento: "2026-07-03", venda10: false, diasGozados: 30 })).toBe(2);
  });
  it("a partir do vencimento ou antes da janela → 0", () => {
    expect(diasPerdidosAntecipacao({ dataSaida: "2026-07-03", vencimento: "2026-07-03", venda10: false, diasGozados: 30 })).toBe(0);
    expect(diasPerdidosAntecipacao({ dataSaida: "2026-05-01", vencimento: "2026-07-03", venda10: false, diasGozados: 30 })).toBe(0);
  });
  it("um mês antes ajusta fim de mês", () => {
    expect(umMesAntesIso("2027-03-31")).toBe("2027-02-28");
    expect(umMesAntesIso("2027-01-12")).toBe("2026-12-12");
  });
});
