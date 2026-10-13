/** Layout de um modelo de Ficha de Registro, extraído do .docx (medidas em twips: 1/20 pt). */
export type Run = { t: string; b: boolean; sz: number; c: string };
export type Paragrafo = {
  type: "p";
  align: string | null;
  before: number;
  after: number;
  line: number; // espaçamento "auto" do Word: 240 = simples
  sz: number;
  runs: Run[];
};
export type Borda = { sz: number; c: string } | null;
export type Celula = {
  w: number;
  fill: string | null;
  valign: string | null;
  mar: { top: number; left: number; bottom: number; right: number };
  borders: { top: Borda; left: Borda; bottom: Borda; right: Borda };
  paras: Paragrafo[];
};
export type Linha = { minH: number; exact: boolean; cells: Celula[] };
export type Tabela = { type: "table"; align: string | null; rows: Linha[] };
export type ModeloFicha = {
  page: { w: number; h: number; top: number; right: number; bottom: number; left: number };
  blocks: (Paragrafo | Tabela)[];
};
