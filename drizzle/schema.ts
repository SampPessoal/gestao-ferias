import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/pg-core";

// ─── Enum definitions (PostgreSQL enums defined outside tables) ──────────────
export const empresaEnum = pgEnum('empresa_enum', ['FREIRE','JOANES','SUDOESTE','SOLAR']);
export const tipoMovEnum = pgEnum('tipo_mov_enum', ['incluir','excluir']);
export const tipoBeneficiarioEnum = pgEnum('tipo_beneficiario_enum', ['T','D']);
export const venda10Enum = pgEnum('venda10_enum', ['SIM','NAO']);
export const venda10ExtEnum = pgEnum('venda10_ext_enum', ['SIM','NÃO','NAO']);
export const statusColabEnum = pgEnum('status_colab_enum', ['ativo','inativo']);
export const estadoCivilEnum = pgEnum('estado_civil_enum', ['solteiro','casado','divorciado','viuvo','uniao_estavel','outro']);
export const sexoEnum = pgEnum('sexo_enum', ['masculino','feminino','outro']);
export const tipoRecebimentoCajuEnum = pgEnum('tipo_recebimento_caju_enum', ['vt_saldo_livre','vr_saldo_livre','auxilio_veiculo']);
export const tipoAtestadoEnum = pgEnum('tipo_atestado_enum', ['medico','odontologico','acompanhante','outros']);
export const tipoAfastamentoEnum = pgEnum('tipo_afastamento_enum', ['integral','comparecimento']);
export const quinzenaEnum = pgEnum('quinzena_enum', ['Q1','Q2']);
export const tipoVrvtEnum = pgEnum('tipo_vrvt_enum', ['VR','VT']);
export const tipoFeriadoEnum = pgEnum('tipo_feriado_enum', ['nacional','estadual','municipal']);
export const statusBonusEnum = pgEnum('status_bonus_enum', ['pendente','pago','cancelado']);
export const categoriaPlanoEnum = pgEnum('categoria_plano_enum', ['titular','dependente']);
export const userRoleEnum = pgEnum('user_role_enum', ['user','admin']);
export const systemUserRoleEnum = pgEnum('system_user_role_enum', ['admin','usuario']);

