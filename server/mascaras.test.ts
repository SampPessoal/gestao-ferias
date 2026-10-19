import { describe, it, expect } from "vitest";
import {
  mascaraCpf, mascaraRg, mascaraTelefone, mascaraCelular, mascaraTituloEleitor, mascaraSerieCtps,
  mascaraAgencia, mascaraConta, mascaraChavePix, mascaraInteiro, mascaraPeriodo, lerReais, formatarReais,
} from "../client/src/lib/mascaras";

describe("Máscaras de digitação", () => {
  it("documentos", () => {
    expect(mascaraCpf("09839314530")).toBe("098.393.145-30");
    expect(mascaraCpf("098.393")).toBe("098.393");
    expect(mascaraRg("2101867478")).toBe("21.018.674-78");
    expect(mascaraTituloEleitor("183440071054")).toBe("1834 4007 1054");
    expect(mascaraSerieCtps("0040ba")).toBe("0040-BA");
  });
  it("telefones", () => {
    expect(mascaraTelefone("7131770000")).toBe("(71) 3177-0000");
    expect(mascaraCelular("71987203198")).toBe("(71) 9 8720-3198");
  });
  it("banco e PIX", () => {
    expect(mascaraAgencia("31585")).toBe("3158-5");
    expect(mascaraConta("2233193")).toBe("223319-3");
    expect(mascaraChavePix("cpf", "09839314530")).toBe("098.393.145-30");
    expect(mascaraChavePix("telefone", "71987203198")).toBe("(71) 9 8720-3198");
    expect(mascaraChavePix("email", "Joao@Empresa.com")).toBe("Joao@Empresa.com");
  });
  it("números e períodos", () => {
    expect(mascaraInteiro("12a3", 2)).toBe("12");
    expect(mascaraPeriodo("0103202428022025")).toBe("01/03/2024 a 28/02/2025");
  });
  it("valores em reais", () => {
    expect(lerReais("39.52")).toBe(39.52);
    expect(lerReais("39,52")).toBe(39.52);
    expect(lerReais("1.234,56")).toBe(1234.56);
    expect(lerReais("")).toBeNull();
    expect(formatarReais(1234.5)).toBe("1.234,50");
  });
});
