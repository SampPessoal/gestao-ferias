/**
 * Excel da Movimentação do Mês, no formato aprovado:
 * título com competência, cabeçalho azul-marinho, linhas zebradas, filtros,
 * valores em R$, datas reais e totais por fórmula (geral, inclusões e exclusões).
 */
import type { Workbook, Worksheet } from "exceljs";

const NAVY = "FF0B1F3F";
const ZEBRA = "FFF3F5F9";
const LINHA = "FFE3E7EE";
const AZUL_TOTAL = "FFE6EEFC";
const CINZA_TEXTO = "FF5C6576";
const BRL = '"R$" #,##0.00';
const FONTE = "Arial";

type Formato = "texto" | "centro" | "data" | "datahora" | "moeda" | "movimentacao";
type Coluna = { titulo: string; largura: number; formato: Formato };
type Linha = (string | number | Date | null | undefined)[];

export type SecaoExport = "seguroVida" | "auxNotebook" | "planoSaude" | "valeTransporte" | "auxCreche" | "bonusIndicacao";

export const NOMES_SECAO: Record<SecaoExport, string> = {
  seguroVida: "Seguro de Vida",
  auxNotebook: "Auxílio Notebook",
  planoSaude: "Plano de Saúde",
  valeTransporte: "Vale Transporte",
  auxCreche: "Auxílio Creche",
  bonusIndicacao: "Bônus por Indicação",
};

export type DadosExport = {
  seguroVida: any[]; auxNotebook: any[]; planoSaude: any[]; valeTransporte: any[]; auxCreche: any[]; bonusIndicacao: any[];
  cpfs?: Record<string | number, string>;
  valorSeguroEmpresa?: Record<string, number | null>;
};

// ─── Conversões ───────────────────────────────────────────────────────────────

/** "2026-10-09" ou Date → Date em UTC (o Excel mostra o mesmo dia, sem fuso). */
function soData(v: any): Date | null {
  if (!v) return null;
  const iso = typeof v === "string" ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
  const [a, m, d] = iso.split("-").map(Number);
  return a ? new Date(Date.UTC(a, m - 1, d)) : null;
}

/** Data e hora local (horário de Brasília do usuário) para o Excel. */
function dataHora(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
}

function numero(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  let t = String(v).replace(/\s|R\$/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return isFinite(n) ? n : null;
}

function idade(nasc: any): number | null {
  const d = soData(nasc);
  if (!d) return null;
  const hoje = new Date();
  let i = hoje.getFullYear() - d.getUTCFullYear();
  const m = hoje.getMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getUTCDate())) i--;
  return i >= 0 ? i : null;
}

const movimentacao = (tipo: string) => (tipo === "incluir" ? "Inclusão" : tipo === "excluir" ? "Exclusão" : tipo ?? "");
const categoria = (c: string) => (c === "titular" ? "Titular" : c === "dependente" ? "Dependente" : c ?? "");
const situacaoBonus = (s: string) => ({ pendente: "Pendente", pago: "Pago", cancelado: "Cancelado" } as Record<string, string>)[s] ?? s ?? "";
const letra = (n: number) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

// ─── Montagem de uma aba ─────────────────────────────────────────────────────

type Info = { inicio: number; fim: number; colMov?: number; colValor?: number; linhas: Linha[] };