// Usuários do sistema GestaoFerias (login próprio, independente do Manus OAuth)
export const systemUsers = pgTable("systemUsers", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: systemUserRoleEnum("role").default("usuario").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SystemUser = typeof systemUsers.$inferSelect;
export type InsertSystemUser = typeof systemUsers.$inferInsert;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Empresas (Freire, Sudoeste, Joanes, Solar)
export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull().unique(),
  valorSeguroVida: decimal("valorSeguroVida", { precision: 10, scale: 2 }), // Valor do desconto do seguro de vida por empresa
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Empresa = typeof empresas.$inferSelect;
export type InsertEmpresa = typeof empresas.$inferInsert;

// Setores (Fábrica PA, Fábrica FSA, SEFAZ 1, etc.)
export const setores = pgTable("setores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  empresaId: integer("empresaId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Setor = typeof setores.$inferSelect;
export type InsertSetor = typeof setores.$inferInsert;

// Colaboradores
export const colaboradores = pgTable("colaboradores", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 30 }),
  nome: varchar("nome", { length: 200 }).notNull(),
  empresaId: integer("empresaId"),
  setorId: integer("setorId"),
  // Status ativo/inativo
  status: statusColabEnum("status").default("ativo").notNull(),
  dataDemissao: date("dataDemissao"),
  // Datas de férias CLT
  admissao: date("admissao"),
  periodoAquisitivo: date("periodoAquisitivo"),
  vencimento: date("vencimento"),
  dataLimite: date("dataLimite"),
  diasDireito: integer("diasDireito").default(30),
  saldo: integer("saldo").default(30),
  // Planejamento
  venda10: venda10ExtEnum("venda10"),
  fracionada: varchar("fracionada", { length: 100 }),
  planejamento1: varchar("planejamento1", { length: 200 }),
  planejamento2: varchar("planejamento2", { length: 200 }),
  planejamento3: varchar("planejamento3", { length: 200 }),
  observacoes: text("observacoes"),
  // Ficha Técnica
  dataNascimento: date("dataNascimento"),
  nacionalidade: varchar("nacionalidade", { length: 100 }),
  estadoCivil: estadoCivilEnum("estadoCivil"),
  naturalidade: varchar("naturalidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  sexo: sexoEnum("sexo"),
  temFilhos: boolean("temFilhos").default(false),
  qtdFilhos: integer("qtdFilhos").default(0),
  idadeAdmissao: integer("idadeAdmissao"),
  rg: varchar("rg", { length: 30 }),
  cpf: varchar("cpf", { length: 20 }),
  telefone: varchar("telefone", { length: 30 }),
  celular: varchar("celular", { length: 30 }),
  emailCorporativo: varchar("emailCorporativo", { length: 200 }),
  cargo: varchar("cargo", { length: 150 }),
  contatoEmergenciaNome: varchar("contatoEmergenciaNome", { length: 200 }),
  contatoEmergenciaTelefone: varchar("contatoEmergenciaTelefone", { length: 30 }),
  // Filiação
  nomePai: varchar("nomePai", { length: 200 }),
  nomeMae: varchar("nomeMae", { length: 200 }),
  // RG - expedição
  rgExpedicao: date("rgExpedicao"),
  rgOrgaoExpedidor: varchar("rgOrgaoExpedidor", { length: 30 }),
  // Endereço
  enderecoLogradouro: varchar("enderecoLogradouro", { length: 300 }),
  enderecoNumero: varchar("enderecoNumero", { length: 20 }),
  enderecoComplemento: varchar("enderecoComplemento", { length: 100 }),
  enderecoBairro: varchar("enderecoBairro", { length: 100 }),
  enderecoCidade: varchar("enderecoCidade", { length: 100 }),
  enderecoEstado: varchar("enderecoEstado", { length: 2 }),
  enderecoCep: varchar("enderecoCep", { length: 10 }),
  // Título de Eleitor
  tituloEleitor: varchar("tituloEleitor", { length: 30 }),
  zonaEleitoral: varchar("zonaEleitoral", { length: 10 }),
  secaoEleitoral: varchar("secaoEleitoral", { length: 10 }),
  // PIS/PASEP
  pis: varchar("pis", { length: 20 }),
  // Carteira de Trabalho
  ctpsDigital: boolean("ctpsDigital").default(false),
  ctpsNumero: varchar("ctpsNumero", { length: 30 }),   // número físico ou CPF (digital)
  ctpsSerie: varchar("ctpsSerie", { length: 20 }),     // série (apenas CTPS física)
  // Seguro de Vida
  temSeguroVida: boolean("temSeguroVida").default(false),
  valorSeguroVida: varchar("valorSeguroVida", { length: 20 }),
  // Benefícios VR/VT
  valorVR: decimal("valorVR", { precision: 10, scale: 2 }),
  valorVT: decimal("valorVT", { precision: 10, scale: 2 }),
  auxilioVeiculo: decimal("auxilioVeiculo", { precision: 10, scale: 2 }),
  auxilioVeiculoFolha: decimal("auxilioVeiculoFolha", { precision: 10, scale: 2 }), // Auxílio Veículo pago direto na folha (não vai para VT/VR)
  auxilioCelularFolha: decimal("auxilioCelularFolha", { precision: 10, scale: 2 }), // Auxílio Celular pago direto na folha
  setorBeneficio: varchar("setorBeneficio", { length: 200 }),
  tipoRecebimentoCaju: varchar("tipoRecebimentoCaju", { length: 50 }), // vt_saldo_livre | vr_saldo_livre | auxilio_veiculo | null (normal)
  // Valor fixo por quinzena (quando preenchido, ignora cálculo por dias úteis na planilha VR/VT)
  valorFixoQuinzenal: decimal("valorFixoQuinzenal", { precision: 10, scale: 2 }),
  // Valores fixos independentes por quinzena (substitui valorFixoQuinzenal quando preenchidos)
  valorFixoQ1: decimal("valorFixoQ1", { precision: 10, scale: 2 }), // valor fixo VR apenas na 1ª quinzena
  valorFixoQ2: decimal("valorFixoQ2", { precision: 10, scale: 2 }), // valor fixo VR apenas na 2ª quinzena
  // VT fixo independente por quinzena (quando preenchido, substitui cálculo de VT por dias)
  vtFixoQ1: decimal("vtFixoQ1", { precision: 10, scale: 2 }), // VT fixo apenas na 1ª quinzena
  vtFixoQ2: decimal("vtFixoQ2", { precision: 10, scale: 2 }), // VT fixo apenas na 2ª quinzena
  // Controla se o colaborador aparece na Planilha VR/VT (independente do status ativo/inativo)
  ativoVRVT: boolean("ativoVRVT").default(true).notNull(),
  // Tipo de desconto VR: 'pct10' = 10% do total VR, 'fixo1' = R$1,00 fixo, 'zero' = sem desconto
  tipoDescontoVR: varchar("tipoDescontoVR", { length: 10 }).default("pct10").notNull(),
  // Escala de dias trabalhados: JSON array de dias da semana (0=Dom,1=Seg,2=Ter,3=Qua,4=Qui,5=Sex,6=Sab)
  // null = padrão (seg-sex, exceto feriados). Ex: [0,1,2,3,4,5,6] menos terça = [0,1,3,4,5,6]
  escalaDias: varchar("escalaDias", { length: 50 }),
  vtDiasExtrasQ2: integer("vtDiasExtrasQ2").default(0).notNull(), // dias extras de VT na 2ª quinzena (ex: Fábrica Smed AL = 1)
  // Indica que o colaborador não precisa de exame periódico (não aparece na listagem)
  examePeriodicoIsento: boolean("examePeriodicoIsento").default(false).notNull(),
  // Dados Bancários
  bancoCodigo: varchar("bancoCodigo", { length: 10 }),       // código do banco ex: "237"
  bancoNome: varchar("bancoNome", { length: 100 }),          // nome do banco ex: "Bradesco"
  bancoAgencia: varchar("bancoAgencia", { length: 20 }),     // agência com DV ex: "1234-5"
  bancoConta: varchar("bancoConta", { length: 30 }),         // conta com DV ex: "12345-6"
  bancoTipoConta: varchar("bancoTipoConta", { length: 20 }), // "corrente" | "poupanca"
  bancoChavePix: varchar("bancoChavePix", { length: 150 }), // chave PIX (CPF, e-mail, tel, aleatória)
  bancoTipoChavePix: varchar("bancoTipoChavePix", { length: 20 }), // "cpf" | "email" | "telefone" | "aleatoria"
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_colab_status").on(t.status),
  index("idx_colab_empresa_status").on(t.empresaId, t.status),
  index("idx_colab_setor_status").on(t.setorId, t.status),
  index("idx_colab_dataLimite").on(t.dataLimite),
  index("idx_colab_ativoVRVT").on(t.ativoVRVT),
]);
export type Colaborador = typeof colaboradores.$inferSelect;
export type InsertColaborador = typeof colaboradores.$inferInsert;

