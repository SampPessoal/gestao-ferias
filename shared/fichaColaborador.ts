/**
 * Ficha cadastral do colaborador — fonte ÚNICA de seções, rótulos e valores
 * usada tanto na exportação em PDF quanto em Excel. Assim os dois arquivos
 * sempre mostram exatamente os mesmos campos, na mesma ordem e com os mesmos valores.
 *
 * Regras:
 * - Nenhum valor é inventado: campo vazio vira VALOR_VAZIO ("Não informado").
 * - Documentos, telefones, CEP etc. são mantidos como texto, exatamente como
 *   cadastrados (preserva zeros à esquerda, pontos e traços).
 * - Datas no formato DD/MM/AAAA, sem conversão de fuso.
 */

export const VALOR_VAZIO = "Não informado";

export type CampoFicha = { rotulo: string; valor: string };
export type SecaoFicha = { titulo: string; campos: CampoFicha[] };

/** Dados de entrada: o retorno de getColaboradorById (subconjunto usado aqui). */
export type ColaboradorFichaInput = {
  codigo?: string | null;
  nome: string;
  status?: string | null;
  dataDemissao?: unknown;
  admissao?: unknown;
  periodoAquisitivo?: unknown;
  vencimento?: unknown;
  dataLimite?: unknown;
  diasDireito?: number | null;
  saldo?: number | null;
  observacoes?: string | null;
  empresaNome?: string | null;
  setorNome?: string | null;
  dataNascimento?: unknown;
  nacionalidade?: string | null;
  estadoCivil?: string | null;
  naturalidade?: string | null;
  estado?: string | null;
  sexo?: string | null;
  temFilhos?: boolean | null;
  qtdFilhos?: number | null;
  idadeAdmissao?: number | null;
  rg?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  celular?: string | null;
  emailCorporativo?: string | null;
  cargo?: string | null;
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
  nomePai?: string | null;
  nomeMae?: string | null;
  rgExpedicao?: unknown;
  rgOrgaoExpedidor?: string | null;
  enderecoLogradouro?: string | null;
  enderecoNumero?: string | null;
  enderecoComplemento?: string | null;
  enderecoBairro?: string | null;
  enderecoCidade?: string | null;
  enderecoEstado?: string | null;
  enderecoCep?: string | null;
  tituloEleitor?: string | null;
  zonaEleitoral?: string | null;
  secaoEleitoral?: string | null;
  pis?: string | null;
  ctpsDigital?: boolean | null;
  ctpsNumero?: string | null;
  ctpsSerie?: string | null;
  bancoCodigo?: string | null;
  bancoNome?: string | null;
  bancoAgencia?: string | null;
  bancoConta?: string | null;
  bancoTipoConta?: string | null;
  bancoChavePix?: string | null;
  bancoTipoChavePix?: string | null;
  temSeguroVida?: boolean | null;
  valorSeguroVida?: string | null;
};

