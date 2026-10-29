import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { montarFichaColaborador, dataBR, nomeArquivoFicha, VALOR_VAZIO } from "../shared/fichaColaborador";
import { gerarFichaExcel, gerarFichaPdf, gerarFichaWord, textoPdf, emissaoAgora } from "./fichaExport";

const completo = {
  codigo: "000123",
  nome: "MARIA JOSÉ DA CONCEIÇÃO",
  status: "ativo",
  admissao: "2024-03-01",
  dataDemissao: null,
  periodoAquisitivo: "2024-03-01",
  vencimento: "2025-02-28",
  dataLimite: "2026-01-29",
  diasDireito: 30,
  saldo: 15,
  observacoes: "Observação com acentuação: ação, açúcar, pão.",
  empresaNome: "SOLAR",
  setorNome: "ADMINISTRATIVO",
  dataNascimento: new Date("1990-07-02T00:00:00Z"),
  nacionalidade: "Brasileira",
  estadoCivil: "uniao_estavel",
  naturalidade: "Salvador",
  estado: "BA",
  sexo: "feminino",
  temFilhos: true,
  qtdFilhos: 2,
  idadeAdmissao: 33,
  rg: "0012345678",
  cpf: "012.345.678-90",
  telefone: "(71) 3333-0000",
  celular: "(71) 99999-0000",
  emailCorporativo: "maria@empresa.com.br",
  cargo: "Analista",
  contatoEmergenciaNome: "João",
  contatoEmergenciaTelefone: "(71) 98888-0000",
  nomePai: "José",
  nomeMae: "Ana",
  rgExpedicao: "2010-05-20",
  rgOrgaoExpedidor: "SSP/BA",
  enderecoLogradouro: "Rua das Flores",
  enderecoNumero: "0010",
  enderecoComplemento: "Apto 101",
  enderecoBairro: "Centro",
  enderecoCidade: "Salvador",
  enderecoEstado: "BA",
  enderecoCep: "01000-000",
  tituloEleitor: "000012345678",
  zonaEleitoral: "001",
  secaoEleitoral: "0099",
  pis: "001.23456.78-9",
  ctpsDigital: false,
  ctpsNumero: "0001234",
  ctpsSerie: "00012",
  bancoCodigo: "001",
  bancoNome: "Banco do Brasil",
  bancoAgencia: "0123-4",
  bancoConta: "00012345-6",
  bancoTipoConta: "corrente",
  bancoChavePix: "012.345.678-90",
  bancoTipoChavePix: "cpf",
  temSeguroVida: true,
  valorSeguroVida: "12,50",
};

const valorDe = (secoes: ReturnType<typeof montarFichaColaborador>, rotulo: string) =>
  secoes.flatMap(s => s.campos).find(c => c.rotulo === rotulo)?.valor;