// Histórico de férias tiradas (Relação de Férias por mês)
export const historicoFerias = pgTable("historicoFerias", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  empresaId: integer("empresaId"),
  setorId: integer("setorId"),
  // Período de gozo
  dataSaida: date("dataSaida").notNull(),
  dataFim: date("dataFim"),  // Último dia de férias (calculado: dataSaida + diasGozados - 1)
  dataRetorno: date("dataRetorno").notNull(),
  diasGozados: integer("diasGozados").notNull(),
  // Venda de 10 dias
  venda10: venda10Enum("venda10").default("NAO").notNull(),
  diasVendidos: integer("diasVendidos").default(0),
  // Período aquisitivo referente
  periodoRef: varchar("periodoRef", { length: 50 }),
  observacao: text("observacao"),
  // Estado do colaborador ANTES deste lançamento (restaurado ao cancelar)
  periodoAquisitivoAnterior: date("periodoAquisitivoAnterior"),
  vencimentoAnterior: date("vencimentoAnterior"),
  dataLimiteAnterior: date("dataLimiteAnterior"),
  saldoAnterior: integer("saldoAnterior"),
  // Auditoria: quem registrou
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_hf_colaborador").on(t.colaboradorId),
  index("idx_hf_empresa").on(t.empresaId),
  index("idx_hf_dataSaida").on(t.dataSaida),
  index("idx_hf_dataRetorno").on(t.dataRetorno),
  index("idx_hf_empresa_dataSaida").on(t.empresaId, t.dataSaida), // query mais comum: empresa + ano
]);
export type HistoricoFerias = typeof historicoFerias.$inferSelect;
export type InsertHistoricoFerias = typeof historicoFerias.$inferInsert;

// Abonos sociais (2 dias por ano de empresa, não acumula)
export const abonos = pgTable("abonos", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  empresaId: integer("empresaId"),
  setorId: integer("setorId"),
  // Ano de referência (ex: 2025 = abono do período aquisitivo 2024-2025)
  anoReferencia: integer("anoReferencia").notNull(),
  // Datas do abono tirado (dataAbono2 usado quando os 2 dias são em datas não consecutivas)
  dataAbono: date("dataAbono").notNull(),
  dataAbono2: date("dataAbono2"),
  diasAbonados: integer("diasAbonados").notNull().default(1),
  // Observações
  observacao: text("observacao"),
  // Auditoria: quem registrou
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_abonos_colaborador").on(t.colaboradorId),
  index("idx_abonos_empresa").on(t.empresaId),
  index("idx_abonos_ano").on(t.anoReferencia),
  index("idx_abonos_empresa_ano").on(t.empresaId, t.anoReferencia), // query mais comum: empresa + ano
]);
export type Abono = typeof abonos.$inferSelect;
export type InsertAbono = typeof abonos.$inferInsert;

