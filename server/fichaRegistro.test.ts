import { describe, it, expect } from "vitest";
import { MODELOS, escolherModelo, preencherModelo, desenharFichaPdf } from "./fichaRegistro";
import { montarMapaFichaRegistro, type DadosFichaRegistro } from "./fichaRegistro/dados";
import type { ModeloFicha } from "./fichaRegistro/tipos";

const colab = {
  id: 1, nome: "MARIA JOSÉ DA CONCEIÇÃO", empresaNome: "JOANES", setorNome: "FINANCEIRO", cargo: "Analista",
  admissao: "2024-03-01", dataNascimento: "1990-07-02", nacionalidade: "Brasileira", naturalidade: "Salvador", estado: "BA",
  sexo: "feminino", estadoCivil: "casado", temFilhos: true, qtdFilhos: 2, rg: "0012345678", rgExpedicao: "2010-05-20",
  rgOrgaoExpedidor: "SSP/BA", cpf: "012.345.678-90", pis: "001.23456.78-9", ctpsDigital: false, ctpsNumero: "0001234",
  ctpsSerie: "00012", tituloEleitor: "000012345678", zonaEleitoral: "017", secaoEleitoral: "0203",
  enderecoLogradouro: "Rua das Flores", enderecoNumero: "10", enderecoBairro: "Centro", enderecoCidade: "Salvador",
  enderecoEstado: "BA", enderecoCep: "01000-000", celular: "(71) 99999-0000", emailCorporativo: "maria@empresa.com.br",
  contatoEmergenciaNome: "João", contatoEmergenciaTelefone: "(71) 98888-0000", nomePai: "José", nomeMae: "Ana",
  bancoCodigo: "001", bancoNome: "Banco do Brasil", bancoAgencia: "0123-4", bancoConta: "00012345-6",
  temSeguroVida: true, observacoes: "Sem observações.",
  valorVR: "35.50", valorVT: "9.00", auxilioCelularFolha: "50.00", auxilioVeiculo: null, auxilioVeiculoFolha: null,
  planoSaude: { titular: true, conjuge: { nome: "PEDRO", nascimento: "1989-01-15", cpf: "12345678909" },
    filhos: [{ nome: "LUÍSA", nascimento: "2018-03-09", cpf: null }, { nome: "LUCAS", nascimento: "2020-05-01", cpf: null }] },
} as unknown as DadosFichaRegistro;

/** Texto de cada campo preenchido: rótulo → conteúdo. */
function campos(m: ModeloFicha): Map<string, string> {
  const out = new Map<string, string>();
  for (const b of m.blocks) if (b.type === "table") for (const r of b.rows) for (const c of r.cells) for (const p of c.paras) {
    let i = 0; while (i < p.runs.length && p.runs[i].b) i++;
    const rot = p.runs.slice(0, i).map(x => x.t).join("").replace(/\s+/g, " ").trim();
    if (rot && !out.has(rot)) out.set(rot, p.runs.slice(i).map(x => x.t).join(""));
  }
  return out;
}

describe("Escolha do modelo pela empresa do colaborador", () => {
  it("cada empresa usa o próprio modelo", () => {
    expect(escolherModelo("FREIRE")?.empresa).toBe("FREIRE");
    expect(escolherModelo("Joanes")?.empresa).toBe("JOANES");
    expect(escolherModelo("SOLAR")?.empresa).toBe("SOLAR");
    expect(escolherModelo("SUDOESTE INFORMATICA")?.empresa).toBe("SUDOESTE");
    expect(escolherModelo("OUTRA EMPRESA")).toBeNull();
    expect(escolherModelo(null)).toBeNull();
  });
  it("o cabeçalho de cada modelo traz a razão social certa", () => {
    const razao = (m: ModeloFicha) => campos(m).get("EMPREGADOR")!.trim();
    expect(razao(MODELOS.FREIRE)).toBe("FREIRE INFORMATICA LTDA");
    expect(razao(MODELOS.JOANES)).toBe("JOANES CONSULTORIA E SERVIÇOS DE INFORMÁTICA LTDA");
    expect(razao(MODELOS.SOLAR)).toBe("SOLAR CONSULTORIA E SERVIÇOS DE INFORMATICA LTDA.");
    expect(razao(MODELOS.SUDOESTE)).toBe("SUDOESTE INFORMATICA E CONSULTORIA LTDA");
  });
});

