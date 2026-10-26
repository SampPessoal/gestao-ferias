import { describe, it, expect } from "vitest";
import { contemTexto, textoBusca } from "../client/src/lib/busca";

describe("Pesquisa sem acentos", () => {
  it("ignora acentos, maiúsculas e espaços repetidos", () => {
    expect(contemTexto("JOÃO VITOR CONCEIÇÃO", "joao")).toBe(true);
    expect(contemTexto("JOÃO VITOR CONCEIÇÃO", "conceicao")).toBe(true);
    expect(contemTexto("JOÃO VITOR CONCEIÇÃO", "João Vitor")).toBe(true);
    expect(contemTexto("JOSÉ  ANTÔNIO", "jose antonio")).toBe(true);
    expect(contemTexto("MARIA DE FÁTIMA", "fatima")).toBe(true);
    expect(contemTexto("MARIA DE FÁTIMA", "joao")).toBe(false);
  });
  it("pesquisa vazia mostra tudo e texto vazio não quebra", () => {
    expect(contemTexto("QUALQUER", "")).toBe(true);
    expect(contemTexto(null, "joao")).toBe(false);
    expect(textoBusca("  Ação   Ótima ")).toBe("acao otima");
  });
});
