/**
 * Exportação da ficha cadastral individual do colaborador (PDF e Excel).
 *
 * - Os dois formatos usam a MESMA montagem de dados (shared/fichaColaborador.ts).
 * - Os dados são lidos do banco no momento do download (sem cache).
 * - A rota exige usuário autenticado e ativo, como as telas do sistema.
 * - Nada é gravado nem alterado no cadastro, e nenhum dado pessoal vai para o log.
 */
import type { Express, Request, Response, NextFunction } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import {
  AlignmentType, BorderStyle, Document, Footer, Packer, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import { getColaboradorById } from "./db";
import { escolherModelo, preencherModelo, desenharFichaPdf } from "./fichaRegistro";
import { carregarDadosFichaRegistro, montarMapaFichaRegistro } from "./fichaRegistro/dados";
import {
  montarFichaColaborador,
  nomeArquivoFicha,
  VALOR_VAZIO,
  type SecaoFicha,
} from "../shared/fichaColaborador";

export type DadosEmissao = {
  dataIso: string;   // AAAA-MM-DD (Brasília)
  dataHoraBR: string; // DD/MM/AAAA às HH:MM (Brasília)
};

/** Data e hora atuais no fuso de Brasília. */
export function emissaoAgora(agora = new Date()): DadosEmissao {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(agora).map(p => [p.type, p.value]),
  );
  return {
    dataIso: `${partes.year}-${partes.month}-${partes.day}`,
    dataHoraBR: `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`,
  };
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export async function gerarFichaExcel(
  nome: string, empresa: string, secoes: SecaoFicha[], emissao: DadosEmissao,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestão RH";
  wb.created = new Date();
  const ws = wb.addWorksheet("Ficha cadastral", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 5 }],
  });
  ws.columns = [{ width: 38 }, { width: 70 }];

  const fonte = { name: "Arial", size: 10 } as const;
  const bordaFina = { style: "thin" as const, color: { argb: "FFD0D5DD" } };
  const bordas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };

  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = "FICHA CADASTRAL DO COLABORADOR";
  ws.getCell("A1").font = { ...fonte, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:B2");
  ws.getCell("A2").value = `${nome}${empresa ? " — " + empresa : ""}`;
  ws.getCell("A2").font = { ...fonte, size: 11, bold: true };
  ws.mergeCells("A3:B3");
  ws.getCell("A3").value = `Emitido em ${emissao.dataHoraBR}. Documento com dados pessoais — uso restrito do RH (LGPD).`;
  ws.getCell("A3").font = { ...fonte, size: 9, italic: true, color: { argb: "FF6B7280" } };

  const cab = ws.getRow(5);
  cab.values = ["Campo / Informação", "Dados do colaborador"];
  cab.eachCell(cell => {
    cell.font = { ...fonte, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.border = bordas;
    cell.alignment = { vertical: "middle", indent: 1 };
  });
  cab.height = 20;

  let linha = 6;
  for (const secao of secoes) {
    ws.mergeCells(`A${linha}:B${linha}`);
    const c = ws.getCell(`A${linha}`);
    c.value = secao.titulo.toUpperCase();
    c.font = { ...fonte, bold: true, color: { argb: "FF1E3A5F" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
    c.border = bordas;
    c.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(linha).height = 18;
    linha++;

    for (const campo of secao.campos) {
      const row = ws.getRow(linha);
      const a = row.getCell(1);
      const b = row.getCell(2);
      a.value = campo.rotulo;
      // Sempre texto: preserva zeros à esquerda, pontos e traços de documentos
      b.value = campo.valor;
      b.numFmt = "@";
      a.font = { ...fonte, bold: true, color: { argb: "FF374151" } };
      b.font = campo.valor === VALOR_VAZIO
        ? { ...fonte, italic: true, color: { argb: "FF9CA3AF" } }
        : { ...fonte };
      for (const cell of [a, b]) {
        cell.border = bordas;
        cell.alignment = { vertical: "top", wrapText: true, indent: 1 };
      }
      // Altura para textos longos (ex.: observações), sem cortar o conteúdo
      const linhasTexto = campo.valor.split("\n").reduce((n, t) => n + Math.max(1, Math.ceil(t.length / 85)), 0);
      if (linhasTexto > 1) row.height = Math.min(409, 15 * linhasTexto);
      linha++;
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/**
 * As fontes padrão do PDF (Helvetica) usam a codificação WinAnsi, que cobre
 * todo o português. Caracteres fora dela (ex.: emoji) são trocados pelo
 * equivalente sem acento ou por "?" para nunca gerar símbolos corrompidos.
 */
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
// ─── Word (.docx) ─────────────────────────────────────────────────────────────

/** Ficha cadastral em Word: mesmo conteúdo e ordem do PDF e do Excel. Página A4 retrato. */
export async function gerarFichaWord(
  nome: string, empresa: string, secoes: SecaoFicha[], emissao: DadosEmissao,
): Promise<Buffer> {
  const FONTE = "Arial";
  const LARGURA = 9638;            // A4 (11906) menos margens de 1134 dos dois lados
  const COL_ROTULO = 3600;
  const COL_VALOR = LARGURA - COL_ROTULO;
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "D0D5DD" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const margemCelula = { top: 60, bottom: 60, left: 120, right: 120 };

  const tituloSecao = (titulo: string) => new TableRow({
    cantSplit: true,
    children: [new TableCell({
      columnSpan: 2, width: { size: LARGURA, type: WidthType.DXA }, borders: bordas, margins: margemCelula,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "E8EEF5" },
      children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: titulo.toUpperCase(), bold: true, font: FONTE, size: 20, color: "1E3A5F" })] })],
    })],
  });

  const linhaCampo = (rotulo: string, valor: string) => {
    const vazio = valor === VALOR_VAZIO;
    const paragrafosValor = (valor || VALOR_VAZIO).split("\n").map(t => new Paragraph({
      children: [new TextRun({ text: t, font: FONTE, size: 20, italics: vazio, color: vazio ? "9CA3AF" : "111827" })],
    }));
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: COL_ROTULO, type: WidthType.DXA }, borders: bordas, margins: margemCelula, verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({ children: [new TextRun({ text: rotulo, bold: true, font: FONTE, size: 20, color: "374151" })] })],
        }),
        new TableCell({
          width: { size: COL_VALOR, type: WidthType.DXA }, borders: bordas, margins: margemCelula, verticalAlign: VerticalAlign.TOP,
          children: paragrafosValor,
        }),
      ],
    });
  };

  const cabecalhoTabela = new TableRow({
    tableHeader: true,
    children: ["Campo / Informação", "Dados do colaborador"].map((t, i) => new TableCell({
      width: { size: i === 0 ? COL_ROTULO : COL_VALOR, type: WidthType.DXA }, borders: bordas, margins: margemCelula,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "334155" },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, font: FONTE, size: 20, color: "FFFFFF" })] })],
    })),
  });

  const linhas: TableRow[] = [cabecalhoTabela];
  for (const secao of secoes) {
    linhas.push(tituloSecao(secao.titulo));
    for (const campo of secao.campos) linhas.push(linhaCampo(campo.rotulo, campo.valor));
  }

  const doc = new Document({
    creator: "Gestão RH",
    title: `Ficha cadastral — ${nome}`,
    styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Página ", font: FONTE, size: 16, color: "6B7280" }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 16, color: "6B7280" }),
              new TextRun({ text: " de ", font: FONTE, size: 16, color: "6B7280" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONTE, size: 16, color: "6B7280" }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "1E3A5F" },
          spacing: { after: 120 },
          children: [new TextRun({ text: " FICHA CADASTRAL DO COLABORADOR", bold: true, font: FONTE, size: 28, color: "FFFFFF" })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: `${nome}${empresa ? " — " + empresa : ""}`, bold: true, font: FONTE, size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `Emitido em ${emissao.dataHoraBR}. Documento com dados pessoais — uso restrito do RH (LGPD).`, italics: true, font: FONTE, size: 18, color: "6B7280" })],
        }),
        new Table({ width: { size: LARGURA, type: WidthType.DXA }, columnWidths: [COL_ROTULO, COL_VALOR], rows: linhas }),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export function textoPdf(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) {
      out += ch;
    } else if (ch === "\t") {
      out += " ";
    } else if (code < 0x20) {
      continue;
    } else {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      out += base && base.codePointAt(0)! <= 0xff ? base : "?";
    }
  }
  return out;
}

