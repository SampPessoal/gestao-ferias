/**
 * Ficha de Registro do colaborador em PDF, no modelo oficial de cada empresa
 * (FREIRE, JOANES, SOLAR e SUDOESTE).
 *
 * Os modelos vêm dos arquivos .docx do RH, convertidos para uma descrição fiel de
 * layout (larguras, cores, bordas, fontes e textos) em ./modelos. Aqui o modelo é
 * preenchido com os dados do colaborador e desenhado no PDF.
 *
 * Regras do preenchimento:
 * - Só preenche o que existe no cadastro. Campo sem dado mantém os pontilhados do
 *   modelo, para ser completado à mão, como na ficha original.
 * - Caixas "(  )" só são marcadas quando o cadastro informa a opção.
 */
import PDFDocument from "pdfkit";
import type { Celula, ModeloFicha, Paragrafo, Run, Tabela } from "./tipos";
import freire from "./modelos/freire";
import joanes from "./modelos/joanes";
import solar from "./modelos/solar";
import sudoeste from "./modelos/sudoeste";

export const MODELOS: Record<string, ModeloFicha> = { FREIRE: freire, JOANES: joanes, SOLAR: solar, SUDOESTE: sudoeste };

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizar = (s: string) => semAcento(s).toUpperCase().replace(/\s+/g, " ").trim().replace(/[:?]+$/, "").trim();

/** Modelo da empresa do colaborador, pelo nome da empresa no cadastro. */
export function escolherModelo(empresaNome: string | null | undefined): { empresa: string; modelo: ModeloFicha } | null {
  const nome = normalizar(empresaNome ?? "");
  for (const empresa of Object.keys(MODELOS)) {
    if (new RegExp(`\\b${empresa}\\b`).test(nome)) return { empresa, modelo: MODELOS[empresa] };
  }
  return null;
}

// ─── Preenchimento ───────────────────────────────────────────────────────────

/** O que preencher num campo do modelo. */
export type Preenchimento = {
  /** Valores para os pontilhados do campo, na ordem em que aparecem. undefined mantém o pontilhado. */
  valores?: (string | undefined)[];
  /** Opções a marcar com X (texto da opção; termina com * para "começa com"). */
  marcar?: string[];
  /**
   * Campo de valor em R$: se o modelo já traz um valor impresso (ex.: "R$: 11,80"),
   * ele é trocado pelo valor do cadastro. Sem valor no cadastro, fica o do modelo.
   */
  valorMonetario?: boolean;
};

/** Mapa rótulo do campo (normalizado) → preenchimento. Rótulos repetidos usam "ROTULO#2", "#3"... */
export type MapaPreenchimento = Record<string, Preenchimento>;

// Espaço para preencher no modelo: data "… / … / …", sequências de "…", de pontos ou de "_".
const RE_PONTILHADO = /[….]+\s*\/\s*[….]*\s*\/\s*[….]+|…[….]*|\.{2,}[….]*|_{3,}/g;
// Valor em R$ já impresso no modelo, ex.: "R$: 11,80" ou "R$: 39,52 OU 25,49."
const RE_VALOR_IMPRESSO = /(R\$:?\s*)\d[\d.]*,\d{2}(?:\s*OU\s*\d[\d.]*,\d{2})?\.?/i;
// Caixa de opção: "(  ) TEXTO" até a próxima caixa ou quebra de linha
const RE_CAIXA = /\(\s*\)(\s*)([^()\n]*?)(?=\s*\(\s*\)|\n|$)/g;

function opcaoConfere(opcao: string, alvo: string): boolean {
  const o = normalizar(opcao).replace(/\.$/, "");
  if (alvo.endsWith("*")) return o.startsWith(normalizar(alvo.slice(0, -1)));
  return o === normalizar(alvo).replace(/\.$/, "");
}

function aplicar(texto: string, p: Preenchimento): string {
  let out = texto;
  if (p.marcar?.length) {
    out = out.replace(RE_CAIXA, (inteiro, esp: string, opcao: string) =>
      p.marcar!.some(a => opcaoConfere(opcao, a)) ? `(X)${esp}${opcao}` : inteiro);
  }
  if (p.valores?.length) {
    let i = 0;
    const antes = out;
    out = out.replace(RE_PONTILHADO, ph => {
      const v = p.valores![i++];
      return v === undefined || v === "" ? ph : v;
    });
    // Valor já impresso no modelo (sem pontilhado): troca pelo valor do cadastro
    const v0 = p.valores[0];
    if (p.valorMonetario && out === antes && v0 && !RE_PONTILHADO.test(antes)) {
      out = out.replace(RE_VALOR_IMPRESSO, (_m, prefixo: string) => `${prefixo}${v0}`);
    }
    RE_PONTILHADO.lastIndex = 0;
  }
  return out;
}