// Atestados médicos (Relação de Atestados por mês)
export const atestados = pgTable("atestados", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  empresaId: integer("empresaId"),
  setorId: integer("setorId"),
  // Período de afastamento
  dataInicio: date("dataInicio").notNull(),
  dataFim: date("dataFim").notNull(),
  diasAfastamento: integer("diasAfastamento").notNull(),
  // diasDescontar: quando preenchido, é o valor real a descontar na planilha VR/VT (pode ser menor que diasAfastamento por orientação médica ou observação do RH)
  // Se null, usa diasAfastamento como padrão
  diasDescontar: integer("diasDescontar"),
  // Tipo de afastamento: integral = dia(s) inteiro(s) ausente (desconta VR/VT); comparecimento = foi por algumas horas (não desconta)
  tipoAfastamento: tipoAfastamentoEnum("tipoAfastamento").default("integral").notNull(),
  // Tipo de atestado
  tipo: tipoAtestadoEnum("tipo").default("medico").notNull(),
  // Informações do atestado
  cid: varchar("cid", { length: 20 }),
  medico: varchar("medico", { length: 200 }),
  observacao: text("observacao"),
  // Auditoria: quem registrou
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_atestados_colaborador").on(t.colaboradorId),
  index("idx_atestados_empresa").on(t.empresaId),
  index("idx_atestados_dataInicio").on(t.dataInicio),
  index("idx_atestados_tipo_afastamento").on(t.tipoAfastamento),
  index("idx_atestados_empresa_dataInicio").on(t.empresaId, t.dataInicio), // query mais comum: empresa + data
]);
export type Atestado = typeof atestados.$inferSelect;
export type InsertAtestado = typeof atestados.$inferInsert;

// Eventos do Calendário
export const eventosCalendario = pgTable("eventosCalendario", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 300 }).notNull(),
  descricao: text("descricao"),
  // Data e hora do evento (UTC timestamp)
  dataHora: timestamp("dataHora").notNull(),
  // Dia inteiro (sem hora específica)
  diaInteiro: boolean("diaInteiro").default(false).notNull(),
  // Cor do evento para visualização no calendário
  cor: varchar("cor", { length: 30 }).default("blue"),
  // Lembretes: task_uids dos jobs agendados (separados por vírgula)
  lembretesTaskUids: text("lembretesTaskUids"),
  // Auditoria
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type EventoCalendario = typeof eventosCalendario.$inferSelect;
export type InsertEventoCalendario = typeof eventosCalendario.$inferInsert;