function cabecalho(ws: Worksheet, titulo: string, subtitulo: string, ncol: number) {
  ws.mergeCells(1, 1, 1, ncol);
  ws.mergeCells(2, 1, 2, ncol);
  const t = ws.getCell(1, 1);
  t.value = `Movimentação do Mês — ${titulo}`;
  t.font = { name: FONTE, size: 14, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = 22;
  const s = ws.getCell(2, 1);
  s.value = subtitulo;
  s.font = { name: FONTE, size: 9, color: { argb: CINZA_TEXTO } };
}

function aba(
  wb: Workbook, nome: string, subtitulo: string, colunas: Coluna[], linhas: Linha[],
  opcoes: { totais?: number[]; colMov?: number; nota?: string; colValor?: number } = {},
): Info {
  const ws = wb.addWorksheet(nome.slice(0, 31), { views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }] });
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const n = colunas.length;
  cabecalho(ws, nome, subtitulo, n);
  const h = 4;
  colunas.forEach((c, j) => {
    ws.getColumn(j + 1).width = c.largura;
    const cel = ws.getCell(h, j + 1);
    cel.value = c.titulo;
    cel.font = { name: FONTE, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cel.alignment = { horizontal: c.formato === "texto" ? "left" : "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(h).height = 30;

  if (!linhas.length) {
    const c = ws.getCell(h + 1, 1);
    c.value = "Nenhum registro neste mês";
    c.font = { name: FONTE, size: 10, italic: true, color: { argb: CINZA_TEXTO } };
    return { inicio: h + 1, fim: h, colMov: opcoes.colMov, colValor: opcoes.colValor, linhas };
  }

  linhas.forEach((lin, i) => {
    const r = h + 1 + i;
    lin.forEach((v, j) => {
      const c = ws.getCell(r, j + 1);
      const f = colunas[j].formato;
      c.value = (v === undefined ? null : v) as any;
      c.font = { name: FONTE, size: 10 };
      c.border = { bottom: { style: "thin", color: { argb: LINHA } } };
      if (f === "moeda") { c.numFmt = BRL; c.alignment = { horizontal: "right" }; }
      else if (f === "data") { c.numFmt = "dd/mm/yyyy"; c.alignment = { horizontal: "center" }; }
      else if (f === "datahora") { c.numFmt = "dd/mm/yyyy hh:mm"; c.alignment = { horizontal: "center" }; }
      else if (f === "centro") c.alignment = { horizontal: "center" };
      else if (f === "movimentacao") {
        c.alignment = { horizontal: "center" };
        c.font = { name: FONTE, size: 10, bold: true, color: { argb: v === "Inclusão" ? "FF155D33" : "FFB42318" } };
      }
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
  });
  const fim = h + linhas.length;
  ws.autoFilter = { from: { row: h, column: 1 }, to: { row: fim, column: n } };

  // Totais por fórmula (com o resultado já calculado, para quem abrir sem recalcular)
  if (opcoes.totais?.length) {
    const t = fim + 2;
    const rotulos: [string, string | null][] = opcoes.colMov !== undefined
      ? [["TOTAL GERAL", null], ["Total das inclusões", "Inclusão"], ["Total das exclusões", "Exclusão"]]
      : [["TOTAL", null]];
    rotulos.forEach(([rotulo, filtro], k) => {
      const r = t + k;
      const c1 = ws.getCell(r, 1);
      c1.value = rotulo;
      c1.font = { name: FONTE, size: 10, bold: true, color: { argb: k === 0 ? NAVY : "FF3D475A" } };
      for (const j of opcoes.totais!) {
        const L = letra(j + 1);
        const soma = linhas.reduce((acc, lin) =>
          acc + ((!filtro || lin[opcoes.colMov!] === filtro) ? (numero(lin[j]) ?? 0) : 0), 0);
        const formula = filtro
          ? `SUMIF(${letra(opcoes.colMov! + 1)}${h + 1}:${letra(opcoes.colMov! + 1)}${fim},"${filtro}",${L}${h + 1}:${L}${fim})`
          : `SUM(${L}${h + 1}:${L}${fim})`;
        const c = ws.getCell(r, j + 1);
        c.value = { formula, result: Math.round(soma * 100) / 100 };
        c.numFmt = BRL;
        c.font = { name: FONTE, size: 10, bold: true };
        c.alignment = { horizontal: "right" };
      }
      if (k === 0) for (let j = 1; j <= n; j++) ws.getCell(r, j).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_TOTAL } };
    });
    if (opcoes.nota) {
      const c = ws.getCell(t + rotulos.length + 1, 1);
      c.value = opcoes.nota;
      c.font = { name: FONTE, size: 9, italic: true, color: { argb: CINZA_TEXTO } };
    }
  }
  return { inicio: h + 1, fim, colMov: opcoes.colMov, colValor: opcoes.colValor, linhas };
}

// ─── As seis seções ──────────────────────────────────────────────────────────

const C = (titulo: string, largura: number, formato: Formato = "texto"): Coluna => ({ titulo, largura, formato });
const REGISTRO = [C("Observação", 28), C("Registrado por", 18), C("Registrado em", 17, "datahora")];
const reg = (r: any): Linha => [r.observacao ?? "", r.createdByNome ?? "", dataHora(r.createdAt)];

function montarSecao(wb: Workbook, secao: SecaoExport, d: DadosExport, subtitulo: string): Info {
  const cpf = (r: any) => (d.cpfs?.[r.colaboradorId] ?? "") as string;
  const base = (r: any): Linha => [r.nomeColaborador ?? "", cpf(r), r.empresa ?? "", movimentacao(r.tipo)];
  const BASE = [C("Colaborador", 38), C("CPF", 16, "centro"), C("Empresa", 12, "centro"), C("Movimentação", 14, "movimentacao")];
  const nome = NOMES_SECAO[secao];
  switch (secao) {
    case "planoSaude":
      return aba(wb, nome, subtitulo,
        [...BASE, C("Plano", 10, "centro"), C("Categoria", 12, "centro"), C("Nascimento", 13, "data"), C("Idade", 8, "centro"),
          C("Valor do plano", 15, "moeda"), C("Empresa paga", 15, "moeda"), C("Colaborador paga", 17, "moeda"), ...REGISTRO],
        d.planoSaude.map(r => [...base(r), r.tipoPlano ?? "", categoria(r.categoria), soData(r.dataNascimento), idade(r.dataNascimento),
          numero(r.valor), numero(r.valorEmpresa), numero(r.valorColaborador), ...reg(r)]),
        { totais: [8, 9, 10], colMov: 3, colValor: 8,
          nota: "Empresa paga = 70% do valor do plano Prata QC (967067) na mesma faixa etária; o restante é descontado do colaborador." });
    case "seguroVida":
      return aba(wb, nome, subtitulo,
        [...BASE, C("Data", 13, "data"), C("Valor mensal da empresa", 16, "moeda"), ...REGISTRO],
        d.seguroVida.map(r => [...base(r), soData(r.data), d.valorSeguroEmpresa?.[(r.empresa ?? "").toUpperCase()] ?? null, ...reg(r)]),
        { totais: [5], colMov: 3, colValor: 5,
          nota: "Valor mensal da empresa = valor configurado em Seguro de Vida › Valores por Empresa no momento da exportação." });
    case "auxNotebook":
      return aba(wb, nome, subtitulo,
        [...BASE, C("Início", 13, "data"), C("Valor mensal", 14, "moeda"), ...REGISTRO],
        d.auxNotebook.map(r => [...base(r), soData(r.dataInicio), numero(r.valor), ...reg(r)]),
        { totais: [5], colMov: 3, colValor: 5 });
    case "valeTransporte":
      return aba(wb, nome, subtitulo, [...BASE, ...REGISTRO], d.valeTransporte.map(r => [...base(r), ...reg(r)]), { colMov: 3 });
    case "auxCreche":
      return aba(wb, nome, subtitulo,
        [...BASE, C("Nome do filho", 30), C("Nasc. do filho", 13, "data"), C("Idade do filho", 10, "centro"), C("Valor mensal", 14, "moeda"), ...REGISTRO],
        d.auxCreche.map(r => [...base(r), r.nomeFilho ?? "", soData(r.dataNascimentoFilho), idade(r.dataNascimentoFilho), numero(r.valor), ...reg(r)]),
        { totais: [7], colMov: 3, colValor: 7 });
    case "bonusIndicacao":
      return aba(wb, nome, subtitulo,
        [C("Indicador", 34), C("Indicado", 34), C("Empresa", 12, "centro"), C("Admissão do indicado", 14, "data"),
          C("Pagamento previsto", 14, "data"), C("Pagamento efetivo", 14, "data"), C("Valor do bônus", 14, "moeda"),
          C("Situação", 12, "centro"), C("Observação", 28), C("Registrado por", 18)],
        d.bonusIndicacao.map(r => [r.nomeIndicador ?? "", r.nomeIndicado ?? "", r.empresa ?? "", soData(r.dataAdmissaoIndicado),
          soData(r.dataPagamentoPrevisto), soData(r.dataPagamentoEfetivo), numero(r.valorBonus), situacaoBonus(r.status),
          r.observacao ?? "", r.createdByNome ?? ""]),
        { totais: [6], colValor: 6 });
  }
}

function resumo(ws: Worksheet, infos: [SecaoExport, Info][], subtitulo: string) {
  cabecalho(ws, "Resumo", subtitulo, 5);
  const cols: [string, number][] = [["Seção", 26], ["Inclusões", 12], ["Exclusões", 12], ["Total de lançamentos", 18], ["Valor total (R$)", 18]];
  cols.forEach(([t, w], j) => {
    ws.getColumn(j + 1).width = w;
    const c = ws.getCell(4, j + 1);
    c.value = t;
    c.font = { name: FONTE, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { horizontal: j ? "center" : "left", vertical: "middle", wrapText: true };
  });
  ws.getRow(4).height = 30;
  infos.forEach(([secao, info], i) => {
    const r = 5 + i;
    const q = `'${NOMES_SECAO[secao]}'`;
    const vazio = info.fim < info.inicio;
    const contar = (rot: string) => info.linhas.filter(l => l[info.colMov!] === rot).length;
    ws.getCell(r, 1).value = NOMES_SECAO[secao];
    ws.getCell(r, 1).font = { name: FONTE, size: 10, bold: true };
    if (info.colMov !== undefined) {
      const M = letra(info.colMov + 1);
      ws.getCell(r, 2).value = vazio ? 0 : { formula: `COUNTIF(${q}!${M}${info.inicio}:${M}${info.fim},"Inclusão")`, result: contar("Inclusão") };
      ws.getCell(r, 3).value = vazio ? 0 : { formula: `COUNTIF(${q}!${M}${info.inicio}:${M}${info.fim},"Exclusão")`, result: contar("Exclusão") };
    } else { ws.getCell(r, 2).value = "—"; ws.getCell(r, 3).value = "—"; }
    ws.getCell(r, 4).value = vazio ? 0 : { formula: `COUNTA(${q}!A${info.inicio}:A${info.fim})`, result: info.linhas.length };
    if (info.colValor !== undefined) {
      const V = letra(info.colValor + 1);
      const soma = info.linhas.reduce((a, l) => a + (numero(l[info.colValor!]) ?? 0), 0);
      ws.getCell(r, 5).value = vazio ? 0 : { formula: `SUM(${q}!${V}${info.inicio}:${V}${info.fim})`, result: Math.round(soma * 100) / 100 };
      ws.getCell(r, 5).numFmt = BRL;
    } else ws.getCell(r, 5).value = "—";
    for (let j = 1; j <= 5; j++) {
      const c = ws.getCell(r, j);
      c.border = { bottom: { style: "thin", color: { argb: LINHA } } };
      if (j > 1) { c.font = { name: FONTE, size: 10 }; c.alignment = { horizontal: j === 5 ? "right" : "center" }; }
    }
  });
  const nota = ws.getCell(5 + infos.length + 1, 1);
  nota.value = "Valor total = soma da coluna de valor de cada aba (no Plano de Saúde, o valor cheio do plano).";
  nota.font = { name: FONTE, size: 9, italic: true, color: { argb: CINZA_TEXTO } };
}

/** Gera e baixa o Excel. Com "secoes" de um item, sai só aquela aba; com todas, sai também o Resumo. */
export async function baixarExcelMovimentacao(d: DadosExport, secoes: SecaoExport[], competencia: string, empresa: string, nomeArquivo: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestão de RH";
  wb.calcProperties.fullCalcOnLoad = true;
  const agora = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  const subtitulo = `Competência: ${competencia}   ·   Empresa: ${empresa || "Todas as empresas"}   ·   Gerado em ${agora}`;
  const completo = secoes.length > 1;
  const wsResumo = completo ? wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] }) : null;
  const infos: [SecaoExport, Info][] = secoes.map(s => [s, montarSecao(wb, s, d, subtitulo)]);
  if (wsResumo) resumo(wsResumo, infos, subtitulo);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