const ehCabecalhoDeSecao = (c: Celula) => c.paras.some(p => p.runs.some(r => r.c.toUpperCase() === "FFFFFF"));

/** Separa o rótulo (negrito inicial) do restante do parágrafo. */
function separarRotulo(p: Paragrafo): { rotulo: string; nRotulo: number } {
  let rotulo = "";
  let n = 0;
  for (const r of p.runs) {
    if (!r.b) break;
    rotulo += r.t;
    n++;
  }
  return { rotulo: normalizar(rotulo.replace(/\n/g, " ")), nRotulo: n };
}

/** Devolve uma cópia do modelo com os campos preenchidos. */
export function preencherModelo(modelo: ModeloFicha, mapa: MapaPreenchimento): ModeloFicha {
  const copia: ModeloFicha = JSON.parse(JSON.stringify(modelo));
  const ocorrencias = new Map<string, number>();
  for (const bloco of copia.blocks) {
    if (bloco.type !== "table") continue;
    for (const linha of bloco.rows) {
      for (const celula of linha.cells) {
        if (ehCabecalhoDeSecao(celula)) continue;
        for (const p of celula.paras) {
          const { rotulo, nRotulo } = separarRotulo(p);
          if (!rotulo) continue;
          const n = (ocorrencias.get(rotulo) ?? 0) + 1;
          ocorrencias.set(rotulo, n);
          const preench = mapa[n > 1 ? `${rotulo}#${n}` : rotulo];
          if (!preench) continue;
          const resto = p.runs.slice(nRotulo);
          if (!resto.length) continue;
          const estilo = resto.find(r => r.t.trim()) ?? resto[0];
          const texto = resto.map(r => r.t).join("");
          const novo = aplicar(texto, preench);
          if (novo === texto) continue;
          p.runs = [...p.runs.slice(0, nRotulo), { t: novo, b: false, sz: estilo.sz, c: estilo.c }];
        }
      }
    }
  }
  return copia;
}

// ─── Desenho do PDF ──────────────────────────────────────────────────────────

const PT = (twips: number) => twips / 20;
const FATOR_LINHA = 1.15; // altura de linha "simples" do Arial no Word

/** Fonte padrão do PDF (Helvetica, mesmas medidas do Arial) só aceita WinAnsi. */
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function textoWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else if (ch === "\n") out += ch;
    else if (ch === "\t") out += "    ";
    else {
      const base = semAcento(ch);
      out += base && base.codePointAt(0)! <= 0xff ? base : "?";
    }
  }
  return out;
}

type Pedaco = { t: string; b: boolean; sz: number; c: string; w: number };
type LinhaTexto = { pedacos: Pedaco[]; largura: number; alt: number; asc: number };

function fonte(doc: PDFKit.PDFDocument, b: boolean, sz: number) {
  doc.font(b ? "Helvetica-Bold" : "Helvetica").fontSize(sz / 2);
}

/** Quebra um parágrafo em linhas que cabem na largura, como o Word. */
function montarLinhas(doc: PDFKit.PDFDocument, p: Paragrafo, largura: number): LinhaTexto[] {
  const linhas: LinhaTexto[] = [];
  let atual: Pedaco[] = [];
  let larg = 0;
  const fechar = () => {
    // remove espaços no fim da linha
    while (atual.length && !atual[atual.length - 1].t.trim()) larg -= atual.pop()!.w;
    const maior = Math.max(p.sz, ...atual.map(x => x.sz)) / 2;
    linhas.push({ pedacos: atual, largura: larg, alt: maior * FATOR_LINHA * (p.line / 240), asc: maior * 0.905 });
    atual = [];
    larg = 0;
  };
  const runs: Run[] = p.runs.map(r => ({ ...r, t: textoWinAnsi(r.t) }));
  for (const r of runs) {
    const partes = r.t.split("\n");
    partes.forEach((parte, i) => {
      if (i > 0) fechar();
      for (const tok of parte.split(/( +)/)) {
        if (!tok) continue;
        fonte(doc, r.b, r.sz);
        const w = doc.widthOfString(tok);
        if (larg + w > largura + 0.01 && tok.trim() && atual.some(x => x.t.trim())) fechar();
        if (!atual.length && !tok.trim()) continue; // sem espaço no início de linha quebrada
        atual.push({ t: tok, b: r.b, sz: r.sz, c: r.c, w });
        larg += w;
      }
    });
  }
  fechar();
  return linhas;
}

function alturaParagrafo(linhas: LinhaTexto[], p: Paragrafo) {
  return PT(p.before) + linhas.reduce((s, l) => s + l.alt, 0) + PT(p.after);
}