export async function gerarFichaPdf(
  nome: string, empresa: string, secoes: SecaoFicha[], emissao: DadosEmissao,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 60, left: 50, right: 50 },
    bufferPages: true,
    info: { Title: textoPdf(`Ficha cadastral — ${nome}`), Author: "Gestão RH", Creator: "Gestão RH" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fim = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const esq = doc.page.margins.left;
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const limiteY = () => doc.page.height - doc.page.margins.bottom;
  const larguraRotulo = 175;
  const larguraValor = largura - larguraRotulo - 12;
  const azul = "#1E3A5F";

  // Cabeçalho do documento
  doc.rect(esq, 50, largura, 44).fill(azul);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(15)
    .text("FICHA CADASTRAL DO COLABORADOR", esq + 14, 58, { width: largura - 28 });
  doc.font("Helvetica").fontSize(9)
    .text(textoPdf(empresa ? `Gestão RH — ${empresa}` : "Gestão RH"), esq + 14, 77, { width: largura - 28 });
  doc.y = 106;
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(13)
    .text(textoPdf(nome), esq, doc.y, { width: largura });
  doc.moveDown(0.2);
  doc.fillColor("#6B7280").font("Helvetica").fontSize(8.5)
    .text(textoPdf(`Emitido em ${emissao.dataHoraBR}`), esq, doc.y, { width: largura });
  doc.moveDown(0.8);

  const desenharTituloSecao = (titulo: string) => {
    const y = doc.y;
    doc.rect(esq, y, largura, 18).fill("#E8EEF5");
    doc.rect(esq, y, 3, 18).fill(azul);
    doc.fillColor(azul).font("Helvetica-Bold").fontSize(9.5)
      .text(textoPdf(titulo.toUpperCase()), esq + 10, y + 5, { width: largura - 20, lineBreak: false });
    doc.y = y + 24;
  };

  /** Quebra o texto em linhas que cabem na largura, respeitando quebras manuais. */
  const quebrarLinhas = (texto: string, largura: number): string[] => {
    const linhas: string[] = [];
    for (const paragrafo of texto.split("\n")) {
      let atual = "";
      for (const palavra of paragrafo.split(/ +/)) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra;
        if (doc.widthOfString(tentativa) <= largura) { atual = tentativa; continue; }
        if (atual) linhas.push(atual);
        // Palavra maior que a coluna (ex.: e-mail longo): quebra por caractere
        let resto = palavra;
        while (doc.widthOfString(resto) > largura) {
          let n = resto.length - 1;
          while (n > 1 && doc.widthOfString(resto.slice(0, n)) > largura) n--;
          linhas.push(resto.slice(0, n));
          resto = resto.slice(n);
        }
        atual = resto;
      }
      linhas.push(atual);
    }
    return linhas;
  };

  for (const secao of secoes) {
    // Título da seção só começa se couber junto com o início do primeiro campo
    if (doc.y + 24 + 3 * 13 > limiteY()) doc.addPage();
    desenharTituloSecao(secao.titulo);

    for (const campo of secao.campos) {
      const vazio = campo.valor === VALOR_VAZIO;
      doc.font("Helvetica-Bold").fontSize(9);
      const linhasRotulo = quebrarLinhas(textoPdf(campo.rotulo), larguraRotulo);
      doc.font(vazio ? "Helvetica-Oblique" : "Helvetica").fontSize(9.5);
      let linhasValor = quebrarLinhas(textoPdf(campo.valor), larguraValor);
      const alturaLinha = doc.currentLineHeight(true) + 1;
      let primeiraParte = true;

      while (linhasValor.length > 0) {
        const disponiveis = Math.floor((limiteY() - doc.y - 8) / alturaLinha);
        const minimo = Math.min(linhasValor.length, Math.max(linhasRotulo.length, 2));
        if (disponiveis < minimo) {
          doc.addPage();
          desenharTituloSecao(`${secao.titulo} (continuação)`);
          continue;
        }
        const parte = linhasValor.slice(0, disponiveis);
        linhasValor = linhasValor.slice(parte.length);
        const y = doc.y;

        const rotulo = primeiraParte ? linhasRotulo : [`${textoPdf(campo.rotulo)} (cont.)`];
        doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9);
        rotulo.forEach((l, i) => doc.text(l, esq + 4, y + i * alturaLinha, { width: larguraRotulo, lineBreak: false }));

        doc.fillColor(vazio ? "#9CA3AF" : "#111827").font(vazio ? "Helvetica-Oblique" : "Helvetica").fontSize(9.5);
        parte.forEach((l, i) => doc.text(l, esq + larguraRotulo + 12, y + i * alturaLinha, { width: larguraValor, lineBreak: false }));

        const yFim = y + Math.max(rotulo.length, parte.length) * alturaLinha + 3;
        doc.moveTo(esq, yFim).lineTo(esq + largura, yFim).lineWidth(0.4).strokeColor("#E5E7EB").stroke();
        doc.y = yFim + 5;
        primeiraParte = false;
      }
    }
    doc.moveDown(0.6);
  }

  // Rodapé com numeração em todas as páginas
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const yRodape = doc.page.height - 40;
    doc.moveTo(esq, yRodape - 6).lineTo(esq + largura, yRodape - 6).lineWidth(0.4).strokeColor("#D1D5DB").stroke();
    doc.fillColor("#6B7280").font("Helvetica").fontSize(7.5);
    doc.text(textoPdf("Documento com dados pessoais — uso restrito do RH (LGPD)."), esq, yRodape,
      { width: largura - 90, lineBreak: false, height: 10 });
    doc.text(`Página ${i - range.start + 1} de ${range.count}`, esq + largura - 90, yRodape,
      { width: 90, align: "right", lineBreak: false, height: 10 });
  }
  doc.end();
  return fim;
}

