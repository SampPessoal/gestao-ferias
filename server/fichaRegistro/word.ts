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

/** Um parágrafo do modelo (já com a letra ampliada pelo layout), com quebras de linha e cores. */
function paragrafo(p: Paragrafo): Paragraph {
  const tam = (x: number) => Math.max(2, Math.round(x));
  const runs: TextRun[] = [];
  for (const r of p.runs) {
    r.t.split("\n").forEach((pedaco, i) => {
      runs.push(new TextRun({ text: pedaco, bold: r.b, size: tam(r.sz), color: r.c, font: FONTE, ...(i > 0 ? { break: 1 } : {}) }));
    });
  }
  return new Paragraph({
    alignment: alinhamento(p.align),
    spacing: { before: Math.round(p.before), after: Math.round(p.after), line: p.line || 240, lineRule: LineRuleType.AUTO },
    run: { size: tam(p.sz), font: FONTE },
    children: runs.length ? runs : [new TextRun({ text: "", size: tam(p.sz), font: FONTE })],
  });
}

const TW = (pt: number) => Math.round(pt * 20); // pontos → twips

/** Uma linha do layout vira uma tabela de uma linha, com larguras e altura iguais às do PDF. */
function tabelaDaLinha(it: Extract<ItemPagina, { tipo: "linha" }>, escalaAltura: number): Table {
  const larguras = it.celulas.map(q => TW(q.w));
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: larguras.reduce((s, w) => s + w, 0), type: WidthType.DXA },
    columnWidths: larguras,
    rows: [new TableRow({
      cantSplit: true,
      // Altura fixa, igual à do PDF (levemente reduzida para caber o fim de página do Word)
      height: { value: TW(it.altura * escalaAltura), rule: HeightRule.EXACT },
      children: it.celulas.map(({ c, w, ml, mr, ps }) => new TableCell({
        width: { size: TW(w), type: WidthType.DXA },
        ...(c.fill && c.fill !== "auto" ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: c.fill } } : {}),
        // Mesmo critério do PDF: conteúdo centralizado na altura quando a linha cresce
        verticalAlign: c.valign === "bottom" ? VerticalAlign.BOTTOM
          : c.valign === "center" || !it.fixa ? VerticalAlign.CENTER : VerticalAlign.TOP,
        margins: { top: c.mar.top, bottom: c.mar.bottom, left: TW(ml), right: TW(mr) },
        borders: { top: borda(c.borders.top), bottom: borda(c.borders.bottom), left: borda(c.borders.left), right: borda(c.borders.right) },
        children: ps.length ? ps.map(q => paragrafo(q.p)) : [new Paragraph({ children: [] })],
      })),
    })],
  });
}

/**
 * Gera o .docx da Ficha de Registro a partir do modelo já preenchido, com o MESMO
 * layout do PDF (calcularLayoutFicha): mesma letra, larguras, alturas e páginas.
 */
export async function desenharFichaWord(modelo: ModeloFicha, titulo: string): Promise<Buffer> {
  const pg = modelo.page;
  const medidor = new PDFDocument({ size: [pg.w / 20, pg.h / 20], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  const { paginas, alturaUtil } = calcularLayoutFicha(medidor, modelo);
  // Folga de 4 pt por página para o parágrafo final que o Word exige em cada seção
  const escalaAltura = (alturaUtil - 4) / alturaUtil;
  const fimDeSecao = () => new Paragraph({
    spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
    run: { size: 2 },
    children: [new TextRun({ text: "", size: 2 })],
  });
  medidor.end();
  const paisagem = pg.w > pg.h;
  const margem = TW(MARGEM_IMPRESSAO);
  const doc = new Document({
    creator: "Gestão RH",
    title: titulo,
    styles: { default: { document: { run: { font: FONTE } } } },
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
      children: [...itens.map(it => (it.tipo === "p" ? paragrafo(it.p) : tabelaDaLinha(it, escalaAltura))), fimDeSecao()],
    })),
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