// Mesmos rótulos da tela da ficha (ColaboradorDetalhe)
const ESTADOS_CIVIS: Record<string, string> = {
  solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)", uniao_estavel: "União Estável", outro: "Outro",
};
const SEXOS: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro" };
const TIPO_CHAVE_PIX: Record<string, string> = {
  cpf: "CPF", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

/** Texto cadastrado, sem alterar o conteúdo (só remove espaços nas pontas). */
function texto(v: unknown): string {
  if (v === null || v === undefined) return VALOR_VAZIO;
  const s = String(v).trim();
  return s === "" ? VALOR_VAZIO : s;
}

/** "AAAA-MM-DD" (string ou Date do banco) → "DD/MM/AAAA", sem conversão de fuso. */
export function dataBR(v: unknown): string {
  if (v === null || v === undefined || v === "") return VALOR_VAZIO;
  let iso: string;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return VALOR_VAZIO;
    iso = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  } else {
    iso = String(v).split("T")[0];
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : VALOR_VAZIO;
}

function isoDe(v: unknown): string | null {
  const br = dataBR(v);
  if (br === VALOR_VAZIO) return null;
  const [d, m, a] = br.split("/");
  return `${a}-${m}-${d}`;
}

/** Idade completa em anos numa data de referência (ambas AAAA-MM-DD). */
export function idadeEm(nascimentoIso: string, referenciaIso: string): number {
  const [na, nm, nd] = nascimentoIso.split("-").map(Number);
  const [ra, rm, rd] = referenciaIso.split("-").map(Number);
  let idade = ra - na;
  if (rm < nm || (rm === nm && rd < nd)) idade--;
  return idade;
}

function simNao(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return VALOR_VAZIO;
  return v ? "Sim" : "Não";
}

/**
 * Monta a ficha a partir dos dados do colaborador.
 * @param hojeIso data de emissão (AAAA-MM-DD, fuso de Brasília), usada no cálculo da idade.
 */
export function montarFichaColaborador(c: ColaboradorFichaInput, hojeIso: string): SecaoFicha[] {
  const nascIso = isoDe(c.dataNascimento);
  const idade = nascIso ? `${idadeEm(nascIso, hojeIso)} anos` : VALOR_VAZIO;

  const filhos =
    c.temFilhos === null || c.temFilhos === undefined ? VALOR_VAZIO
    : c.temFilhos ? `Sim — ${c.qtdFilhos ?? 0} filho(s)` : "Não";

  const ctpsTipo = c.ctpsDigital === null || c.ctpsDigital === undefined ? VALOR_VAZIO
    : c.ctpsDigital ? "Digital" : "Física";

  const banco = c.bancoCodigo && c.bancoNome ? `${c.bancoCodigo.trim()} – ${c.bancoNome.trim()}`
    : texto(c.bancoNome || c.bancoCodigo);

  const tipoConta = c.bancoTipoConta === "corrente" ? "Conta Corrente"
    : c.bancoTipoConta === "poupanca" ? "Conta Poupança"
    : texto(c.bancoTipoConta);

  const chavePix = c.bancoTipoChavePix === "nao_tem" ? "Não possui PIX"
    : c.bancoChavePix && c.bancoChavePix.trim()
      ? `${TIPO_CHAVE_PIX[c.bancoTipoChavePix ?? ""] ?? texto(c.bancoTipoChavePix)}: ${c.bancoChavePix.trim()}`
      : VALOR_VAZIO;

  const situacao = c.status === "inativo" ? "Inativo" : c.status === "ativo" ? "Ativo" : texto(c.status);

  const periodo = c.periodoAquisitivo && c.vencimento
    ? `${dataBR(c.periodoAquisitivo)} a ${dataBR(c.vencimento)}`
    : dataBR(c.periodoAquisitivo);

  const secoes: SecaoFicha[] = [
    {
      titulo: "Identificação do colaborador",
      campos: [
        { rotulo: "Nome completo", valor: texto(c.nome) },
        { rotulo: "Código / Matrícula", valor: texto(c.codigo) },
        { rotulo: "Situação", valor: situacao },
      ],
    },
    {
      titulo: "Dados pessoais",
      campos: [
        { rotulo: "Data de nascimento", valor: dataBR(c.dataNascimento) },
        { rotulo: "Idade", valor: idade },
        { rotulo: "Sexo", valor: c.sexo ? (SEXOS[c.sexo] ?? texto(c.sexo)) : VALOR_VAZIO },
        { rotulo: "Estado civil", valor: c.estadoCivil ? (ESTADOS_CIVIS[c.estadoCivil] ?? texto(c.estadoCivil)) : VALOR_VAZIO },
        { rotulo: "Filhos", valor: filhos },
        { rotulo: "Idade na admissão", valor: c.idadeAdmissao != null ? `${c.idadeAdmissao} anos` : VALOR_VAZIO },
        { rotulo: "Nacionalidade", valor: texto(c.nacionalidade) },
        { rotulo: "Naturalidade", valor: texto(c.naturalidade) },
        { rotulo: "Estado (UF) de naturalidade", valor: texto(c.estado) },
      ],
    },
    {
      titulo: "Filiação",
      campos: [
        { rotulo: "Nome do pai", valor: texto(c.nomePai) },
        { rotulo: "Nome da mãe", valor: texto(c.nomeMae) },
      ],
    },
    {
      titulo: "Documentos",
      campos: [
        { rotulo: "CPF", valor: texto(c.cpf) },
        { rotulo: "RG", valor: texto(c.rg) },
        { rotulo: "Data de expedição do RG", valor: dataBR(c.rgExpedicao) },
        { rotulo: "Órgão expedidor do RG", valor: texto(c.rgOrgaoExpedidor) },
        { rotulo: "PIS", valor: texto(c.pis) },
        { rotulo: "Carteira de trabalho — tipo", valor: ctpsTipo },
        {
          rotulo: c.ctpsDigital ? "Número da CTPS Digital (CPF)" : "Número da CTPS",
          valor: texto(c.ctpsNumero),
        },
        ...(c.ctpsDigital ? [] : [{ rotulo: "Série da CTPS", valor: texto(c.ctpsSerie) }]),
        { rotulo: "Título de eleitor", valor: texto(c.tituloEleitor) },
        { rotulo: "Zona eleitoral", valor: texto(c.zonaEleitoral) },
        { rotulo: "Seção eleitoral", valor: texto(c.secaoEleitoral) },
      ],
    },
    {
      titulo: "Informações de contato",
      campos: [
        { rotulo: "Telefone", valor: texto(c.telefone) },
        { rotulo: "Celular", valor: texto(c.celular) },
        { rotulo: "E-mail corporativo", valor: texto(c.emailCorporativo) },
        { rotulo: "Contato de emergência — nome", valor: texto(c.contatoEmergenciaNome) },
        { rotulo: "Contato de emergência — telefone", valor: texto(c.contatoEmergenciaTelefone) },
      ],
    },
    {
      titulo: "Endereço",
      campos: [
        { rotulo: "Logradouro", valor: texto(c.enderecoLogradouro) },
        { rotulo: "Número", valor: texto(c.enderecoNumero) },
        { rotulo: "Complemento", valor: texto(c.enderecoComplemento) },
        { rotulo: "Bairro", valor: texto(c.enderecoBairro) },
        { rotulo: "Cidade", valor: texto(c.enderecoCidade) },
        { rotulo: "Estado (UF)", valor: texto(c.enderecoEstado) },
        { rotulo: "CEP", valor: texto(c.enderecoCep) },
      ],
    },
    {
      titulo: "Dados profissionais",
      campos: [
        { rotulo: "Empresa", valor: texto(c.empresaNome) },
        { rotulo: "Departamento / Setor", valor: texto(c.setorNome) },
        { rotulo: "Cargo", valor: texto(c.cargo) },
      ],
    },
    {
      titulo: "Informações contratuais",
      campos: [
        { rotulo: "Data de admissão", valor: dataBR(c.admissao) },
        { rotulo: "Data de demissão", valor: dataBR(c.dataDemissao) },
        { rotulo: "Período aquisitivo atual", valor: periodo },
        { rotulo: "Vencimento das férias", valor: dataBR(c.vencimento) },
        { rotulo: "Data limite das férias", valor: dataBR(c.dataLimite) },
        { rotulo: "Dias de férias de direito", valor: c.diasDireito != null ? String(c.diasDireito) : VALOR_VAZIO },
        { rotulo: "Saldo de férias (dias)", valor: c.saldo != null ? String(c.saldo) : VALOR_VAZIO },
        { rotulo: "Seguro de vida", valor: simNao(c.temSeguroVida) },
        { rotulo: "Valor do seguro de vida", valor: texto(c.valorSeguroVida) },
      ],
    },
    {
      titulo: "Dados bancários",
      campos: [
        { rotulo: "Banco", valor: banco },
        { rotulo: "Tipo de conta", valor: tipoConta },
        { rotulo: "Agência", valor: texto(c.bancoAgencia) },
        { rotulo: "Conta", valor: texto(c.bancoConta) },
        { rotulo: "Chave PIX", valor: chavePix },
      ],
    },
    {
      titulo: "Observações",
      campos: [{ rotulo: "Observações", valor: texto(c.observacoes) }],
    },
  ];
  return secoes;
}

/** Nome de arquivo seguro: "Ficha_Maria_da_Silva". Sem acentos nem caracteres especiais. */
export function nomeArquivoFicha(nome: string): string {
  const base = nome
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `Ficha_${base || "colaborador"}`;
}
