import { describe, expect, it } from "vitest";
import { decidirFaixa, idadeNaData } from "../shared/faixaEtaria";

const precos = [
  { id: 1, empresa: "FREIRE", codigoPlano: "967067", faixaInicio: 34, faixaFim: 38, valorTitular: 720.48, valorDependente: 700 },
  { id: 2, empresa: "FREIRE", codigoPlano: "967067", faixaInicio: 39, faixaFim: 43, valorTitular: 792.53, valorDependente: 770 },
  { id: 3, empresa: "SOLAR", codigoPlano: "967067", faixaInicio: 39, faixaFim: 43, valorTitular: 800, valorDependente: 780 },
];

describe("idadeNaData", () => {
  it("conta o aniversário a partir do próprio dia", () => {
    expect(idadeNaData("1987-11-12", new Date(2026, 10, 11))).toBe(38);
    expect(idadeNaData("1987-11-12", new Date(2026, 10, 12))).toBe(39);
  });
  it("rejeita data inválida", () => {
    expect(idadeNaData("", new Date())).toBeNull();
    expect(idadeNaData("12/11/1987", new Date())).toBeNull();
  });
});

describe("decidirFaixa", () => {
  const b = { empresa: "FREIRE", plano: "967067", tipo: "T" as const, idade: 38, mensalidade: 720.48 };
  it("troca o valor quando muda de faixa (titular)", () => {
    expect(decidirFaixa(precos, b, 39)).toEqual({ acao: "faixa", idade: 39, mensalidade: 792.53 });
  });
  it("usa o valor de dependente para dependente", () => {
    expect(decidirFaixa(precos, { ...b, tipo: "D", mensalidade: 700 }, 39)).toEqual({ acao: "faixa", idade: 39, mensalidade: 770 });
  });
  it("só atualiza a idade dentro da mesma faixa, sem mexer no valor", () => {
    expect(decidirFaixa(precos, { ...b, idade: 39, mensalidade: 792.53 }, 40)).toEqual({ acao: "idade", idade: 40 });
  });
  it("não faz nada se a idade não mudou", () => {
    expect(decidirFaixa(precos, b, 38)).toEqual({ acao: "nada" });
  });
  it("respeita a empresa da tabela", () => {
    expect(decidirFaixa(precos, { ...b, empresa: "SOLAR", idade: 39, mensalidade: 800 }, 40)).toEqual({ acao: "idade", idade: 40 });
  });
  it("sem faixa cadastrada, só atualiza a idade", () => {
    expect(decidirFaixa(precos, { ...b, idade: 69 }, 70)).toEqual({ acao: "idade", idade: 70 });
  });
  it("idade que pula mais de 1 ano fica para conferir, sem mexer no valor", () => {
    expect(decidirFaixa(precos, { ...b, idade: 30 }, 39)).toEqual({ acao: "divergente", idade: 39 });
  });
  it("idade que diminui fica para conferir", () => {
    expect(decidirFaixa(precos, { ...b, idade: 43 }, 38)).toEqual({ acao: "divergente", idade: 38 });
  });
});
