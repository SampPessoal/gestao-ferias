/**
 * Ficha de Registro do colaborador em Word (.docx), no modelo oficial de cada empresa.
 *
 * Usa o MESMO modelo preenchido do PDF (./modelos, extraídos dos .docx do RH), então
 * o Word sai com a mesma aparência do PDF: larguras, cores, bordas, fontes e textos.
 * A diferença é que no Word o conteúdo continua editável.
 *
 * Usa o mesmo cálculo de layout do PDF (letra ampliada, larguras, alturas e páginas).
 * Medidas do modelo: twips (1/20 pt); tamanho de letra em meios-pontos; bordas em 1/8 pt.
 */
import {
  AlignmentType, BorderStyle, Document, HeightRule, LineRuleType, Packer, PageOrientation,
  Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import type { Borda, ModeloFicha, Paragrafo } from "./tipos";
import { calcularLayoutFicha, MARGEM_IMPRESSAO, type ItemPagina } from "./index";

const FONTE = "Arial";

const alinhamento = (a: string | null) =>
  a === "center" ? AlignmentType.CENTER
    : a === "right" ? AlignmentType.RIGHT
      : a === "both" || a === "justify" ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT;

const borda = (b: Borda) =>
  b ? { style: BorderStyle.SINGLE, size: Math.max(2, b.sz), color: b.c } : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

// Ajustes para o Microsoft Word, medidos numa ficha aberta no Word do RH:
// - o Word desenha cada linha da tabela cerca de 2,5 pt mais alta (bordas e métricas);
//   esse acréscimo é descontado de cada página, e o restante estica as linhas até a
//   margem de baixo, deixando só uma folga de segurança pequena;
// - letra um pouco menor que a do PDF, para o texto nunca cortar dentro das caixas.
const ESCALA_LETRA = 0.88;
const ACRESCIMO_WORD_POR_LINHA = 2.8; // pt
const FOLGA_SEGURANCA = 8;            // pt no fim de cada página

/** Um parágrafo do modelo (já com a letra do layout), com quebras de linha e cores. */
function paragrafo(p: Paragrafo): Paragraph {
  const tam = (x: number) => Math.max(2, Math.round(x * ESCALA_LETRA));
  const runs: TextRun[] = [];
  for (const r of p.runs) {
    r.t.split("\n").forEach((pedaco, i) => {
      runs.push(new TextRun({ text: pedaco, bold: r.b, size: tam(r.sz), color: r.c, font: FONTE, ...(i > 0 ? { break: 1 } : {}) }));
    });
  }
  return new Paragraph({
    alignment: alinhamento(p.align),
    spacing: { before: Math.round(p.before * ESCALA_LETRA), after: Math.round(p.after * ESCALA_LETRA), line: 240, lineRule: LineRuleType.AUTO },
    run: { size: tam(p.sz), font: FONTE },
    children: runs.length ? runs : [new TextRun({ text: "", size: tam(p.sz), font: FONTE })],
  });
}

const TW = (pt: number) => Math.round(pt * 20); // pontos → twips
type LinhaLayout = Extract<ItemPagina, { tipo: "linha" }>;

/**
 * Linhas seguidas viram UMA tabela (o Word junta tabelas coladas e desalinha as colunas).
 * Como cada linha do modelo tem divisões diferentes, monta-se uma grade comum com todas
 * as divisões e cada célula ocupa as colunas da grade correspondentes (columnSpan).
 */
function tabelaDasLinhas(linhas: LinhaLayout[], larguraTotal: number, escalaAltura: number): Table {
  const ENCAIXE = 40; // divisões a menos de 2 pt umas das outras viram a mesma
  const cortesPorLinha = linhas.map(l => {
    const total = l.celulas.reduce((s, q) => s + q.w, 0);
    let acc = 0;
    return l.celulas.map(q => { acc += q.w; return Math.round((acc / total) * larguraTotal); });
  });
  const todos = Array.from(new Set(cortesPorLinha.flat())).sort((x, y) => x - y);
  const grade: number[] = [];
  for (const c of todos) {
    if (c >= larguraTotal - ENCAIXE) continue;
    if (!grade.length || c - grade[grade.length - 1] >= ENCAIXE) grade.push(c);
  }
  grade.push(larguraTotal);
  const larguras = grade.map((c, i) => c - (i ? grade[i - 1] : 0));
  const indiceDoCorte = (c: number) => {
    if (c >= larguraTotal - ENCAIXE) return grade.length - 1;
    let melhor = 0;
    grade.forEach((g, i) => { if (Math.abs(g - c) < Math.abs(grade[melhor] - c)) melhor = i; });
    return melhor;
  };

  const rows = linhas.map((it, li) => {
    let inicio = 0;
    const celulas = it.celulas.map(({ c, ml, mr, ps }, ci) => {
      const fim = ci === it.celulas.length - 1 ? grade.length - 1 : indiceDoCorte(cortesPorLinha[li][ci]);
      const span = Math.max(1, fim - inicio + 1);
      const largura = larguras.slice(inicio, inicio + span).reduce((s, w) => s + w, 0);
      inicio += span;
      return new TableCell({
        width: { size: largura, type: WidthType.DXA },
        ...(span > 1 ? { columnSpan: span } : {}),
        ...(c.fill && c.fill !== "auto" ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: c.fill } } : {}),
        // Mesmo critério do PDF: conteúdo centralizado na altura quando a linha cresce
        verticalAlign: c.valign === "bottom" ? VerticalAlign.BOTTOM
          : c.valign === "center" || !it.fixa ? VerticalAlign.CENTER : VerticalAlign.TOP,
        margins: { top: Math.round(c.mar.top * ESCALA_LETRA), bottom: Math.round(c.mar.bottom * ESCALA_LETRA), left: TW(ml), right: TW(mr) },
        borders: { top: borda(c.borders.top), bottom: borda(c.borders.bottom), left: borda(c.borders.left), right: borda(c.borders.right) },
        children: ps.length ? ps.map(q => paragrafo(q.p)) : [new Paragraph({ children: [] })],
      });
    });
    return new TableRow({
      cantSplit: true,
      height: { value: TW(it.altura * escalaAltura), rule: HeightRule.EXACT },
      children: celulas,
    });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: larguraTotal, type: WidthType.DXA },
    columnWidths: larguras,
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
    rows,
  });
}