// Feriados (nacionais, estaduais Bahia, municipais Salvador)
export const feriados = pgTable("feriados", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  tipo: tipoFeriadoEnum("tipo").notNull(),
  recorrente: boolean("recorrente").default(true).notNull(), // true = repete todo ano na mesma data
  ativo: boolean("ativo").default(true).notNull(),
  municipio: varchar("municipio", { length: 100 }), // ex: "Paulo Afonso", "Feira de Santana" — só para tipo=municipal
  setoresAfetados: text("setoresAfetados"), // JSON array de setorId (number[]) — null = todos os setores
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Feriado = typeof feriados.$inferSelect;
export type InsertFeriado = typeof feriados.$inferInsert;

// Ausências VR/VT — dias de falta/afastamento por colaborador por mês
export const ausenciasVRVT = pgTable("ausenciasVRVT", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(), // 1-12
  diasAusencia: integer("diasAusencia").notNull().default(0),
  observacao: varchar("observacao", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("idx_ausencias_colab_ano_mes").on(t.colaboradorId, t.ano, t.mes)]);

export type AusenciaVRVT = typeof ausenciasVRVT.$inferSelect;
export type InsertAusenciaVRVT = typeof ausenciasVRVT.$inferInsert;

// Dias customizados por colaborador/quinzena/tipo (sobrescreve o cálculo automático)
export const diasCustomVRVT = pgTable("diasCustomVRVT", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(), // 1-12
  quinzena: quinzenaEnum("quinzena").notNull(),
  tipo: tipoVrvtEnum("tipo").notNull(),
  dias: integer("dias").notNull(), // valor customizado de dias
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("idx_diasCustom_colab_ano_mes").on(t.colaboradorId, t.ano, t.mes)]);
export type DiasCustomVRVT = typeof diasCustomVRVT.$inferSelect;
export type InsertDiasCustomVRVT = typeof diasCustomVRVT.$inferInsert;
// Controle de meses gerados na planilha VR/VT
export const planilhasGeradas = pgTable("planilhasGeradas", {
  id: serial("id").primaryKey(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(), // 1-12
  geradoPor: integer("geradoPor"), // userId
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("idx_planilhas_ano_mes").on(t.ano, t.mes)]);
export type PlanilhaGerada = typeof planilhasGeradas.$inferSelect;
export type InsertPlanilhaGerada = typeof planilhasGeradas.$inferInsert;

// Exames periódicos dos colaboradores
export const examesPeriodicos = pgTable("examesPeriodicos", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  ano: integer("ano").notNull(), // ano do exame (ex: 2026)
  realizou: boolean("realizou").default(false).notNull(), // Sim ou Não
  dataExame: date("dataExame"), // data do exame (quando realizou = true)
  observacoes: varchar("observacoes", { length: 500 }),
  enviadoContabilidade: boolean("enviadoContabilidade").default(false).notNull(),
  dataEnvioContabilidade: date("dataEnvioContabilidade"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [index("idx_exames_colab_ano").on(t.colaboradorId, t.ano)]);
export type ExamePeriodico = typeof examesPeriodicos.$inferSelect;
export type InsertExamePeriodico = typeof examesPeriodicos.$inferInsert;

// Plano de Saúde AMIL — beneficiários (titulares e dependentes)
export const planoSaude = pgTable("planoSaude", {
  id: serial("id").primaryKey(),
  empresa: empresaEnum("empresa").notNull(),
  numeroBeneficiario: varchar("numeroBeneficiario", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  matriculaFuncional: varchar("matriculaFuncional", { length: 20 }),
  cpf: varchar("cpf", { length: 11 }),
  plano: varchar("plano", { length: 100 }).notNull(),
  tipo: tipoBeneficiarioEnum("tipo").notNull(), // T=Titular, D=Dependente
  idade: integer("idade").default(0).notNull(),
  tipoDepend: varchar("tipoDepend", { length: 20 }).default("").notNull(),
  mensalidade: decimal("mensalidade", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalFamilia: decimal("totalFamilia", { precision: 10, scale: 2 }),
  // Referência ao colaborador (quando o nome for reconhecido no banco)
  colaboradorId: integer("colaboradorId"),
  // Data de nascimento (para calcular faixa etária automaticamente)
  dataNascimento: varchar("dataNascimento", { length: 10 }), // formato YYYY-MM-DD
  // Para dependentes: número do beneficiário do titular ao qual pertence
  titularNumeroBeneficiario: varchar("titularNumeroBeneficiario", { length: 20 }),
  // Mês/ano de referência da fatura
  mesReferencia: integer("mesReferencia").notNull().default(7), // 1-12
  anoReferencia: integer("anoReferencia").notNull().default(2026),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_planoSaude_empresa").on(t.empresa),
  index("idx_planoSaude_beneficiario").on(t.numeroBeneficiario),
  index("idx_planoSaude_colab").on(t.colaboradorId),
]);
export type PlanoSaude = typeof planoSaude.$inferSelect;
export type InsertPlanoSaude = typeof planoSaude.$inferInsert;

// Tabela de preços AMIL por empresa, plano e faixa etária
export const tabelaPrecos = pgTable("tabelaPrecos", {
  id: serial("id").primaryKey(),
  empresa: empresaEnum("empresa").notNull(),
  codigoPlano: varchar("codigoPlano", { length: 20 }).notNull(), // ex: "967067"
  nomePlano: varchar("nomePlano", { length: 100 }).notNull(), // ex: "PRATA QC COPART TP"
  faixaInicio: integer("faixaInicio").notNull(), // idade mínima da faixa (0, 19, 24, ...)
  faixaFim: integer("faixaFim").notNull(), // idade máxima da faixa (18, 23, 28, ... 999 para "59+")
  valorTitular: decimal("valorTitular", { precision: 10, scale: 2 }).notNull(),
  valorDependente: decimal("valorDependente", { precision: 10, scale: 2 }).notNull(),
  vigenciaAno: integer("vigenciaAno").notNull().default(2026),
  vigenciaMes: integer("vigenciaMes").notNull().default(4), // abril 2026
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_tabelaPrecos_empresa_plano").on(t.empresa, t.codigoPlano),
]);
export type TabelaPrecos = typeof tabelaPrecos.$inferSelect;
export type InsertTabelaPrecos = typeof tabelaPrecos.$inferInsert;

// Coparticipação mensal do Plano de Saúde por beneficiário
export const coparticipacaoPlanoSaude = pgTable("coparticipacaoPlanoSaude", {
  id: serial("id").primaryKey(),
  // Referência ao beneficiário (titular ou dependente)
  numeroBeneficiario: varchar("numeroBeneficiario", { length: 20 }).notNull(),
  empresa: empresaEnum("empresa").notNull(),
  // Nome do beneficiário (desnormalizado para facilitar exibição sem join)
  nomeBeneficiario: varchar("nomeBeneficiario", { length: 200 }).notNull(),
  // Tipo: T=Titular, D=Dependente
  tipoBeneficiario: tipoBeneficiarioEnum("tipoBeneficiario").notNull().default("T"),
  // Mês/ano de referência
  mes: integer("mes").notNull(), // 1-12
  ano: integer("ano").notNull(),
  // Valor da coparticipação
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // Observação (ex: procedimento, consulta, etc.)
  observacao: varchar("observacao", { length: 500 }),
  // Auditoria
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_copart_empresa_mes_ano").on(t.empresa, t.mes, t.ano),
  index("idx_copart_beneficiario").on(t.numeroBeneficiario),
]);
export type CoparticipacaoPlanoSaude = typeof coparticipacaoPlanoSaude.$inferSelect;
export type InsertCoparticipacaoPlanoSaude = typeof coparticipacaoPlanoSaude.$inferInsert;

// ─── Folha do Mês ─────────────────────────────────────────────────────────────
// Registro de descontos mensais por colaborador (VR + Plano de Saúde)
export const folhaMes = pgTable("folhaMes", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  empresa: empresaEnum("empresa").notNull(),
  mes: integer("mes").notNull(), // 1-12
  ano: integer("ano").notNull(),
  // Desconto VR (10% do total, R$1 fixo ou R$0 conforme tipoDescontoVR)
  descontoVR: decimal("descontoVR", { precision: 10, scale: 2 }).notNull().default("0.00"),
  tipoDescontoVR: varchar("tipoDescontoVR", { length: 10 }).notNull().default("pct10"),
  totalVRMes: decimal("totalVRMes", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // Desconto Plano de Saúde
  descontoPlanoSaude: decimal("descontoPlanoSaude", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // Detalhamento do plano de saúde
  planoTitular: varchar("planoTitular", { length: 100 }), // plano do titular
  mensalidadeTitular: decimal("mensalidadeTitular", { precision: 10, scale: 2 }), // valor bruto do titular
  valorBasePlano: decimal("valorBasePlano", { precision: 10, scale: 2 }), // 100% do Prata QC na faixa etária
  subsidioEmpresa: decimal("subsidioEmpresa", { precision: 10, scale: 2 }), // 70% do Prata QC
  totalDependentes: decimal("totalDependentes", { precision: 10, scale: 2 }), // soma mensalidades dependentes (100%)
  // Desconto Seguro de Vida
  descontoSeguroVida: decimal("descontoSeguroVida", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // Referência do mês do VR (mês anterior ao da folha)
  mesVRReferencia: integer("mesVRReferencia"),
  anoVRReferencia: integer("anoVRReferencia"),
  // Setor do colaborador (snapshot no momento da geração)
  setorNome: varchar("setorNome", { length: 200 }),
  // Total de descontos
  totalDescontos: decimal("totalDescontos", { precision: 10, scale: 2 }).notNull().default("0.00"),
  // A Receber na folha (benefícios pagos direto na folha)
  receberAuxNotebook: decimal("receberAuxNotebook", { precision: 10, scale: 2 }).default("0.00"),
  receberAuxCreche: decimal("receberAuxCreche", { precision: 10, scale: 2 }).default("0.00"),
  receberAuxVeiculoFolha: decimal("receberAuxVeiculoFolha", { precision: 10, scale: 2 }).default("0.00"),
  receberAuxCelularFolha: decimal("receberAuxCelularFolha", { precision: 10, scale: 2 }).default("0.00"),
  totalAReceber: decimal("totalAReceber", { precision: 10, scale: 2 }).default("0.00"),
  // Férias no mês (colaboradores que saíram de férias neste mês)
  diasFerias: integer("diasFerias").default(0),           // total de dias gozados no mês
  diasVendidosFerias: integer("diasVendidosFerias").default(0), // dias vendidos (abono pecuniário)
  // Observação manual
  observacao: varchar("observacao", { length: 500 }),
  // Auditoria
  geradoEm: timestamp("geradoEm").defaultNow().notNull(),
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_folhaMes_colab_mes_ano").on(t.colaboradorId, t.mes, t.ano),
  index("idx_folhaMes_empresa_mes_ano").on(t.empresa, t.mes, t.ano),
]);
export type FolhaMes = typeof folhaMes.$inferSelect;
export type InsertFolhaMes = typeof folhaMes.$inferInsert;

// Exceções: colaboradores que recebem subsídio de 70% no plano superior (não apenas no Prata QC)
export const folhaMesExcecoes = pgTable("folhaMesExcecoes", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  empresa: empresaEnum("empresa").notNull(),
  // Quando null = exceção permanente; quando preenchido = exceção só para aquele mês/ano
  mesInicio: integer("mesInicio"), // mês inicial da exceção (null = sempre)
  anoInicio: integer("anoInicio"),
  mesFim: integer("mesFim"), // mês final da exceção (null = sem fim)
  anoFim: integer("anoFim"),
  descricao: varchar("descricao", { length: 500 }), // motivo da exceção
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_folhaMesExc_colab").on(t.colaboradorId),
]);
export type FolhaMesExcecao = typeof folhaMesExcecoes.$inferSelect;
export type InsertFolhaMesExcecao = typeof folhaMesExcecoes.$inferInsert;

// ─── Movimentação do Mês ──────────────────────────────────────────────────────

// Movimentação: Seguro de Vida
export const movimentacaoSeguroVida = pgTable("movimentacaoSeguroVida", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  nomeColaborador: varchar("nomeColaborador", { length: 200 }),
  empresa: empresaEnum("empresa").notNull(),
  tipo: tipoMovEnum("tipo").notNull(),
  data: date("data").notNull(),
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movSV_colab").on(t.colaboradorId),
  index("idx_movSV_empresa").on(t.empresa),
]);
export type MovimentacaoSeguroVida = typeof movimentacaoSeguroVida.$inferSelect;
export type InsertMovimentacaoSeguroVida = typeof movimentacaoSeguroVida.$inferInsert;

// Movimentação: Auxílio Notebook
export const movimentacaoAuxilioNotebook = pgTable("movimentacaoAuxilioNotebook", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  nomeColaborador: varchar("nomeColaborador", { length: 200 }),
  empresa: empresaEnum("empresa").notNull(),
  tipo: tipoMovEnum("tipo").notNull(),
  dataInicio: date("dataInicio").notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).default("150.00"),
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movAN_colab").on(t.colaboradorId),
  index("idx_movAN_empresa").on(t.empresa),
]);
export type MovimentacaoAuxilioNotebook = typeof movimentacaoAuxilioNotebook.$inferSelect;
export type InsertMovimentacaoAuxilioNotebook = typeof movimentacaoAuxilioNotebook.$inferInsert;

// Movimentação: Plano de Saúde
  export const movimentacaoPlanoSaude = pgTable("movimentacaoPlanoSaude", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId"),
  nomeColaborador: varchar("nomeColaborador", { length: 200 }),
  empresa: empresaEnum("empresa").notNull(),
  tipo: tipoMovEnum("tipo").notNull(),
  tipoPlano: varchar("tipoPlano", { length: 100 }), // ex: Bronze, Prata, Ouro
  categoria: categoriaPlanoEnum("categoria").default("titular"),
  dataNascimento: date("dataNascimento"), // para cálculo de faixa etária
  valor: decimal("valor", { precision: 10, scale: 2 }),
  valorEmpresa: decimal("valorEmpresa", { precision: 10, scale: 2 }), // subsídio da empresa (70% do Prata QC)
  valorColaborador: decimal("valorColaborador", { precision: 10, scale: 2 }), // valor a pagar pelo colaborador
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movPS_colab").on(t.colaboradorId),
  index("idx_movPS_empresa").on(t.empresa),
]);
export type MovimentacaoPlanoSaude = typeof movimentacaoPlanoSaude.$inferSelect;
export type InsertMovimentacaoPlanoSaude = typeof movimentacaoPlanoSaude.$inferInsert;

// Movimentação: Vale Transporte
export const movimentacaoValeTransporte = pgTable("movimentacaoValeTransporte", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId"),
  nomeColaborador: varchar("nomeColaborador", { length: 200 }),
  empresa: empresaEnum("empresa").notNull(),
  tipo: tipoMovEnum("tipo").notNull(),
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movVT_colab").on(t.colaboradorId),
  index("idx_movVT_empresa").on(t.empresa),
]);
export type MovimentacaoValeTransporte = typeof movimentacaoValeTransporte.$inferSelect;
export type InsertMovimentacaoValeTransporte = typeof movimentacaoValeTransporte.$inferInsert;