function desenharParagrafo(doc: PDFKit.PDFDocument, p: Paragrafo, linhas: LinhaTexto[], x: number, y: number, largura: number) {
  let yy = y + PT(p.before);
  for (const l of linhas) {
    const desloc = p.align === "center" ? (largura - l.largura) / 2 : p.align === "right" ? largura - l.largura : 0;
    let xx = x + desloc;
    // Linha base: proporção ascendente/altura de linha do Arial (0,905 / 1,15)
    const base = yy + l.alt * 0.787;
    for (const ped of l.pedacos) {
      fonte(doc, ped.b, ped.sz);
      const ascFonte = (doc as any)._font.ascender / 1000 * (ped.sz / 2);
      doc.fillColor(`#${ped.c}`).text(ped.t, xx, base - ascFonte, { lineBreak: false });
      xx += ped.w;
    }
    yy += l.alt;
  }
}

export function desenharFichaPdf(modelo: ModeloFicha, titulo: string): Promise<Buffer> {
  const pg = modelo.page;
  const doc = new PDFDocument({
    size: [PT(pg.w), PT(pg.h)],
    margins: { top: PT(pg.top), bottom: PT(pg.bottom), left: PT(pg.left), right: PT(pg.right) },
    autoFirstPage: true,
    info: { Title: textoWinAnsi(titulo), Author: "Gestão RH", Creator: "Gestão RH" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fim = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const larguraUtil = PT(pg.w - pg.left - pg.right);
  const limite = PT(pg.h - pg.bottom);
  let y = PT(pg.top);
  let primeiroCabecalho = true;

  for (const bloco of modelo.blocks) {
    if (bloco.type === "p") {
      const linhas = montarLinhas(doc, bloco, larguraUtil);
      const h = alturaParagrafo(linhas, bloco);
      if (!bloco.runs.some(r => r.t.trim())) { y += Math.min(h, 6); continue; }
      desenharParagrafo(doc, bloco, linhas, PT(pg.left), y, larguraUtil);
      y += h;
      continue;
    }
    const tabela = bloco as Tabela;
    for (const linha of tabela.rows) {
      const larguraTabela = PT(linha.cells.reduce((s, c) => s + c.w, 0));
      const x0 = PT(pg.left) + (tabela.align === "center" ? (larguraUtil - larguraTabela) / 2 : 0);
      // Cabeçalho "S | EMPRESA | PÁGINA" de cada página: começa página nova (exceto o primeiro)
      const ehCabecalhoPagina = linha.cells[0]?.paras.map(p => p.runs.map(r => r.t).join("")).join("").trim() === "S";
      const conteudo = linha.cells.map(c => {
        const inner = PT(c.w - c.mar.left - c.mar.right);
        const ps = c.paras.map(p => ({ p, linhas: montarLinhas(doc, p, inner) }));
        const h = PT(c.mar.top + c.mar.bottom) + ps.reduce((s, x) => s + alturaParagrafo(x.linhas, x.p), 0);
        return { c, ps, h };
      });
      const alturaLinha = linha.exact ? PT(linha.minH) : Math.max(PT(linha.minH), ...conteudo.map(x => x.h));

      if (ehCabecalhoPagina) {
        if (!primeiroCabecalho) { doc.addPage(); y = PT(pg.top); }
        primeiroCabecalho = false;
      } else if (y + alturaLinha > limite) {
        doc.addPage();
        y = PT(pg.top);
      }

      let x = x0;
      for (const { c, ps, h } of conteudo) {
        const w = PT(c.w);
        if (c.fill && c.fill !== "auto") doc.rect(x, y, w, alturaLinha).fill(`#${c.fill}`);
        let yc = y + PT(c.mar.top);
        if (c.valign === "center") yc += (alturaLinha - h) / 2;
        else if (c.valign === "bottom") yc += alturaLinha - h;
        for (const { p, linhas } of ps) {
          desenharParagrafo(doc, p, linhas, x + PT(c.mar.left), yc, PT(c.w - c.mar.left - c.mar.right));
          yc += alturaParagrafo(linhas, p);
        }
        const lados: [keyof Celula["borders"], number, number, number, number][] = [
          ["top", x, y, x + w, y], ["bottom", x, y + alturaLinha, x + w, y + alturaLinha],
          ["left", x, y, x, y + alturaLinha], ["right", x + w, y, x + w, y + alturaLinha],
        ];
        for (const [lado, x1, y1, x2, y2] of lados) {
          const b = c.borders[lado];
          if (b) doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(b.sz / 8).strokeColor(`#${b.c}`).stroke();
        }
        x += w;
      }
      y += alturaLinha;
    }
  }
  doc.end();
  return fim;
}
