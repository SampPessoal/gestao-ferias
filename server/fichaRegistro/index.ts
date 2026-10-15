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
  /** Trocas de texto feitas antes de tudo: [expressão regular, flags, texto novo]. */
  substituir?: [string, string, string][];
  /**
   * Reescreve o campo inteiro (abaixo do rótulo) com este texto. Usado em campos
   * cujo formato muda entre os modelos (supervisor, jornada, instituição).
   */
  reescrever?: string;
};

/** Rótulos que alguns modelos escrevem com texto extra em negrito (Joanes: "SUPERVISOR / CPF NOME: CPF: FUNÇÃO"). */
const ROTULOS_POR_PREFIXO = ["SUPERVISOR / CPF"];

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
  for (const [padrao, flags, novo] of p.substituir ?? []) out = out.replace(new RegExp(padrao, flags), novo);
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

/** "DEPENDENTES  DEP. P/ IR (  ) SIM (  ) NÃO (  ) N/A" fica na faixa de título da seção. */
function marcarDependenteIR(celula: Celula, p: Preenchimento | undefined) {
  const alvo = p?.marcar?.[0];
  if (!alvo) return;
  for (const par of celula.paras) {
    const i = par.runs.findIndex(r => /DEP\. P\/ IR/.test(r.t));
    if (i < 0) continue;
    // A caixa do "SIM" começa no rótulo em negrito ("(") e fecha no texto seguinte ("  ) SIM")
    for (let j = i + 1; j < par.runs.length; j++) {
      const r = par.runs[j];
      if (normalizar(alvo) === "SIM") r.t = r.t.replace(/^\s*\)/, "X)");
      else r.t = r.t.replace(RE_CAIXA, (inteiro, esp: string, opcao: string) => opcaoConfere(opcao, alvo) ? `(X)${esp}${opcao}` : inteiro);
    }
    return;
  }
}