describe("Montagem da ficha", () => {
  const secoes = montarFichaColaborador(completo, "2026-10-08");

  it("associa cada valor ao campo correto", () => {
    expect(valorDe(secoes, "Nome completo")).toBe("MARIA JOSÉ DA CONCEIÇÃO");
    expect(valorDe(secoes, "Código / Matrícula")).toBe("000123");
    expect(valorDe(secoes, "CPF")).toBe("012.345.678-90");
    expect(valorDe(secoes, "RG")).toBe("0012345678");
    expect(valorDe(secoes, "Departamento / Setor")).toBe("ADMINISTRATIVO");
    expect(valorDe(secoes, "Estado civil")).toBe("União Estável");
    expect(valorDe(secoes, "Filhos")).toBe("Sim — 2 filho(s)");
    expect(valorDe(secoes, "Banco")).toBe("001 – Banco do Brasil");
    expect(valorDe(secoes, "Chave PIX")).toBe("CPF: 012.345.678-90");
    expect(valorDe(secoes, "Período aquisitivo atual")).toBe("01/03/2024 a 28/02/2025");
  });

  it("preserva zeros à esquerda e formata datas como DD/MM/AAAA", () => {
    expect(valorDe(secoes, "CEP")).toBe("01000-000");
    expect(valorDe(secoes, "Título de eleitor")).toBe("000012345678");
    expect(valorDe(secoes, "Agência")).toBe("0123-4");
    expect(valorDe(secoes, "Data de nascimento")).toBe("02/07/1990");
    expect(valorDe(secoes, "Data limite das férias")).toBe("29/01/2026");
    expect(valorDe(secoes, "Idade")).toBe("36 anos");
  });

  it("não tem rótulos repetidos", () => {
    const rotulos = secoes.flatMap(s => s.campos.map(c => c.rotulo));
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it("campos vazios viram 'Não informado', sem inventar valores", () => {
    const vazio = montarFichaColaborador({ nome: "Fulano" }, "2026-10-08");
    const campos = vazio.flatMap(s => s.campos);
    expect(campos.find(c => c.rotulo === "Nome completo")?.valor).toBe("Fulano");
    for (const c of campos.filter(c => c.rotulo !== "Nome completo")) expect(c.valor).toBe(VALOR_VAZIO);
  });

  it("CTPS digital troca o rótulo e omite a série, como na tela", () => {
    const s = montarFichaColaborador({ ...completo, ctpsDigital: true }, "2026-10-08");
    expect(valorDe(s, "Número da CTPS Digital (CPF)")).toBe("0001234");
    expect(valorDe(s, "Série da CTPS")).toBeUndefined();
  });

  it("utilitários", () => {
    expect(dataBR("2025-02-28T00:00:00.000Z")).toBe("28/02/2025");
    expect(dataBR(null)).toBe(VALOR_VAZIO);
    expect(nomeArquivoFicha("Maria José / Conceição")).toBe("Ficha_Maria_Jose_Conceicao");
    expect(textoPdf("Ação — R$ 10 😀")).toBe("Ação — R$ 10 ?");
    expect(emissaoAgora(new Date("2026-10-09T02:30:00Z")).dataIso).toBe("2026-10-08"); // 23h30 em Brasília
  });
});

describe("Arquivos gerados", () => {
  const emissao = { dataIso: "2026-10-08", dataHoraBR: "08/10/2026 às 15:00" };
  const secoes = montarFichaColaborador(completo, emissao.dataIso);

  it("Excel: cada linha tem rótulo e valor iguais à ficha, como texto", async () => {
    const buf = await gerarFichaExcel(completo.nome, "SOLAR", secoes, emissao);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.getWorksheet("Ficha cadastral")!;
    expect(ws.getCell("A5").value).toBe("Campo / Informação");
    expect(ws.getCell("B5").value).toBe("Dados do colaborador");
    const lidos = new Map<string, unknown>();
    ws.eachRow((row, n) => { if (n > 5) lidos.set(String(row.getCell(1).value), row.getCell(2).value); });
    for (const campo of secoes.flatMap(s => s.campos)) {
      expect(lidos.get(campo.rotulo)).toBe(campo.valor);
    }
  });

  it("PDF: arquivo válido", async () => {
    const buf = await gerarFichaPdf(completo.nome, "SOLAR", secoes, emissao);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });
});

/** Lê um arquivo de dentro de um ZIP (pelo diretório central), só com o zlib do Node. */
function lerArquivoDoZip(zip: Buffer, nome: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = zip.readUInt32LE(eocd + 16);
  const total = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < total; i++) {
    const metodo = zip.readUInt16LE(p + 10), tamanho = zip.readUInt32LE(p + 20);
    const nLen = zip.readUInt16LE(p + 28), eLen = zip.readUInt16LE(p + 30), cLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    if (zip.toString("utf8", p + 46, p + 46 + nLen) === nome) {
      const ini = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const dados = zip.subarray(ini, ini + tamanho);
      return (metodo === 8 ? inflateRawSync(dados) : dados).toString("utf8");
    }
    p += 46 + nLen + eLen + cLen;
  }
  throw new Error(`${nome} não encontrado no ZIP`);
}

describe("Ficha em Word (.docx)", () => {
  it("gera um .docx válido com os mesmos campos e valores da ficha", async () => {
    const secoes = [
      { titulo: "Dados pessoais", campos: [{ rotulo: "Nome completo", valor: "MARIA DA SILVA" }, { rotulo: "CPF", valor: "012.345.678-90" }] },
      { titulo: "Contato", campos: [{ rotulo: "Telefone", valor: VALOR_VAZIO }] },
    ];
    const buf = await gerarFichaWord("MARIA DA SILVA", "SOLAR", secoes, emissaoAgora(new Date("2026-10-29T15:00:00Z")));
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // arquivo ZIP (formato do Word)
    const xml = lerArquivoDoZip(buf, "word/document.xml");
    for (const t of ["FICHA CADASTRAL DO COLABORADOR", "MARIA DA SILVA — SOLAR", "DADOS PESSOAIS", "012.345.678-90", VALOR_VAZIO]) {
      expect(xml).toContain(t);
    }
  });
});
