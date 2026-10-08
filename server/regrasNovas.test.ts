import { describe, it, expect } from "vitest";
import { umMesAntes, situacaoSaida, diasPerdidosPenalidade } from "@/lib/ferias";

describe("Janela de 1 mês antes do vencimento", () => {
  it("calcula o mesmo dia do mês anterior", () => {
    expect(umMesAntes("2025-02-28")).toBe("2025-01-28");
    expect(umMesAntes("2025-01-15")).toBe("2024-12-15");
  });
  it("usa o último dia do mês quando o dia não existe", () => {
    expect(umMesAntes("2025-03-31")).toBe("2025-02-28");
    expect(umMesAntes("2024-03-30")).toBe("2024-02-29"); // ano bissexto
  });
  it("classifica as saídas (exemplo: vencimento 28/02/2025)", () => {
    const venc = "2025-02-28";
    expect(situacaoSaida("2025-01-27", venc)).toBe("bloqueada");
    expect(situacaoSaida("2025-01-28", venc)).toBe("com_penalidade");
    expect(situacaoSaida("2025-01-31", venc)).toBe("com_penalidade");
    expect(situacaoSaida("2025-02-27", venc)).toBe("com_penalidade");
    expect(situacaoSaida("2025-02-28", venc)).toBe("normal");
    expect(situacaoSaida("2025-06-02", venc)).toBe("normal");
  });
});

describe("Dias perdidos na saída antecipada", () => {
  it("30 dias corridos perde 2", () => {
    expect(diasPerdidosPenalidade({ venda10: false, diasGozados: 30 }).dias).toBe(2);
  });
  it("20 dias com venda de 10 perde 1", () => {
    expect(diasPerdidosPenalidade({ venda10: true, diasGozados: 20 }).dias).toBe(1);
  });
  it("fracionada perde 1 no total", () => {
    expect(diasPerdidosPenalidade({ venda10: false, diasGozados: 15 })).toEqual({ dias: 1, motivo: "fracionada" });
  });
});
