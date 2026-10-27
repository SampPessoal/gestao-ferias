/**
 * Registro de Empregado — campos complementares da Ficha de Registro.
 *
 * Fonte ÚNICA destes campos: a coluna no banco, a validação do servidor, a tela
 * do colaborador e o preenchimento do PDF usam esta lista. Para criar um campo
 * novo, basta acrescentá-lo aqui (o banco cria a coluna sozinho na inicialização).
 */

export type Opcao = { valor: string; rotulo: string };
export type TipoCampo = "texto" | "opcao" | "data" | "moeda" | "hora" | "cpf" | "cnpj" | "email";

export type CampoRegistro = {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  grupo: GrupoRegistro;
  opcoes?: Opcao[];
  max?: number;
  dica?: string;
  /** Ocupa a linha inteira no formulário */
  largo?: boolean;
  /** Mostra a caixa "Não se aplica" ao lado do campo (grava o texto NÃO SE APLICA) */
  naoSeAplica?: boolean;
  /** Fica desativado e vazio quando o campo indicado está como "Não se aplica" */
  dependeDe?: string;
};

/** Valor gravado quando o campo é marcado como "Não se aplica". */
export const NAO_SE_APLICA = "NÃO SE APLICA";
/** Reconhece "NÃO SE APLICA" também quando foi digitado à mão (com ou sem acento). */
export const ehNaoSeAplica = (v: string | null | undefined) =>
  !!v && v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim() === "NAO SE APLICA";

/** Atualiza um campo do formulário; marcar "Não se aplica" limpa os campos que dependem dele. */
export function aplicarCampo<T extends Record<string, string>>(form: T, chave: string, valor: string): T {
  const novo: Record<string, string> = { ...form, [chave]: valor };
  if (ehNaoSeAplica(valor)) for (const c of CAMPOS_REGISTRO) if (c.dependeDe === chave) novo[c.chave] = "";
  return novo as T;
}

export type GrupoRegistro = "pessoal" | "contrato" | "formacao" | "beneficios";

export const GRUPOS_REGISTRO: { id: GrupoRegistro; titulo: string; descricao: string }[] = [
  { id: "pessoal", titulo: "Pessoal e documentos", descricao: "Raça, filiação, CNH, CTPS e e-mail pessoal" },
  { id: "contrato", titulo: "Contrato e jornada", descricao: "Vínculo, remuneração, experiência, jornada e supervisor" },
  { id: "formacao", titulo: "Formação e estágio", descricao: "Grau de instrução, curso e dados do estágio" },
  { id: "beneficios", titulo: "Sindicato e benefícios", descricao: "Sindicato, vale-transporte, odontológico e TotalPass" },
];