/**
 * Gera o .docx da Ficha de Registro a partir do modelo já preenchido, com o mesmo
 * layout do PDF (calcularLayoutFicha): mesmas proporções, colunas e 2 páginas.
 */
export async function desenharFichaWord(modelo: ModeloFicha, titulo: string): Promise<Buffer> {
  const pg = modelo.page;
  const medidor = new PDFDocument({ size: [pg.w / 20, pg.h / 20], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  const { paginas, larguraUtil, alturaUtil } = calcularLayoutFicha(medidor, modelo);
  medidor.end();
  const paisagem = pg.w > pg.h;
  const margem = TW(MARGEM_IMPRESSAO);
  const larguraTotal = TW(larguraUtil);

  const conteudoDaPagina = (itens: ItemPagina[]) => {
    // Altura das linhas desta página: ocupa a folha até a margem de baixo, descontando o
    // acréscimo que o Word põe em cada linha e o texto avulso (título), com folga pequena.
    const linhasDaPagina = itens.filter(it => it.tipo === "linha") as LinhaLayout[];
    const somaLinhas = linhasDaPagina.reduce((s, it) => s + it.altura, 0);
    const somaTextos = itens.reduce((s, it) => s + (it.tipo === "p" ? it.h * ESCALA_LETRA : 0), 0);
    const disponivel = alturaUtil - somaTextos - FOLGA_SEGURANCA - ACRESCIMO_WORD_POR_LINHA * linhasDaPagina.length;
    const escalaAltura = somaLinhas > 0 ? Math.min(1, disponivel / somaLinhas) : 1;

    const saida: (Table | Paragraph)[] = [];
    let grupo: LinhaLayout[] = [];
    const fecharGrupo = () => { if (grupo.length) { saida.push(tabelaDasLinhas(grupo, larguraTotal, escalaAltura)); grupo = []; } };
    for (const it of itens) {
      if (it.tipo === "linha") grupo.push(it);
      else { fecharGrupo(); saida.push(paragrafo(it.p)); }
    }
    fecharGrupo();
    // Parágrafo final que o Word exige em cada seção: mínimo, para não criar página extra
    saida.push(new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, run: { size: 2 }, children: [new TextRun({ text: "", size: 2 })] }));
    return saida;
  };

  const doc = new Document({
    creator: "Gestão RH",
    title: titulo,
    // Sem espaçamentos automáticos do Word (o estilo Normal do Word adiciona espaço depois)
    styles: {
      default: {
        document: {
          run: { font: FONTE, size: 18 },
          paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    // Uma seção por página do PDF (cada seção começa numa página nova)
    sections: paginas.map(itens => ({
      properties: {
        page: {
          size: paisagem
            ? { width: pg.h, height: pg.w, orientation: PageOrientation.LANDSCAPE }
            : { width: pg.w, height: pg.h },
          margin: { top: margem, right: margem, bottom: margem, left: margem, header: 0, footer: 0 },
        },
      },
      children: conteudoDaPagina(itens),
    })),
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
