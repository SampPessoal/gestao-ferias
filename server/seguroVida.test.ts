import { describe, expect, it } from "vitest";
import { divisaoSeguro } from "../client/src/lib/seguroVida";
describe("divisaoSeguro", () => {
  it("divide 50% e o centavo que sobra fica com o colaborador", () => {
    expect(divisaoSeguro(10.12)).toEqual({ valor: 10.12, empresa: 5.06, colaborador: 5.06 });
    expect(divisaoSeguro(8.27)).toEqual({ valor: 8.27, empresa: 4.13, colaborador: 4.14 });
    expect(divisaoSeguro(6.14)).toEqual({ valor: 6.14, empresa: 3.07, colaborador: 3.07 });
    expect(divisaoSeguro(6.33)).toEqual({ valor: 6.33, empresa: 3.16, colaborador: 3.17 });
    expect(divisaoSeguro(null)).toBeNull();
  });
});