describe("Preenchimento", () => {
  for (const empresa of Object.keys(MODELOS)) {
    it(`${empresa}: campos recebem os dados certos`, () => {
      const f = campos(preencherModelo(MODELOS[empresa], montarMapaFichaRegistro(colab, "2026-10-13")));
      expect(f.get("NOME COMPLETO")).toContain("MARIA JOSÉ DA CONCEIÇÃO");
      expect(f.get("CPF / CIC")).toContain("012.345.678-90");
      expect(f.get("DATA DE NASCIMENTO")!.trim()).toBe("02/07/1990");
      expect(f.get("DATA DE ADMISSÃO")!.trim()).toBe("01/03/2024");
      expect(f.get("CONJUGE")).toContain("DATA DE NASCIMENTO:  15/01/1989");
      expect(f.get("FILHOS (AS))")).toMatch(/DATA DE NASCIMENTO\.:\s+09\/03\/2018\n/);
      expect(f.get("IDADE")).toContain("36 anos");
      expect(f.get("ESTADO CIVIL")).toContain("Casado(a)");
      expect(f.get("CEP")).toContain("01000-000");
      expect(f.get("DEPARTAMENTO")).toContain("FINANCEIRO");
      expect(f.get("EXPEDIÇÃO RG")).toContain("20/05/2010 - SSP/BA");
      expect(f.get("SEXO")).toMatch(/\(X\)\s*FEM/);
      expect(f.get("SEXO")).not.toMatch(/\(X\)\s*MASC/);
      expect(f.get("FILHOS (AS)")).toMatch(/\(X\) SIM/);
      expect(f.get("PLANO DE SAÚDE")).toMatch(/\(X\) SIM/);
      expect(f.get("AUXÍLIO TELEFONIA")).toContain("50,00");
      expect(f.get("VALE TRANSPORTE")).toContain("9,00");
      expect(f.get("VALE REFEIÇÃO")).toContain("35,50");
      expect(f.get("CONJUGE")).toContain("PEDRO");
      expect(f.get("CONJUGE")).toContain("123.456.789-09");
      expect(f.get("FILHOS (AS))")).toContain("LUÍSA (+1)");
      // sem dado no cadastro: o espaço do modelo continua para preencher à mão
      expect(f.get("CNH")).toMatch(/[….]+/);
    });
  }

  it("Joanes: valor impresso no modelo é trocado pelo do cadastro, ou mantido se não houver", () => {
    const com = campos(preencherModelo(MODELOS.JOANES, montarMapaFichaRegistro(colab, "2026-10-13")));
    expect(com.get("VALE TRANSPORTE")).toContain("R$: 9,00");
    expect(com.get("VALE TRANSPORTE")).not.toContain("11,80");
    expect(com.get("VALE REFEIÇÃO")).toContain("R$: 35,50");
    const sem = campos(preencherModelo(MODELOS.JOANES,
      montarMapaFichaRegistro({ ...colab, valorVT: null, valorVR: null } as DadosFichaRegistro, "2026-10-13")));
    expect(sem.get("VALE TRANSPORTE")).toContain("11,80");
    expect(sem.get("VALE REFEIÇÃO")).toContain("39,52 OU 25,49");
  });

  it("não altera o modelo original", () => {
    const antes = JSON.stringify(MODELOS.FREIRE);
    preencherModelo(MODELOS.FREIRE, montarMapaFichaRegistro(colab, "2026-10-13"));
    expect(JSON.stringify(MODELOS.FREIRE)).toBe(antes);
  });
});

describe("PDF", () => {
  for (const empresa of Object.keys(MODELOS)) {
    it(`${empresa}: PDF válido em A4 paisagem com 2 páginas`, async () => {
      const buf = await desenharFichaPdf(preencherModelo(MODELOS[empresa], montarMapaFichaRegistro(colab, "2026-10-13")), "teste");
      const txt = buf.toString("latin1");
      expect(txt.startsWith("%PDF-")).toBe(true);
      expect(txt.match(/\/Type \/Page\b/g)?.length).toBe(2);
      expect(txt).toMatch(/\/MediaBox \[0 0 841\.9 595\.3\]/);
    });
  }
});