/** Devolve uma cópia do modelo com os campos preenchidos. */
export function preencherModelo(modelo: ModeloFicha, mapa: MapaPreenchimento): ModeloFicha {
  const copia: ModeloFicha = JSON.parse(JSON.stringify(modelo));
  const ocorrencias = new Map<string, number>();
  for (const bloco of copia.blocks) {
    if (bloco.type !== "table") continue;
    for (const linha of bloco.rows) {
      for (const celula of linha.cells) {
        if (ehCabecalhoDeSecao(celula)) {
          marcarDependenteIR(celula, mapa["DEP. P/ IR"]);
          continue;
        }
        for (let ip = 0; ip < celula.paras.length; ip++) {
          const p: Paragrafo = celula.paras[ip];
          const { rotulo, nRotulo } = separarRotulo(p);
          if (!rotulo) continue;
          const n = (ocorrencias.get(rotulo) ?? 0) + 1;
          ocorrencias.set(rotulo, n);
          const prefixo = ROTULOS_POR_PREFIXO.find(r => rotulo.startsWith(r));
          const preench = mapa[n > 1 ? `${rotulo}#${n}` : rotulo] ?? (prefixo ? mapa[prefixo] : undefined);
          if (!preench) continue;
          if (preench.reescrever) {
            // Mantém só a primeira linha do rótulo (em negrito) e escreve o campo de novo
            const cab = p.runs[0];
            const titulo = p.runs.slice(0, nRotulo).map((r: Run) => r.t).join("").split("\n")[0].trimEnd();
            const estiloResto = p.runs.slice(nRotulo).find((r: Run) => r.t.trim()) ?? { sz: cab.sz, c: "24323A" };
            p.runs = [
              { t: titulo, b: true, sz: cab.sz, c: cab.c },
              { t: `\n${preench.reescrever}`, b: false, sz: estiloResto.sz, c: estiloResto.c },
            ];
            celula.paras.splice(ip + 1); // o restante do campo (linhas soltas em alguns modelos)
            break;
          }
          const resto = p.runs.slice(nRotulo);
          if (!resto.length) continue;
          const estilo = resto.find((r: Run) => r.t.trim()) ?? resto[0];
          const texto = resto.map((r: Run) => r.t).join("");
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

/** Margem de segurança para impressão (pt). O conteúdo ocupa todo o resto da folha. */
const MARGEM_IMPRESSAO = 14;

type CelulaPronta = { c: Celula; x: number; w: number; ml: number; mr: number; ps: { p: Paragrafo; linhas: LinhaTexto[] }[]; h: number };
type ItemPagina =
  | { tipo: "p"; p: Paragrafo; linhas: LinhaTexto[]; h: number }
  | { tipo: "linha"; celulas: CelulaPronta[]; natural: number; fixa: boolean; altura: number };

/** Parágrafo com letras e espaçamentos multiplicados por fs. */
function escalarParagrafo(p: Paragrafo, fs: number): Paragrafo {
  return { ...p, sz: p.sz * fs, before: p.before * fs, after: p.after * fs, runs: p.runs.map(r => ({ ...r, sz: r.sz * fs })) };
}

const textoDaCelula = (c: Celula) => c.paras.map(p => p.runs.map(r => r.t).join("")).join("").trim();

/**
 * Monta as páginas com a letra multiplicada por fs. Cada linha da tabela é
 * esticada na largura para ocupar a folha toda (margem mínima de impressão).
 * Uma página nova começa em cada cabeçalho "S | EMPRESA | PÁGINA" do modelo.
 */
function montarPaginas(doc: PDFKit.PDFDocument, modelo: ModeloFicha, fs: number, larguraUtil: number): ItemPagina[][] {
  const paginas: ItemPagina[][] = [[]];
  let primeiroCabecalho = true;
  for (const bloco of modelo.blocks) {
    if (bloco.type === "p") {
      if (!bloco.runs.some(r => r.t.trim())) continue; // parágrafo vazio de espaçamento do Word
      const p = escalarParagrafo(bloco, fs);
      const linhas = montarLinhas(doc, p, larguraUtil);
      paginas[paginas.length - 1].push({ tipo: "p", p, linhas, h: alturaParagrafo(linhas, p) });
      continue;
    }
    for (const linha of (bloco as Tabela).rows) {
      const ehCabecalhoPagina = textoDaCelula(linha.cells[0] ?? ({ paras: [] } as any)) === "S";
      if (ehCabecalhoPagina) {
        if (!primeiroCabecalho) paginas.push([]);
        primeiroCabecalho = false;
      }
      const totalTwips = linha.cells.reduce((s, c) => s + c.w, 0);
      const kx = larguraUtil / PT(totalTwips); // estica a linha para a largura da folha
      let x = MARGEM_IMPRESSAO;
      const celulas: CelulaPronta[] = linha.cells.map(c => {
        const w = PT(c.w) * kx;
        // No cabeçalho da página as células são estreitas: margem interna mínima para
        // "PÁGINA 01 / 02" e o nome da empresa não quebrarem linha
        const ml = ehCabecalhoPagina ? Math.min(PT(c.mar.left), 2) : PT(c.mar.left);
        const mr = ehCabecalhoPagina ? Math.min(PT(c.mar.right), 2) : PT(c.mar.right);
        const inner = w - ml - mr;
        const ps = c.paras.map(p0 => {
          const p = escalarParagrafo(p0, fs);
          return { p, linhas: montarLinhas(doc, p, inner) };
        });
        const h = PT(c.mar.top + c.mar.bottom) + ps.reduce((s, q) => s + alturaParagrafo(q.linhas, q.p), 0);
        const pronta = { c, x, w, ml, mr, ps, h };
        x += w;
        return pronta;
      });
      const natural = linha.exact ? PT(linha.minH) * fs : Math.max(PT(linha.minH) * fs, ...celulas.map(q => q.h));
      // Faixas de título de seção e o cabeçalho da página mantêm a altura; as demais linhas crescem
      const fixa = linha.exact || ehCabecalhoPagina || linha.cells.some(ehCabecalhoDeSecao);
      paginas[paginas.length - 1].push({ tipo: "linha", celulas, natural, fixa, altura: natural });
    }
  }
  return paginas;
}

const alturaItem = (it: ItemPagina) => (it.tipo === "p" ? it.h : it.natural);

export function desenharFichaPdf(modelo: ModeloFicha, titulo: string): Promise<Buffer> {
  const pg = modelo.page;
  const doc = new PDFDocument({
    size: [PT(pg.w), PT(pg.h)],
    margins: { top: MARGEM_IMPRESSAO, bottom: MARGEM_IMPRESSAO, left: MARGEM_IMPRESSAO, right: MARGEM_IMPRESSAO },
    autoFirstPage: true,
    info: { Title: textoWinAnsi(titulo), Author: "Gestão RH", Creator: "Gestão RH" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fim = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const larguraUtil = PT(pg.w) - 2 * MARGEM_IMPRESSAO;
  const alturaUtil = PT(pg.h) - 2 * MARGEM_IMPRESSAO;

  // Maior letra (igual nas duas páginas) em que todo o conteúdo cabe na folha;
  // textos muito longos reduzem a letra em vez de criar uma terceira página.
  let paginas: ItemPagina[][] = [];
  for (let fs = 1.4; fs >= 0.55; fs -= 0.025) {
    paginas = montarPaginas(doc, modelo, fs, larguraUtil);
    if (paginas.every(itens => itens.reduce((s, it) => s + alturaItem(it), 0) <= alturaUtil)) break;
  }

  paginas.forEach((itens, n) => {
    if (n > 0) doc.addPage();
    // Distribui o espaço que sobra entre as linhas de campos, para a ficha ocupar a página inteira
    const natural = itens.reduce((s, it) => s + alturaItem(it), 0);
    const elasticas = itens.filter(it => it.tipo === "linha" && !it.fixa) as Extract<ItemPagina, { tipo: "linha" }>[];
    const somaElasticas = elasticas.reduce((s, it) => s + it.natural, 0);
    const sobra = Math.max(0, alturaUtil - natural);
    for (const it of elasticas) it.altura = it.natural + (somaElasticas ? sobra * (it.natural / somaElasticas) : 0);

    let y = MARGEM_IMPRESSAO;
    for (const it of itens) {
      if (it.tipo === "p") {
        desenharParagrafo(doc, it.p, it.linhas, MARGEM_IMPRESSAO, y, larguraUtil);
        y += it.h;
        continue;
      }
      const alturaLinha = it.altura;
      for (const { c, x, w, ml, mr, ps, h } of it.celulas) {
        if (c.fill && c.fill !== "auto") doc.rect(x, y, w, alturaLinha).fill(`#${c.fill}`);
        // Conteúdo centralizado na altura da linha (o Word alinha ao topo só quando a linha não cresce)
        let yc = y + PT(c.mar.top);
        if (c.valign === "bottom") yc += alturaLinha - h;
        else if (c.valign === "center" || !it.fixa) yc += (alturaLinha - h) / 2;
        for (const { p, linhas } of ps) {
          desenharParagrafo(doc, p, linhas, x + ml, yc, w - ml - mr);
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
      }
      y += alturaLinha;
    }
  });
  doc.end();
  return fim;
}