const SIM_NAO_NA: Opcao[] = [
  { valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }, { valor: "na", rotulo: "N/A" },
];

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const CAMPOS_REGISTRO: CampoRegistro[] = [
  // ── Pessoal e documentos
  { chave: "raca", rotulo: "Raça", tipo: "opcao", grupo: "pessoal", opcoes: [
    { valor: "preta", rotulo: "Preta" }, { valor: "branca", rotulo: "Branca" }, { valor: "parda", rotulo: "Parda" },
    { valor: "amarela", rotulo: "Amarela" }, { valor: "indigena", rotulo: "Indígena" },
  ], largo: true },
  { chave: "nacionalidadePai", rotulo: "Nacionalidade do pai", tipo: "texto", grupo: "pessoal", max: 60, dica: "Ex.: Brasileira" },
  { chave: "nacionalidadeMae", rotulo: "Nacionalidade da mãe", tipo: "texto", grupo: "pessoal", max: 60, dica: "Ex.: Brasileira" },
  { chave: "ctpsUf", rotulo: "UF da CTPS", tipo: "opcao", grupo: "pessoal", opcoes: UFS.map(u => ({ valor: u, rotulo: u })) },
  { chave: "cnhNumero", rotulo: "CNH — número", tipo: "texto", grupo: "pessoal", max: 20, naoSeAplica: true },
  { chave: "cnhCategoria", rotulo: "CNH — categoria", tipo: "opcao", grupo: "pessoal", dependeDe: "cnhNumero", opcoes:
    ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"].map(c => ({ valor: c, rotulo: c })) },
  { chave: "cnhValidade", rotulo: "CNH — validade", tipo: "data", grupo: "pessoal", dependeDe: "cnhNumero" },
  { chave: "emailPessoal", rotulo: "E-mail pessoal", tipo: "email", grupo: "pessoal", max: 200, largo: true },
  { chave: "cidadeInterior", rotulo: "Cidade do interior", tipo: "texto", grupo: "pessoal", max: 100, dica: "Ex.: Paulo Afonso - BA" },

  // ── Contrato e jornada
  { chave: "vinculo", rotulo: "Vínculo", tipo: "opcao", grupo: "contrato", opcoes: [
    { valor: "clt", rotulo: "CLT" }, { valor: "estagio", rotulo: "Estágio" },
  ] },
  { chave: "primeiroTrabalho", rotulo: "1º trabalho", tipo: "opcao", grupo: "contrato", opcoes: [
    { valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }, { valor: "estagio", rotulo: "Estágio" },
  ] },
  { chave: "contratoExperiencia", rotulo: "Contrato de experiência", tipo: "opcao", grupo: "contrato", opcoes: [
    { valor: "45_45", rotulo: "45 + 45 dias" }, { valor: "01_ano", rotulo: "01 ano" }, { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ] },
  { chave: "cbo", rotulo: "CBO", tipo: "texto", grupo: "contrato", max: 10, dica: "Ex.: 2521-05" },
  { chave: "remuneracao", rotulo: "Remuneração (R$)", tipo: "moeda", grupo: "contrato" },
  { chave: "jornadaEntrada", rotulo: "Jornada — entrada", tipo: "hora", grupo: "contrato" },
  { chave: "jornadaSaida", rotulo: "Jornada — saída", tipo: "hora", grupo: "contrato" },
  { chave: "jornadaIntervalo", rotulo: "Intervalo (horas)", tipo: "texto", grupo: "contrato", max: 10, dica: "Ex.: 1" },
  { chave: "supervisorNome", rotulo: "Supervisor — nome", tipo: "texto", grupo: "contrato", max: 200 },
  { chave: "supervisorCpf", rotulo: "Supervisor — CPF", tipo: "cpf", grupo: "contrato", max: 14 },
  { chave: "supervisorFuncao", rotulo: "Supervisor — função", tipo: "texto", grupo: "contrato", max: 100 },

  // ── Formação e estágio
  { chave: "grauInstrucao", rotulo: "Grau de instrução", tipo: "opcao", grupo: "formacao", opcoes: [
    { valor: "ensino_medio", rotulo: "Ensino médio" }, { valor: "graduacao", rotulo: "Graduação" },
    { valor: "pos_graduacao", rotulo: "Pós-graduação" }, { valor: "mestrado", rotulo: "Mestrado" },
  ] },
  { chave: "situacaoCurso", rotulo: "Situação do curso", tipo: "opcao", grupo: "formacao", opcoes: [
    { valor: "em_andamento", rotulo: "Em andamento" }, { valor: "concluida", rotulo: "Concluída" }, { valor: "trancada", rotulo: "Trancada" },
  ] },
  { chave: "curso", rotulo: "Curso", tipo: "texto", grupo: "formacao", max: 200 },
  { chave: "semestre", rotulo: "Semestre", tipo: "opcao", grupo: "formacao", opcoes: [
    ...Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), rotulo: `${i + 1}º semestre` })),
    { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ] },
  { chave: "instituicaoEnsino", rotulo: "Instituição de ensino", tipo: "texto", grupo: "formacao", max: 200, largo: true },
  { chave: "instituicaoCnpj", rotulo: "CNPJ da instituição", tipo: "cnpj", grupo: "formacao", max: 18 },
  { chave: "periodoEstagio", rotulo: "Período de estágio", tipo: "opcao", grupo: "formacao", opcoes: [
    { valor: "sim", rotulo: "Sim" }, { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ] },
  { chave: "empresaEstagio", rotulo: "Empresa vinculada", tipo: "opcao", grupo: "formacao", opcoes: [
    { valor: "a3_estagios", rotulo: "A3 Estágios" }, { valor: "empresa", rotulo: "Própria empresa" }, { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ] },
  { chave: "apoliceSeguro", rotulo: "Apólice de seguro (nº)", tipo: "texto", grupo: "formacao", max: 50, naoSeAplica: true },

  // ── Sindicato e benefícios
  { chave: "sindicato", rotulo: "Sindicato", tipo: "opcao", grupo: "beneficios", opcoes: [
    { valor: "sindados", rotulo: "Sindados" }, { valor: "a3_estagios", rotulo: "A3 Estágios" },
  ] },
  { chave: "contribuicaoSindical", rotulo: "Contribuição sindical", tipo: "opcao", grupo: "beneficios", opcoes: [
    { valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }, { valor: "nao_se_aplica", rotulo: "Não se aplica" },
  ] },
  { chave: "motivoSemVT", rotulo: "Sem vale-transporte por", tipo: "opcao", grupo: "beneficios", opcoes: [
    { valor: "home_office", rotulo: "Home office" }, { valor: "opcao_nao", rotulo: "Opção por não" },
  ] },
  { chave: "descontoVT", rotulo: "Desconto de vale-transporte", tipo: "opcao", grupo: "beneficios", opcoes: [
    { valor: "sim", rotulo: "Sim" }, { valor: "opcao_nao", rotulo: "Opção não" }, { valor: "na", rotulo: "N/A" },
  ] },
  { chave: "planoOdontologico", rotulo: "Plano odontológico", tipo: "opcao", grupo: "beneficios", opcoes: SIM_NAO_NA },
  { chave: "totalpass", rotulo: "TotalPass / ginástica laboral", tipo: "opcao", grupo: "beneficios", opcoes: SIM_NAO_NA },
];

/** Tipo da coluna no PostgreSQL de cada tipo de campo. */
export function tipoSql(c: CampoRegistro): string {
  if (c.tipo === "data") return "date";
  if (c.tipo === "moeda") return "numeric(12,2)";
  return `varchar(${c.max ?? 40})`;
}

export const PARENTESCOS: Opcao[] = [
  { valor: "conjuge", rotulo: "Cônjuge" }, { valor: "filho", rotulo: "Filho" }, { valor: "filha", rotulo: "Filha" },
  { valor: "enteado", rotulo: "Enteado(a)" }, { valor: "outro", rotulo: "Outro" },
];

export type RegistroEmpregado = Record<string, string | null>;
export type Dependente = {
  id: number;
  nome: string;
  parentesco: string;
  dataNascimento: string | null;
  cpf: string | null;
  rg: string | null;
  dependenteIR: boolean;
};

export const rotuloOpcao = (c: CampoRegistro | undefined, valor: string | null | undefined) =>
  (valor && c?.opcoes?.find(o => o.valor === valor)?.rotulo) || valor || "";

/**
 * Campo do registro com as opções ajustadas ao colaborador: em "Empresa vinculada",
 * a opção "Própria empresa" mostra o nome da empresa dele (SOLAR, FREIRE...).
 */
export function campoParaColaborador(c: CampoRegistro, empresaNome?: string | null): CampoRegistro {
  if (c.chave !== "empresaEstagio" || !empresaNome) return c;
  return { ...c, opcoes: c.opcoes!.map(o => (o.valor === "empresa" ? { ...o, rotulo: empresaNome } : o)) };
}
