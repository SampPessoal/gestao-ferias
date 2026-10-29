import { describe, it, expect } from "vitest";
import { lerPlanejamento } from "../shared/planejamento";

describe("Leitura do planejamento de férias", () => {
  it("lê o formato da máscara", () => {
    expect(lerPlanejamento("01/12/2026 a 15/12/2026")).toEqual({ inicio: "2026-12-01", fim: "2026-12-15", dias: 15 });
  });
  it("aceita outros separadores", () => {
    expect(lerPlanejamento("01/12/2026 até 30/12/2026")?.dias).toBe(30);
    expect(lerPlanejamento("1/7/2027 - 15/7/2027")?.inicio).toBe("2027-07-01");
  });
  it("atravessa o ano", () => {
    expect(lerPlanejamento("20/12/2026 a 08/01/2027")).toEqual({ inicio: "2026-12-20", fim: "2027-01-08", dias: 20 });
  });
  it("recusa textos que não dá para ler", () => {
    expect(lerPlanejamento("dezembro")).toBeNull();
    expect(lerPlanejamento("15/12/2026")).toBeNull();
    expect(lerPlanejamento("31/02/2026 a 10/03/2026")).toBeNull();
    expect(lerPlanejamento("15/12/2026 a 01/12/2026")).toBeNull();
    expect(lerPlanejamento("")).toBeNull();
  });
});