// Movimentação: Auxílio Creche
export const movimentacaoAuxilioCreche = pgTable("movimentacaoAuxilioCreche", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  nomeColaborador: varchar("nomeColaborador", { length: 200 }),
  empresa: empresaEnum("empresa").notNull(),
  tipo: tipoMovEnum("tipo").notNull(),
  nomeFilho: varchar("nomeFilho", { length: 200 }).notNull(),
  dataNascimentoFilho: date("dataNascimentoFilho"),
  valor: decimal("valor", { precision: 10, scale: 2 }),
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movAC_colab").on(t.colaboradorId),
  index("idx_movAC_empresa").on(t.empresa),
]);
export type MovimentacaoAuxilioCreche = typeof movimentacaoAuxilioCreche.$inferSelect;
export type InsertMovimentacaoAuxilioCreche = typeof movimentacaoAuxilioCreche.$inferInsert;

// Movimentação: Bônus por Indicação
export const movimentacaoBonusIndicacao = pgTable("movimentacaoBonusIndicacao", {
  id: serial("id").primaryKey(),
  // Quem indicou
  indicadorId: integer("indicadorId").notNull(),
  nomeIndicador: varchar("nomeIndicador", { length: 200 }),
  // Quem foi indicado (novo colaborador)
  indicadoId: integer("indicadoId"),
  nomeIndicado: varchar("nomeIndicado", { length: 200 }).notNull(),
  empresa: empresaEnum("empresa").notNull(),
  dataAdmissaoIndicado: date("dataAdmissaoIndicado").notNull(), // data de entrada do indicado
  dataPagamentoPrevisto: date("dataPagamentoPrevisto"), // 3 meses após admissão
  dataPagamentoEfetivo: date("dataPagamentoEfetivo"), // quando foi pago de fato
  valorBonus: decimal("valorBonus", { precision: 10, scale: 2 }).default("1000.00"),
  status: statusBonusEnum("status").default("pendente").notNull(),
  observacao: varchar("observacao", { length: 500 }),
  competenciaMes: integer("competenciaMes"), // mês de competência (1-12)
  competenciaAno: integer("competenciaAno"), // ano de competência
  createdByUserId: integer("createdByUserId"),
  createdByNome: varchar("createdByNome", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_movBI_indicador").on(t.indicadorId),
  index("idx_movBI_empresa").on(t.empresa),
  index("idx_movBI_status").on(t.status),
]);
export type MovimentacaoBonusIndicacao = typeof movimentacaoBonusIndicacao.$inferSelect;
export type InsertMovimentacaoBonusIndicacao = typeof movimentacaoBonusIndicacao.$inferInsert;

// Histórico de cancelamentos de férias
export const cancelamentoFerias = pgTable("cancelamentoFerias", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaboradorId").notNull(),
  colaboradorNome: varchar("colaboradorNome", { length: 200 }).notNull(),
  // Dados das férias canceladas
  dataSaida: date("dataSaida").notNull(),
  dataRetorno: date("dataRetorno"),
  diasGozados: integer("diasGozados").default(0),
  diasVendidos: integer("diasVendidos").default(0),
  periodoRef: varchar("periodoRef", { length: 100 }),
  planejamento1: varchar("planejamento1", { length: 200 }),
  planejamento2: varchar("planejamento2", { length: 200 }),
  planejamento3: varchar("planejamento3", { length: 200 }),
  // Motivo do cancelamento
  motivo: varchar("motivo", { length: 500 }),
  // Quem cancelou e quando
  canceladoPorUserId: integer("canceladoPorUserId"),
  canceladoPorNome: varchar("canceladoPorNome", { length: 200 }),
  canceladoEm: timestamp("canceladoEm").defaultNow().notNull(),
}, (t) => [
  index("idx_cancelFerias_colab").on(t.colaboradorId),
  index("idx_cancelFerias_data").on(t.canceladoEm),
]);
export type CancelamentoFerias = typeof cancelamentoFerias.$inferSelect;
export type InsertCancelamentoFerias = typeof cancelamentoFerias.$inferInsert;