// ─── Rota de download ───────────────────────────────────────────────────────

export function registerFichaExportRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => unknown,
) {
  app.get("/api/colaboradores/:id/ficha", requireAuth, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const formato = String(req.query.formato ?? "");
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Colaborador inválido" });
    if (formato !== "pdf" && formato !== "xlsx" && formato !== "docx") return res.status(400).json({ error: "Formato inválido" });

    try {
      // Leitura direta do banco, sem cache: sempre os dados atuais do cadastro
      const colaborador = await getColaboradorById(id);
      if (!colaborador) return res.status(404).json({ error: "Colaborador não encontrado" });

      const emissao = emissaoAgora();
      const secoes = montarFichaColaborador(colaborador as any, emissao.dataIso);
      const empresa = colaborador.empresaNome ?? "";
      const arquivo = nomeArquivoFicha(colaborador.nome);

      let buffer: Buffer;
      if (formato === "pdf") {
        // PDF: Ficha de Registro no modelo oficial da empresa do colaborador
        // (FREIRE, JOANES, SOLAR ou SUDOESTE). Outra empresa usa a ficha padrão.
        const escolha = escolherModelo(colaborador.empresaNome);
        const dados = escolha ? await carregarDadosFichaRegistro(id) : null;
        buffer = escolha && dados
          ? await desenharFichaPdf(
              preencherModelo(escolha.modelo, montarMapaFichaRegistro(dados, emissao.dataIso)),
              `Ficha de Registro — ${colaborador.nome}`,
            )
          : await gerarFichaPdf(colaborador.nome, empresa, secoes, emissao);
      } else if (formato === "docx") {
        buffer = await gerarFichaWord(colaborador.nome, empresa, secoes, emissao);
      } else {
        buffer = await gerarFichaExcel(colaborador.nome, empresa, secoes, emissao);
      }

      res.setHeader("Content-Type", formato === "pdf"
        ? "application/pdf"
        : formato === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${arquivo}.${formato}"`);
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Content-Length", String(buffer.length));
      return res.end(buffer);
    } catch (error) {
      // Sem dados pessoais no log: apenas o id e a mensagem técnica
      console.error(`[FichaExport] Falha ao gerar ficha ${formato} do colaborador ${id}:`, (error as Error).message);
      return res.status(500).json({ error: "Não foi possível gerar a ficha" });
    }
  });
}
