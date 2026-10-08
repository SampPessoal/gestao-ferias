import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, or, sql, sum, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, SystemUser, colaboradores, empresas, setores, users, historicoFerias, InsertHistoricoFerias, abonos, InsertAbono, atestados, InsertAtestado, systemUsers, eventosCalendario, InsertEventoCalendario, EventoCalendario, feriados, Feriado, InsertFeriado, ausenciasVRVT, AusenciaVRVT, InsertAusenciaVRVT, diasCustomVRVT, planilhasGeradas, examesPeriodicos, planoSaude, tabelaPrecos, coparticipacaoPlanoSaude, folhaMes, folhaMesExcecoes, movimentacaoSeguroVida, movimentacaoAuxilioNotebook, movimentacaoPlanoSaude, movimentacaoValeTransporte, movimentacaoAuxilioCreche, movimentacaoBonusIndicacao, cancelamentoFerias } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

// ─── Helpers de Data ─────────────────────────────────────────────────────────
// Retorna a data de hoje no fuso de Brasília (UTC-3) como string "YYYY-MM-DD"
// IMPORTANTE: usar sempre esta função para comparar datas, pois o Drizzle retorna
// campos date do PostgreSQL como Date objects com hora UTC midnight, e toISOString()
// em UTC-3 pode retornar o dia errado após as 21h.
function hojeUTC3(): string {
  const agora = new Date();
  // Ajusta para UTC-3 (Brasília)
  const offsetBrasilia = -3 * 60;
  const localMs = agora.getTime() + (agora.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
  const hojeLocal = new Date(localMs);
  const y = hojeLocal.getUTCFullYear();
  const m = String(hojeLocal.getUTCMonth() + 1).padStart(2, "0");
  const d = String(hojeLocal.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Adiciona N dias a uma string "YYYY-MM-DD" e retorna nova string
function addDiasStr(dateStr: string, dias: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Normaliza Date | string | null retornado pelo Drizzle para "YYYY-MM-DD"
function toDateStrSafe(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    // Drizzle retorna date fields como Date com hora UTC midnight
    // Usar getUTC* para evitar conversão de timezone
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // String: pegar apenas a parte da data (antes do T)
  const s = String(val).split("T")[0];
  return s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : null;
}

// Helper: converte valor de coluna date do PostgreSQL (sempre string "YYYY-MM-DD")
// em Date ao meio-dia UTC para evitar erros de timezone.
function parseDateCol(val: string | Date | null | undefined): Date {
  if (!val) return new Date(0);
  if (typeof val === 'object' && val instanceof Date) return val;
  const s = String(val).split('T')[0];
  return new Date(s + 'T12:00:00Z');
}

// Timeout padrão para queries ao banco (8 segundos)
const DB_QUERY_TIMEOUT_MS = 8000;

// Executa uma query com timeout para evitar travamento quando o banco está inacessível
export async function withTimeout<T>(promise: Promise<T>, ms = DB_QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Database query timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
}

/**
 * Cria, se ainda não existirem, as colunas adicionadas em versões novas.
 * É idempotente (ADD COLUMN IF NOT EXISTS), então roda com segurança a cada início.
 */
async function garantirColunasNovas(client: ReturnType<typeof postgres>) {
  try {
    await client.unsafe(`
      ALTER TABLE "historicoFerias" ADD COLUMN IF NOT EXISTS "periodoAquisitivoAnterior" date;
      ALTER TABLE "historicoFerias" ADD COLUMN IF NOT EXISTS "vencimentoAnterior" date;
      ALTER TABLE "historicoFerias" ADD COLUMN IF NOT EXISTS "dataLimiteAnterior" date;
      ALTER TABLE "historicoFerias" ADD COLUMN IF NOT EXISTS "saldoAnterior" integer;
    `);
  } catch (error) {
    console.error("[Database] Falha ao garantir colunas novas:", (error as Error).message);
  }
}

let _initPromise: Promise<ReturnType<typeof drizzle> | null> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) {
        console.error("[Database] DATABASE_URL not set");
        return null;
      }
      try {
        const client = postgres(url, { max: 10, idle_timeout: 60, connect_timeout: 8 });
        await garantirColunasNovas(client);
        _client = client;
        _db = drizzle(client);
        console.log("[Database] Connected to PostgreSQL");
        return _db;
      } catch (error) {
        console.error("[Database] Connection failed:", (error as Error).message);
        return null;
      } finally {
        _initPromise = null;
      }
    })();
  }
  return _initPromise;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach((field) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Empresas ─────────────────────────────────────────────────────────────────

export async function getEmpresas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(empresas).orderBy(asc(empresas.nome));
}

export async function createEmpresa(nome: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(empresas).values({ nome });
  const result = await db.select().from(empresas).where(eq(empresas.nome, nome)).limit(1);
  return result[0];
}

export async function updateEmpresa(id: number, nome: string, valorSeguroVida?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: any = { nome };
  if (valorSeguroVida !== undefined) updateData.valorSeguroVida = valorSeguroVida;
  await db.update(empresas).set(updateData).where(eq(empresas.id, id));
}

export async function updateEmpresaValorSeguro(id: number, valorSeguroVida: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(empresas).set({ valorSeguroVida } as any).where(eq(empresas.id, id));
}

// ─── Setores ──────────────────────────────────────────────────────────────────

export async function getSetores(empresaId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (empresaId) {
    return db.select().from(setores).where(eq(setores.empresaId, empresaId)).orderBy(asc(setores.nome));
  }
  return db.select().from(setores).orderBy(asc(setores.nome));
}

export async function createSetor(nome: string, empresaId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(setores).values({ nome, empresaId: empresaId ?? null });
  const result = await db.select().from(setores).where(eq(setores.nome, nome)).limit(1);
  return result[0];
}

export async function updateSetor(id: number, nome: string, empresaId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(setores).set({ nome, empresaId: empresaId ?? null }).where(eq(setores.id, id));
}

// ─── Colaboradores ────────────────────────────────────────────────────────────

export async function createColaborador(data: {
  nome: string;
  codigo?: string | null;
  empresaId?: number | null;
  setorId?: number | null;
  admissao?: string | null;
  periodoAquisitivo?: string | null;
  vencimento?: string | null;
  dataLimite?: string | null;
  diasDireito?: number;
  saldo?: number;
  observacoes?: string | null;
  createdByUserId?: number | null;
  createdByNome?: string | null;
  valorVR?: number | null;
  valorVT?: number | null;
  // ficha técnica
  cpf?: string | null;
  rg?: string | null;
  dataNascimento?: string | null;
  cargo?: string | null;
  celular?: string | null;
  telefone?: string | null;
  sexo?: "masculino" | "feminino" | "outro" | null;
  estadoCivil?: "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel" | "outro" | null;
  emailCorporativo?: string | null;
  nacionalidade?: string | null;
  naturalidade?: string | null;
  temFilhos?: boolean | null;
  qtdFilhos?: number | null;
  idadeAdmissao?: number | null;
  nomePai?: string | null;
  nomeMae?: string | null;
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
  rgExpedicao?: string | null;
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
  ctpsTipo?: string | null;
  ctpsNumero?: string | null;
  ctpsSerie?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(colaboradores).values({
    nome: data.nome,
    codigo: data.codigo ?? null,
    empresaId: data.empresaId ?? null,
    setorId: data.setorId ?? null,
    // Passa string YYYY-MM-DD diretamente para colunas date() do Drizzle/PostgreSQL
    admissao: data.admissao ?? null,
    periodoAquisitivo: data.periodoAquisitivo ?? null,
    vencimento: data.vencimento ?? null,
    dataLimite: data.dataLimite ?? null,
    diasDireito: data.diasDireito ?? 30,
    saldo: data.saldo ?? 30,
    observacoes: data.observacoes ?? null,
    status: "ativo",
    createdByUserId: data.createdByUserId ?? null,
    createdByNome: data.createdByNome ?? null,
    valorVR: data.valorVR != null ? String(data.valorVR) : null,
    valorVT: data.valorVT != null ? String(data.valorVT) : null,
    cpf: data.cpf ?? null,
    rg: data.rg ?? null,
    dataNascimento: data.dataNascimento ?? null,
    cargo: data.cargo ?? null,
    celular: data.celular ?? null,
    telefone: data.telefone ?? null,
    sexo: data.sexo ?? null,
    estadoCivil: data.estadoCivil ?? null,
    emailCorporativo: data.emailCorporativo ?? null,
    nacionalidade: data.nacionalidade ?? null,
    naturalidade: data.naturalidade ?? null,
    temFilhos: data.temFilhos ?? false,
    qtdFilhos: data.qtdFilhos ?? null,
    idadeAdmissao: data.idadeAdmissao ?? null,
    nomePai: data.nomePai ?? null,
    nomeMae: data.nomeMae ?? null,
    contatoEmergenciaNome: data.contatoEmergenciaNome ?? null,
    contatoEmergenciaTelefone: data.contatoEmergenciaTelefone ?? null,
    rgExpedicao: data.rgExpedicao ?? null,
    rgOrgaoExpedidor: data.rgOrgaoExpedidor ?? null,
    enderecoLogradouro: data.enderecoLogradouro ?? null,
    enderecoNumero: data.enderecoNumero ?? null,
    enderecoComplemento: data.enderecoComplemento ?? null,
    enderecoBairro: data.enderecoBairro ?? null,
    enderecoCidade: data.enderecoCidade ?? null,
    enderecoEstado: data.enderecoEstado ?? null,
    enderecoCep: data.enderecoCep ?? null,
    tituloEleitor: data.tituloEleitor ?? null,
    zonaEleitoral: data.zonaEleitoral ?? null,
    secaoEleitoral: data.secaoEleitoral ?? null,
    pis: data.pis ?? null,
    ctpsDigital: data.ctpsTipo === "digital",
    ctpsNumero: data.ctpsNumero ?? null,
    ctpsSerie: data.ctpsSerie ?? null,
  } as any).returning({ id: colaboradores.id });
  const insertId = result[0]?.id;
  if (insertId) {
    const novo = await db.select().from(colaboradores).where(eq(colaboradores.id, insertId)).limit(1);
    return novo[0];
  }
  return null;
}

export type ColaboradorFiltros = {
  busca?: string;
  empresaId?: number;
  setorId?: number;
  status?: "ativo" | "inativo" | "todos";
  statusFerias?: "vencida" | "vence30" | "vence60" | "vence90" | "em_dia" | "todos";
  page?: number;
  pageSize?: number;
};

function buildStatusFeriasCondition(statusFerias: string) {
  const hojeStr = hojeUTC3();
  const d30Str  = addDiasStr(hojeStr, 30);
  const d60Str  = addDiasStr(hojeStr, 60);
  const d90Str  = addDiasStr(hojeStr, 90);

  switch (statusFerias) {
    case "vencida":
      return and(isNotNull(colaboradores.dataLimite), sql`${colaboradores.dataLimite} <= ${hojeStr}`);
    case "vence30":
      return and(isNotNull(colaboradores.dataLimite), sql`${colaboradores.dataLimite} > ${hojeStr}`, sql`${colaboradores.dataLimite} <= ${d30Str}`);
    case "vence60":
      return and(isNotNull(colaboradores.dataLimite), sql`${colaboradores.dataLimite} > ${hojeStr}`, sql`${colaboradores.dataLimite} <= ${d60Str}`);
    case "vence90":
      return and(isNotNull(colaboradores.dataLimite), sql`${colaboradores.dataLimite} > ${hojeStr}`, sql`${colaboradores.dataLimite} <= ${d90Str}`);
    case "em_dia":
      return or(isNull(colaboradores.dataLimite), sql`${colaboradores.dataLimite} > ${d90Str}`);
    default:
      return undefined;
  }
}

export async function getColaboradores(filtros: ColaboradorFiltros = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const { busca, empresaId, setorId, status = "ativo", statusFerias = "todos", page = 1, pageSize = 50 } = filtros;

  const conditions: ReturnType<typeof eq>[] = [];

  if (status !== "todos") {
    conditions.push(eq(colaboradores.status, status) as any);
  }
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId) as any);
  if (setorId) conditions.push(eq(colaboradores.setorId, setorId) as any);
  if (busca) {
    const termo = busca.trim();
    const nomeCond = sql`LOWER(${colaboradores.nome}) LIKE ${`%${termo.toLowerCase()}%`}`;
    // Busca por CPF: compara só os dígitos, aceitando "123.456.789-00" ou "12345678900"
    const digitos = termo.replace(/\D/g, "");
    const pareceCpf = digitos.length >= 3 && /^[\d.\-\s]+$/.test(termo);
    if (pareceCpf) {
      const cpfCond = sql`REGEXP_REPLACE(COALESCE(${colaboradores.cpf}, ''), '[^0-9]', '', 'g') LIKE ${`%${digitos}%`}`;
      conditions.push(or(nomeCond, cpfCond) as any);
    } else {
      conditions.push(nomeCond as any);
    }
  }

  const statusCond = buildStatusFeriasCondition(statusFerias);
  if (statusCond) conditions.push(statusCond as any);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, data] = await Promise.all([
    db.select({ count: count() }).from(colaboradores).where(whereClause),
    db
      .select({
        id: colaboradores.id,
        codigo: colaboradores.codigo,
        nome: colaboradores.nome,
        status: colaboradores.status,
        admissao: colaboradores.admissao,
        periodoAquisitivo: colaboradores.periodoAquisitivo,
        vencimento: colaboradores.vencimento,
        dataLimite: colaboradores.dataLimite,
        diasDireito: colaboradores.diasDireito,
        saldo: colaboradores.saldo,
        empresaId: colaboradores.empresaId,
        setorId: colaboradores.setorId,
        empresaNome: empresas.nome,
        setorNome: setores.nome,
        createdByNome: colaboradores.createdByNome,
        valorSeguroVidaEmpresa: empresas.valorSeguroVida,
      })
      .from(colaboradores)
      .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
      .leftJoin(setores, eq(colaboradores.setorId, setores.id))
      .where(whereClause)
      .orderBy(
        sql`CASE WHEN ${colaboradores.dataLimite} IS NULL THEN 1 ELSE 0 END`,
        asc(colaboradores.dataLimite)
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getColaboradorById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({
      id: colaboradores.id,
      codigo: colaboradores.codigo,
      nome: colaboradores.nome,
      status: colaboradores.status,
      dataDemissao: colaboradores.dataDemissao,
      admissao: colaboradores.admissao,
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
      diasDireito: colaboradores.diasDireito,
      saldo: colaboradores.saldo,
      venda10: colaboradores.venda10,
      fracionada: colaboradores.fracionada,
      planejamento1: colaboradores.planejamento1,
      planejamento2: colaboradores.planejamento2,
      planejamento3: colaboradores.planejamento3,
      observacoes: colaboradores.observacoes,
      empresaId: colaboradores.empresaId,
      setorId: colaboradores.setorId,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      updatedAt: colaboradores.updatedAt,
      // Ficha Técnica
      dataNascimento: colaboradores.dataNascimento,
      nacionalidade: colaboradores.nacionalidade,
      estadoCivil: colaboradores.estadoCivil,
      naturalidade: colaboradores.naturalidade,
      estado: colaboradores.estado,
      sexo: colaboradores.sexo,
      temFilhos: colaboradores.temFilhos,
      qtdFilhos: colaboradores.qtdFilhos,
      idadeAdmissao: colaboradores.idadeAdmissao,
      rg: colaboradores.rg,
      cpf: colaboradores.cpf,
      telefone: colaboradores.telefone,
      celular: colaboradores.celular,
      emailCorporativo: colaboradores.emailCorporativo,
      cargo: colaboradores.cargo,
            contatoEmergenciaNome: colaboradores.contatoEmergenciaNome,
      contatoEmergenciaTelefone: colaboradores.contatoEmergenciaTelefone,
      // Filiação
      nomePai: colaboradores.nomePai,
      nomeMae: colaboradores.nomeMae,
      // RG - expedição
      rgExpedicao: colaboradores.rgExpedicao,
      rgOrgaoExpedidor: colaboradores.rgOrgaoExpedidor,
      // Endereço
      enderecoLogradouro: colaboradores.enderecoLogradouro,
      enderecoNumero: colaboradores.enderecoNumero,
      enderecoComplemento: colaboradores.enderecoComplemento,
      enderecoBairro: colaboradores.enderecoBairro,
      enderecoCidade: colaboradores.enderecoCidade,
      enderecoEstado: colaboradores.enderecoEstado,
      enderecoCep: colaboradores.enderecoCep,
      // Título de Eleitor
      tituloEleitor: colaboradores.tituloEleitor,
      zonaEleitoral: colaboradores.zonaEleitoral,
      secaoEleitoral: colaboradores.secaoEleitoral,
      // PIS/PASEP
      pis: colaboradores.pis,
      // Carteira de Trabalho
      ctpsDigital: colaboradores.ctpsDigital,
      ctpsNumero: colaboradores.ctpsNumero,
      ctpsSerie: colaboradores.ctpsSerie,
      // Dados Bancários
      bancoCodigo: colaboradores.bancoCodigo,
      bancoNome: colaboradores.bancoNome,
      bancoAgencia: colaboradores.bancoAgencia,
      bancoConta: colaboradores.bancoConta,
      bancoTipoConta: colaboradores.bancoTipoConta,
      bancoChavePix: colaboradores.bancoChavePix,
      bancoTipoChavePix: colaboradores.bancoTipoChavePix,
      // Seguro de Vida
      temSeguroVida: colaboradores.temSeguroVida,
      valorSeguroVida: colaboradores.valorSeguroVida,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(eq(colaboradores.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function updateColaborador(
  id: number,
  data: {
    nome?: string;
    codigo?: string;
    empresaId?: number | null;
    setorId?: number | null;
    admissao?: string | null;
    periodoAquisitivo?: string | null;
    vencimento?: string | null;
    dataLimite?: string | null;
    diasDireito?: number;
    saldo?: number;
    venda10?: "SIM" | "NAO" | null;
    fracionada?: string | null;
    planejamento1?: string | null;
    planejamento2?: string | null;
    planejamento3?: string | null;
    observacoes?: string | null;
    status?: "ativo" | "inativo";
    dataDemissao?: string | null;
    // Ficha Técnica
    dataNascimento?: string | null;
    nacionalidade?: string | null;
    estadoCivil?: "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel" | "outro" | null;
    naturalidade?: string | null;
    estado?: string | null;
    sexo?: "masculino" | "feminino" | "outro" | null;
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
    // Filiação
    nomePai?: string | null;
    nomeMae?: string | null;
    // RG - expedição
    rgExpedicao?: string | null;
    rgOrgaoExpedidor?: string | null;
    // Endereço
    enderecoLogradouro?: string | null;
    enderecoNumero?: string | null;
    enderecoComplemento?: string | null;
    enderecoBairro?: string | null;
    enderecoCidade?: string | null;
    enderecoEstado?: string | null;
    enderecoCep?: string | null;
    // Título de Eleitor
    tituloEleitor?: string | null;
    zonaEleitoral?: string | null;
    secaoEleitoral?: string | null;
    pis?: string | null;
    // Carteira de Trabalho
    ctpsDigital?: boolean | null;
    ctpsNumero?: string | null;
    ctpsSerie?: string | null;
    // Dados Bancários
    bancoCodigo?: string | null;
    bancoNome?: string | null;
    bancoAgencia?: string | null;
    bancoConta?: string | null;
    bancoTipoConta?: string | null;
    bancoChavePix?: string | null;
    bancoTipoChavePix?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Passa strings YYYY-MM-DD diretamente para colunas date() do PostgreSQL
  const updateData: Record<string, any> = { ...data };
  // Campos de data já vêm como string YYYY-MM-DD e são passados diretamente
  // planejamento1/2/3 são campos varchar (texto livre), não datas — não converter
  await db.update(colaboradores).set(updateData as any).where(eq(colaboradores.id, id));
}

export async function toggleStatusColaborador(id: number, novoStatus: "ativo" | "inativo", dataDemissao?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Passa string YYYY-MM-DD diretamente para coluna date()
  const demissaoDate = novoStatus === "inativo" && dataDemissao
    ? dataDemissao
    : null;
  await db.update(colaboradores)
    .set({ status: novoStatus, dataDemissao: demissaoDate } as any)
    .where(eq(colaboradores.id, id));
  // Ao desligar, remover da folhaMes do mês atual em diante para não distorcer planilha VR/VT
  if (novoStatus === "inativo") {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    await db.delete(folhaMes).where(
      and(
        eq(folhaMes.colaboradorId, id),
        sql`(${folhaMes.ano} > ${anoAtual} OR (${folhaMes.ano} = ${anoAtual} AND ${folhaMes.mes} >= ${mesAtual}))`
      )
    );
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  // Otimizado: 1 query com CASE WHEN em vez de 7 queries separadas
  const hojeStr = hojeUTC3();
  const d30Str  = addDiasStr(hojeStr, 30);
  const d60Str  = addDiasStr(hojeStr, 60);
  const d90Str  = addDiasStr(hojeStr, 90);

  const [result] = await db.select({
    total:    sql<number>`COUNT(*)`,
    ativos:   sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'ativo' THEN 1 ELSE 0 END)`,
    inativos: sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'inativo' THEN 1 ELSE 0 END)`,
    vencidas: sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'ativo' AND ${colaboradores.dataLimite} IS NOT NULL AND ${colaboradores.dataLimite} <= ${hojeStr} THEN 1 ELSE 0 END)`,
    vence30:  sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'ativo' AND ${colaboradores.dataLimite} IS NOT NULL AND ${colaboradores.dataLimite} > ${hojeStr} AND ${colaboradores.dataLimite} <= ${d30Str} THEN 1 ELSE 0 END)`,
    vence60:  sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'ativo' AND ${colaboradores.dataLimite} IS NOT NULL AND ${colaboradores.dataLimite} > ${hojeStr} AND ${colaboradores.dataLimite} <= ${d60Str} THEN 1 ELSE 0 END)`,
    vence90:  sql<number>`SUM(CASE WHEN ${colaboradores.status} = 'ativo' AND ${colaboradores.dataLimite} IS NOT NULL AND ${colaboradores.dataLimite} > ${hojeStr} AND ${colaboradores.dataLimite} <= ${d90Str} THEN 1 ELSE 0 END)`,
  }).from(colaboradores);

  return {
    total:    Number(result?.total    ?? 0),
    ativos:   Number(result?.ativos   ?? 0),
    inativos: Number(result?.inativos ?? 0),
    vencidas: Number(result?.vencidas ?? 0),
    vence30:  Number(result?.vence30  ?? 0),
    vence60:  Number(result?.vence60  ?? 0),
    vence90:  Number(result?.vence90  ?? 0),
  };
}

export async function getAlertasUrgentes(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const hojeStr = hojeUTC3();
  const d30Str  = addDiasStr(hojeStr, 30);
  return db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      dataLimite: colaboradores.dataLimite,
      vencimento: colaboradores.vencimento,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(
      and(
        eq(colaboradores.status, "ativo"),
        isNotNull(colaboradores.dataLimite),
        sql`${colaboradores.dataLimite} <= ${d30Str}`
      )
    )
    .orderBy(asc(colaboradores.dataLimite))
    .limit(limit);
}

export async function getStatusPorEmpresa() {
  const db = await getDb();
  if (!db) return [];

  const hojeStr = hojeUTC3();
  const d30Str  = addDiasStr(hojeStr, 30);
  const d60Str  = addDiasStr(hojeStr, 60);
  const d90Str  = addDiasStr(hojeStr, 90);

  const allColabs = await db
    .select({
      empresaId: colaboradores.empresaId,
      empresaNome: empresas.nome,
      dataLimite: colaboradores.dataLimite,
      saldo: colaboradores.saldo,
      status: colaboradores.status,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .where(eq(colaboradores.status, "ativo"));

  const empresaMap = new Map<number, {
    empresaId: number;
    empresaNome: string;
    total: number;
    vencidas: number;
    vence30: number;
    vence60: number;
    vence90: number;
    saldoTotal: number;
  }>();

  for (const c of allColabs) {
    if (!c.empresaId) continue;
    if (!empresaMap.has(c.empresaId)) {
      empresaMap.set(c.empresaId, {
        empresaId: c.empresaId,
        empresaNome: c.empresaNome ?? "",
        total: 0,
        vencidas: 0,
        vence30: 0,
        vence60: 0,
        vence90: 0,
        saldoTotal: 0,
      });
    }
    const entry = empresaMap.get(c.empresaId)!;
    entry.total++;
    entry.saldoTotal += c.saldo ?? 0;
    const dl = toDateStrSafe(c.dataLimite);
    if (dl) {
      if (dl <= d90Str) entry.vence90++;
      if (dl <= d60Str) entry.vence60++;
      if (dl <= d30Str) entry.vence30++;
      if (dl <= hojeStr) entry.vencidas++;
    }
  }

  return Array.from(empresaMap.values()).map((e) => ({
    ...e,
    saldoMedio: e.total > 0 ? Math.round(e.saldoTotal / e.total) : 0,
  })).sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));
}

export async function getStatusPorSetor(empresaId?: number) {
  const db = await getDb();
  if (!db) return [];

  const hojeStr = hojeUTC3();
  const d30Str  = addDiasStr(hojeStr, 30);
  const d60Str  = addDiasStr(hojeStr, 60);
  const d90Str  = addDiasStr(hojeStr, 90);

  const conditions: any[] = [eq(colaboradores.status, "ativo")];
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId));

  const allColabs = await db
    .select({
      setorId: colaboradores.setorId,
      setorNome: setores.nome,
      empresaId: colaboradores.empresaId,
      empresaNome: empresas.nome,
      dataLimite: colaboradores.dataLimite,
      saldo: colaboradores.saldo,
    })
    .from(colaboradores)
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .where(and(...conditions));

  const setorMap = new Map<number, {
    setorId: number;
    setorNome: string;
    empresaId: number | null;
    empresaNome: string;
    total: number;
    vencidas: number;  // passou da data limite (urgente)
    vence30: number;   // ≤30 dias (crítico) — cumulativo: inclui vencidas
    vence60: number;   // ≤60 dias (alerta) — cumulativo: inclui vence30
    vence90: number;   // ≤90 dias (atenção) — cumulativo: inclui vence60
    saldoTotal: number;
  }>();

  for (const c of allColabs) {
    const key = c.setorId ?? -1;
    if (!setorMap.has(key)) {
      setorMap.set(key, {
        setorId: c.setorId ?? -1,
        setorNome: c.setorNome ?? "Sem Setor",
        empresaId: c.empresaId,
        empresaNome: c.empresaNome ?? "",
        total: 0,
        vencidas: 0,
        vence30: 0,
        vence60: 0,
        vence90: 0,
        saldoTotal: 0,
      });
    }
    const entry = setorMap.get(key)!;
    entry.total++;
    entry.saldoTotal += c.saldo ?? 0;
    const dl = toDateStrSafe(c.dataLimite);
    if (dl) {
      if (dl <= d90Str) entry.vence90++;
      if (dl <= d60Str) entry.vence60++;
      if (dl <= d30Str) entry.vence30++;
      if (dl <= hojeStr) entry.vencidas++;
    }
  }

  // Filtrar setor fantasma (setorId = -1, colaboradores sem setor cadastrado)
  return Array.from(setorMap.values())
    .filter(s => s.setorId !== -1)
    .map((s) => ({
      ...s,
      saldoMedio: s.total > 0 ? Math.round(s.saldoTotal / s.total) : 0,
    })).sort((a, b) => a.setorNome.localeCompare(b.setorNome));
}

// Retorna todos os colaboradores ativos (sem paginação) para uso em selects/modais
  export async function getColaboradoresAtivos(empresaId?: number, setorId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(colaboradores.status, "ativo")];
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId));
  if (setorId) conditions.push(eq(colaboradores.setorId, setorId));
  return db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      codigo: colaboradores.codigo,
      empresaId: colaboradores.empresaId,
      setorId: colaboradores.setorId,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      admissao: colaboradores.admissao,
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
      diasDireito: colaboradores.diasDireito,
      saldo: colaboradores.saldo,
      venda10: colaboradores.venda10,
      valorSeguroVida: colaboradores.valorSeguroVida,
      valorSeguroVidaEmpresa: empresas.valorSeguroVida,
      cpf: colaboradores.cpf,
      dataNascimento: colaboradores.dataNascimento,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(...conditions))
    .orderBy(asc(colaboradores.nome));
}

export async function getColaboradoresPorSetor(setorId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      codigo: colaboradores.codigo,
      status: colaboradores.status,
      admissao: colaboradores.admissao,
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
      diasDireito: colaboradores.diasDireito,
      saldo: colaboradores.saldo,
      venda10: colaboradores.venda10,
      planejamento1: colaboradores.planejamento1,
      planejamento2: colaboradores.planejamento2,
      planejamento3: colaboradores.planejamento3,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(eq(colaboradores.setorId, setorId), eq(colaboradores.status, "ativo")))
    .orderBy(asc(colaboradores.dataLimite));
}

export async function exportColaboradoresCSV(empresaId?: number, setorId?: number, colaboradorId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId));
  if (setorId) conditions.push(eq(colaboradores.setorId, setorId));
  if (colaboradorId) conditions.push(eq(colaboradores.id, colaboradorId));
  return db
    .select({
      id: colaboradores.id,
      codigo: colaboradores.codigo,
      nome: colaboradores.nome,
      status: colaboradores.status,
      admissao: colaboradores.admissao,
      dataNascimento: colaboradores.dataNascimento,
      cpf: colaboradores.cpf,
      rg: colaboradores.rg,
      rgExpedicao: colaboradores.rgExpedicao,
      rgOrgaoExpedidor: colaboradores.rgOrgaoExpedidor,
      nomePai: colaboradores.nomePai,
      nomeMae: colaboradores.nomeMae,
      telefone: colaboradores.telefone,
      emailCorporativo: colaboradores.emailCorporativo,
      cargo: colaboradores.cargo,
      contatoEmergenciaNome: colaboradores.contatoEmergenciaNome,
      contatoEmergenciaTelefone: colaboradores.contatoEmergenciaTelefone,
      enderecoLogradouro: colaboradores.enderecoLogradouro,
      enderecoNumero: colaboradores.enderecoNumero,
      enderecoComplemento: colaboradores.enderecoComplemento,
      enderecoBairro: colaboradores.enderecoBairro,
      enderecoCidade: colaboradores.enderecoCidade,
      enderecoEstado: colaboradores.enderecoEstado,
      enderecoCep: colaboradores.enderecoCep,
      tituloEleitor: colaboradores.tituloEleitor,
      zonaEleitoral: colaboradores.zonaEleitoral,
      secaoEleitoral: colaboradores.secaoEleitoral,
      pis: colaboradores.pis,
      ctpsDigital: colaboradores.ctpsDigital,
      ctpsNumero: colaboradores.ctpsNumero,
      ctpsSerie: colaboradores.ctpsSerie,
      // Férias (mantidos para o módulo de férias)
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
      diasDireito: colaboradores.diasDireito,
      saldo: colaboradores.saldo,
      venda10: colaboradores.venda10,
      fracionada: colaboradores.fracionada,
      planejamento1: colaboradores.planejamento1,
      planejamento2: colaboradores.planejamento2,
      planejamento3: colaboradores.planejamento3,
      observacoes: colaboradores.observacoes,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(empresas.nome), asc(setores.nome), asc(colaboradores.nome));
}

// ─── Exportação de Histórico de Férias ──────────────────────────────────────────────────────────────────
export async function exportHistoricoFerias(filters: { empresaId?: number; setorId?: number; colaboradorId?: number; ano?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresaId) conditions.push(eq(historicoFerias.empresaId, filters.empresaId));
  if (filters.setorId) conditions.push(eq(historicoFerias.setorId, filters.setorId));
  if (filters.colaboradorId) conditions.push(eq(historicoFerias.colaboradorId, filters.colaboradorId));
  if (filters.ano) {
    conditions.push(sql`EXTRACT(YEAR FROM ${historicoFerias.dataSaida}) = ${filters.ano}` as any);
  }
  return db
    .select({
      id: historicoFerias.id,
      colaboradorNome: colaboradores.nome,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      dataSaida: historicoFerias.dataSaida,
      dataRetorno: historicoFerias.dataRetorno,
      diasGozados: historicoFerias.diasGozados,
      venda10: historicoFerias.venda10,
      diasVendidos: historicoFerias.diasVendidos,
      periodoRef: historicoFerias.periodoRef,
      observacao: historicoFerias.observacao,
      createdByNome: historicoFerias.createdByNome,
      createdAt: historicoFerias.createdAt,
    })
    .from(historicoFerias)
    .leftJoin(colaboradores, eq(historicoFerias.colaboradorId, colaboradores.id))
    .leftJoin(empresas, eq(historicoFerias.empresaId, empresas.id))
    .leftJoin(setores, eq(historicoFerias.setorId, setores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(historicoFerias.dataSaida));
}

// ─── Exportação de Abonos ─────────────────────────────────────────────────────────────────────────────────
export async function exportAbonos(filters: { empresaId?: number; setorId?: number; colaboradorId?: number; ano?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresaId) conditions.push(eq(abonos.empresaId, filters.empresaId));
  if (filters.setorId) conditions.push(eq(abonos.setorId, filters.setorId));
  if (filters.colaboradorId) conditions.push(eq(abonos.colaboradorId, filters.colaboradorId));
  if (filters.ano) conditions.push(eq(abonos.anoReferencia, filters.ano));
  return db
    .select({
      id: abonos.id,
      colaboradorNome: colaboradores.nome,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      anoReferencia: abonos.anoReferencia,
      dataAbono: abonos.dataAbono,
      dataAbono2: abonos.dataAbono2,
      diasAbonados: abonos.diasAbonados,
      observacao: abonos.observacao,
      createdByNome: abonos.createdByNome,
      createdAt: abonos.createdAt,
    })
    .from(abonos)
    .leftJoin(colaboradores, eq(abonos.colaboradorId, colaboradores.id))
    .leftJoin(empresas, eq(abonos.empresaId, empresas.id))
    .leftJoin(setores, eq(abonos.setorId, setores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(abonos.dataAbono));
}

// ─── Exportação de Atestados ──────────────────────────────────────────────────────────────────────────────
export async function exportAtestados(filters: { empresaId?: number; setorId?: number; colaboradorId?: number; ano?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresaId) conditions.push(eq(atestados.empresaId, filters.empresaId));
  if (filters.setorId) conditions.push(eq(atestados.setorId, filters.setorId));
  if (filters.colaboradorId) conditions.push(eq(atestados.colaboradorId, filters.colaboradorId));
  if (filters.ano) {
    conditions.push(sql`EXTRACT(YEAR FROM ${atestados.dataInicio}) = ${filters.ano}` as any);
  }
  return db
    .select({
      id: atestados.id,
      colaboradorNome: colaboradores.nome,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      dataInicio: atestados.dataInicio,
      dataFim: atestados.dataFim,
      diasAfastamento: atestados.diasAfastamento,
      tipo: atestados.tipo,
      cid: atestados.cid,
      medico: atestados.medico,
      observacao: atestados.observacao,
      createdByNome: atestados.createdByNome,
      createdAt: atestados.createdAt,
    })
    .from(atestados)
    .leftJoin(colaboradores, eq(atestados.colaboradorId, colaboradores.id))
    .leftJoin(empresas, eq(atestados.empresaId, empresas.id))
    .leftJoin(setores, eq(atestados.setorId, setores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(atestados.dataInicio));
}

// ─── Exportação de Benefícios ─────────────────────────────────────────────────────────────────────────────
export async function exportBeneficios(filters: { empresaId?: number; setorId?: number } = {}) {
  return getBeneficios(filters);
}

// ─── Exportação de Seguro de Vida ─────────────────────────────────────────────────────────────────────────
export async function exportSeguroVida(filters: { empresaId?: number; setorId?: number; seguro?: "com" | "sem" | "todos" } = {}) {
  return getSeguroVida(filters);
}

// ─── Histórico de Férias ─────────────────────────────────────────────────────────────────────────────────
export async function getHistoricoFerias(filters: {
  mes?: number;
  ano?: number;
  empresaId?: number;
  setorId?: number;
  colaboradorId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.empresaId) {
    conditions.push(eq(historicoFerias.empresaId, filters.empresaId) as any);
  }
  if (filters.setorId) {
    conditions.push(eq(historicoFerias.setorId, filters.setorId) as any);
  }
  if (filters.colaboradorId) {
    conditions.push(eq(historicoFerias.colaboradorId, filters.colaboradorId) as any);
  }
  if (filters.mes && filters.ano) {
    // Usa strings ISO para evitar bug de timezone com new Date(year, month, day)
    const mesStr = String(filters.mes).padStart(2, "0");
    const ultimoDia = new Date(filters.ano, filters.mes, 0).getDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, "0");
    const inicioStr = `${filters.ano}-${mesStr}-01`;
    const fimStr = `${filters.ano}-${mesStr}-${ultimoDiaStr}`;
    conditions.push(sql`${historicoFerias.dataSaida}::date >= ${inicioStr}` as any);
    conditions.push(sql`${historicoFerias.dataSaida}::date <= ${fimStr}` as any);
  } else if (filters.ano) {
    const inicioStr = `${filters.ano}-01-01`;
    const fimStr = `${filters.ano}-12-31`;
    conditions.push(sql`${historicoFerias.dataSaida}::date >= ${inicioStr}` as any);
    conditions.push(sql`${historicoFerias.dataSaida}::date <= ${fimStr}` as any);
  }

  return db
    .select({
      id: historicoFerias.id,
      colaboradorId: historicoFerias.colaboradorId,
      colaboradorNome: colaboradores.nome,
      empresaId: historicoFerias.empresaId,
      empresaNome: empresas.nome,
      setorId: historicoFerias.setorId,
      setorNome: setores.nome,
      dataSaida: historicoFerias.dataSaida,
      dataFim: historicoFerias.dataFim,
      dataRetorno: historicoFerias.dataRetorno,
      diasGozados: historicoFerias.diasGozados,
      venda10: historicoFerias.venda10,
      diasVendidos: historicoFerias.diasVendidos,
      periodoRef: historicoFerias.periodoRef,
      observacao: historicoFerias.observacao,
      createdByNome: historicoFerias.createdByNome,
      createdAt: historicoFerias.createdAt,
    })
    .from(historicoFerias)
    .leftJoin(colaboradores, eq(historicoFerias.colaboradorId, colaboradores.id))
    .leftJoin(empresas, eq(historicoFerias.empresaId, empresas.id))
    .leftJoin(setores, eq(historicoFerias.setorId, setores.id))
    .where(conditions.length > 0 ? and(...(conditions as any[])) : undefined)
    .orderBy(desc(historicoFerias.dataSaida));
}

// ─── Recalcula saldo e datas do colaborador com base em todos os lançamentos ──
export async function recalcularSaldoColaborador(colaboradorId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Busca o colaborador
  const [colab] = await db
    .select({
      diasDireito: colaboradores.diasDireito,
      admissao: colaboradores.admissao,
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
    })
    .from(colaboradores)
    .where(eq(colaboradores.id, colaboradorId))
    .limit(1);
  if (!colab) return;

  // Busca TODOS os lançamentos do colaborador
  const todosLancamentos = await db
    .select({
      diasGozados: historicoFerias.diasGozados,
      diasVendidos: historicoFerias.diasVendidos,
      dataSaida: historicoFerias.dataSaida,
      periodoRef: historicoFerias.periodoRef,
    })
    .from(historicoFerias)
    .where(eq(historicoFerias.colaboradorId, colaboradorId));

  const diasDireito = colab.diasDireito ?? 30;

  // Helper: converte data para string YYYY-MM-DD
  const toStr = (d: Date | string | null | undefined): string => {
    if (!d) return '';
    if (d instanceof Date) return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    return String(d).split('T')[0];
  };

  // Helper: calcula vencimento e dataLimite a partir do periodoAquisitivo
  const calcDatas = (pa: Date) => {
    const y = pa.getUTCFullYear();
    const m = pa.getUTCMonth();
    const d = pa.getUTCDate();
    // Vencimento = PA + 1 ano - 1 dia
    const venc = new Date(Date.UTC(y + 1, m, d - 1, 12, 0, 0));
    // Data limite = vencimento + 11 meses + 1 dia
    const lim = new Date(venc.getTime());
    lim.setUTCMonth(lim.getUTCMonth() + 11);
    lim.setUTCDate(lim.getUTCDate() + 1);
    return { vencimento: venc, dataLimite: lim };
  };

  const admissaoRaw = colab.admissao;
  if (!admissaoRaw) {
    // Sem admissão, apenas recalcula saldo no período atual
    const periodoInicioStr = toStr(colab.periodoAquisitivo as Date | string | null);
    const filtrados = periodoInicioStr
      ? todosLancamentos.filter(l => toStr(l.dataSaida as Date | string | null) >= periodoInicioStr)
      : todosLancamentos;
    const consumido = filtrados.reduce((acc, l) => acc + (l.diasGozados ?? 0) + (l.diasVendidos ?? 0), 0);
    await db.update(colaboradores).set({ saldo: Math.max(0, diasDireito - consumido) } as any).where(eq(colaboradores.id, colaboradorId));
    return;
  }

  const admissao = parseDateCol(admissaoRaw);

  // Helper: converte periodoRef ("DD/MM/YYYY a DD/MM/YYYY") para data de início
  const periodoRefToStart = (ref: string | null): string | null => {
    if (!ref) return null;
    // Formato esperado: "01/11/2024 a 31/10/2025"
    const match = ref.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD
  };

  // -----------------------------------------------------------------------
  // NOVA ESTRATÉGIA (corrige bug de cancelamento de férias):
  // Reconstruir TODOS os períodos aquisitivos desde a admissão e encontrar
  // o período correto iterando do mais antigo ao mais recente.
  // Um período está "completo" (saldo = 0) somente se a soma dos lançamentos
  // que referenciam aquele período atingir diasDireito.
  // Ao cancelar férias, o saldo volta ao período anterior corretamente.
  // -----------------------------------------------------------------------

  // Monta um mapa: periodoStartStr -> total consumido naquele período
  const consumidoPorPeriodo = new Map<string, number>();
  for (const l of todosLancamentos) {
    const refStart = periodoRefToStart(l.periodoRef ?? null);
    if (refStart) {
      const atual = consumidoPorPeriodo.get(refStart) ?? 0;
      consumidoPorPeriodo.set(refStart, atual + (l.diasGozados ?? 0) + (l.diasVendidos ?? 0));
    }
  }

  // Para lançamentos sem periodoRef, determina o período pela dataSaida
  for (const l of todosLancamentos) {
    if (l.periodoRef) continue; // já processado acima
    const ds = toStr(l.dataSaida as Date | string | null);
    if (!ds) continue;
    // Encontra qual período aquisitivo contém essa dataSaida
    for (let i = 0; i < 50; i++) {
      const paStart = new Date(Date.UTC(admissao.getUTCFullYear() + i, admissao.getUTCMonth(), admissao.getUTCDate(), 12, 0, 0));
      const paEnd   = new Date(Date.UTC(admissao.getUTCFullYear() + i + 1, admissao.getUTCMonth(), admissao.getUTCDate() - 1, 12, 0, 0));
      const paStartStr = toStr(paStart);
      const paEndStr   = toStr(paEnd);
      if (ds >= paStartStr && ds <= paEndStr) {
        const atual = consumidoPorPeriodo.get(paStartStr) ?? 0;
        consumidoPorPeriodo.set(paStartStr, atual + (l.diasGozados ?? 0) + (l.diasVendidos ?? 0));
        break;
      }
    }
  }

  // Período aquisitivo atual gravado no cadastro: a partir dele, nenhum período
  // é pulado, mesmo já terminado e sem lançamentos (as férias ainda são devidas).
  // Períodos ANTERIORES a ele sem lançamentos são considerados já gozados
  // (histórico importado das planilhas).
  const pisoStr = toStr(colab.periodoAquisitivo as Date | string | null);

  // Itera períodos desde a admissão até encontrar o período com saldo > 0
  let periodoCorreto: Date = admissao;
  let saldoCorreto: number = diasDireito;
  const hoje = new Date();

  for (let i = 0; i < 50; i++) {
    const paStart = new Date(Date.UTC(
      admissao.getUTCFullYear() + i,
      admissao.getUTCMonth(),
      admissao.getUTCDate(),
      12, 0, 0
    ));
    const paStartStr = toStr(paStart);
    const consumido = consumidoPorPeriodo.get(paStartStr) ?? 0;
    const saldo = Math.max(0, diasDireito - consumido);

    if (saldo > 0) {
      // Este período tem saldo, mas só é o período correto se:
      // 1. Tem lançamentos (consumido > 0), OU
      // 2. É o período atual (hoje está dentro dele), OU
      // 3. É o próximo período (começa no futuro)
      const paEnd = new Date(Date.UTC(
        admissao.getUTCFullYear() + i + 1,
        admissao.getUTCMonth(),
        admissao.getUTCDate() - 1,
        12, 0, 0
      ));
      const periodoJaTerminou = hoje > paEnd;

      const naoPodePular = !!pisoStr && paStartStr >= pisoStr;
      if (consumido > 0 || !periodoJaTerminou || naoPodePular) {
        // Período com lançamentos OU período atual/futuro: este é o correto
        periodoCorreto = paStart;
        saldoCorreto = saldo;
        break;
      }
      // Período passado sem lançamentos: pula para o próximo
      // (colaborador não tirou férias nesse período — período vencido/perdido)
      continue;
    }
    // Período totalmente consumido: avança para o próximo
    // (continua o loop)

    // Segurança: se chegou ao período atual sem encontrar saldo,
    // usa o período atual calculado pela data de hoje
    const paEnd = new Date(Date.UTC(
      admissao.getUTCFullYear() + i + 1,
      admissao.getUTCMonth(),
      admissao.getUTCDate() - 1,
      12, 0, 0
    ));
    if (hoje <= paEnd) {
      // Estamos dentro deste período mas ele está consumido: avança para o próximo
      periodoCorreto = new Date(Date.UTC(
        admissao.getUTCFullYear() + i + 1,
        admissao.getUTCMonth(),
        admissao.getUTCDate(),
        12, 0, 0
      ));
      saldoCorreto = diasDireito;
      break;
    }
  }

  const { vencimento, dataLimite } = calcDatas(periodoCorreto);

  await db.update(colaboradores).set({
    periodoAquisitivo: toStr(periodoCorreto),
    vencimento: toStr(vencimento),
    dataLimite: toStr(dataLimite),
    saldo: saldoCorreto,
  } as any).where(eq(colaboradores.id, colaboradorId));
}

export async function createHistoricoFerias(data: InsertHistoricoFerias) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Guarda o estado do colaborador antes do lançamento, para restaurar se for cancelado
  const [antes] = await db
    .select({
      periodoAquisitivo: colaboradores.periodoAquisitivo,
      vencimento: colaboradores.vencimento,
      dataLimite: colaboradores.dataLimite,
      saldo: colaboradores.saldo,
    })
    .from(colaboradores)
    .where(eq(colaboradores.id, data.colaboradorId))
    .limit(1);
  const result = await db.insert(historicoFerias).values({
    ...data,
    periodoAquisitivoAnterior: (antes?.periodoAquisitivo ?? null) as any,
    vencimentoAnterior: (antes?.vencimento ?? null) as any,
    dataLimiteAnterior: (antes?.dataLimite ?? null) as any,
    saldoAnterior: antes?.saldo ?? null,
  });
  // Recalcula saldo do colaborador após lançamento
  await recalcularSaldoColaborador(data.colaboradorId);
  return result;
}

export async function updateHistoricoFerias(id: number, data: Partial<InsertHistoricoFerias>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Busca o colaboradorId e datas ANTES do update para recalcular corretamente
  const [registroAntes] = await db
    .select({
      colaboradorId: historicoFerias.colaboradorId,
      dataSaida: historicoFerias.dataSaida,
      dataRetorno: historicoFerias.dataRetorno,
    })
    .from(historicoFerias)
    .where(eq(historicoFerias.id, id))
    .limit(1);
  await db.update(historicoFerias).set({ ...data, updatedAt: new Date() }).where(eq(historicoFerias.id, id));
  // Recalcula saldo do colaborador antigo (sempre, se existia)
  if (registroAntes) {
    await recalcularSaldoColaborador(registroAntes.colaboradorId);
    // Se o colaboradorId foi alterado, recalcula também o novo colaborador
    if (data.colaboradorId && data.colaboradorId !== registroAntes.colaboradorId) {
      await recalcularSaldoColaborador(data.colaboradorId);
    }
    // Recalcula folhaMes para os meses afetados pelas datas ANTES do update
    const mesesAntes = getMesesAfetadosPorFerias(registroAntes.dataSaida, registroAntes.dataRetorno);
    // Recalcula folhaMes para os meses afetados pelas datas DEPOIS do update (se mudaram)
    const novaSaida = (data.dataSaida as any) ?? registroAntes.dataSaida;
    const novoRetorno = (data.dataRetorno as any) ?? registroAntes.dataRetorno;
    const mesesDepois = getMesesAfetadosPorFerias(novaSaida, novoRetorno);
    // Unir todos os meses afetados (antes + depois, sem duplicatas)
    const todosMeses = [...mesesAntes];
    for (const m of mesesDepois) {
      if (!todosMeses.some(x => x.mes === m.mes && x.ano === m.ano)) {
        todosMeses.push(m);
      }
    }
    const colabId = data.colaboradorId ?? registroAntes.colaboradorId;
    await recalcularFolhaMesColaborador(colabId, todosMeses);
  }
}

export async function deleteHistoricoFerias(id: number, canceladoPorUserId?: number, canceladoPorNome?: string, motivo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Busca todos os dados antes de deletar para registrar o cancelamento
  const [registro] = await db
    .select({
      colaboradorId: historicoFerias.colaboradorId,
      dataSaida: historicoFerias.dataSaida,
      dataRetorno: historicoFerias.dataRetorno,
      diasGozados: historicoFerias.diasGozados,
      diasVendidos: historicoFerias.diasVendidos,
      periodoRef: historicoFerias.periodoRef,
      periodoAquisitivoAnterior: historicoFerias.periodoAquisitivoAnterior,
      vencimentoAnterior: historicoFerias.vencimentoAnterior,
      dataLimiteAnterior: historicoFerias.dataLimiteAnterior,
      saldoAnterior: historicoFerias.saldoAnterior,
    })
    .from(historicoFerias)
    .where(eq(historicoFerias.id, id))
    .limit(1);

  // Só dá para restaurar com segurança o lançamento MAIS RECENTE do colaborador:
  // se houver outro lançado depois, restaurar apagaria o efeito dele.
  let podeRestaurar = false;
  if (registro?.periodoAquisitivoAnterior) {
    const [maisRecente] = await db
      .select({ id: historicoFerias.id })
      .from(historicoFerias)
      .where(eq(historicoFerias.colaboradorId, registro.colaboradorId))
      .orderBy(desc(historicoFerias.id))
      .limit(1);
    podeRestaurar = maisRecente?.id === id;
  }

  if (registro) {
    // Busca o nome do colaborador
    const [colab] = await db
      .select({ nome: colaboradores.nome })
      .from(colaboradores)
      .where(eq(colaboradores.id, registro.colaboradorId))
      .limit(1);

    // Registra o cancelamento ANTES de deletar
    await db.insert(cancelamentoFerias).values({
      colaboradorId: registro.colaboradorId,
      colaboradorNome: colab?.nome ?? "Desconhecido",
      dataSaida: registro.dataSaida as any,
      dataRetorno: registro.dataRetorno as any,
      diasGozados: registro.diasGozados ?? 0,
      diasVendidos: registro.diasVendidos ?? 0,
      periodoRef: registro.periodoRef ?? null,
      motivo: motivo ?? null,
      canceladoPorUserId: canceladoPorUserId ?? null,
      canceladoPorNome: canceladoPorNome ?? null,
      canceladoEm: new Date(),
    });
  }

  await db.delete(historicoFerias).where(eq(historicoFerias.id, id));

  // Volta o colaborador ao estado de antes do lançamento (sem recalcular).
  // Lançamentos antigos (sem estado guardado) ou fora de ordem usam o recálculo.
  if (registro) {
    if (podeRestaurar) {
      await db.update(colaboradores).set({
        periodoAquisitivo: registro.periodoAquisitivoAnterior,
        vencimento: registro.vencimentoAnterior,
        dataLimite: registro.dataLimiteAnterior,
        saldo: registro.saldoAnterior ?? 30,
      } as any).where(eq(colaboradores.id, registro.colaboradorId));
    } else {
      await recalcularSaldoColaborador(registro.colaboradorId);
    }
    const mesesAfetados = getMesesAfetadosPorFerias(registro.dataSaida, registro.dataRetorno);
    await recalcularFolhaMesColaborador(registro.colaboradorId, mesesAfetados);
  }
}
export async function getCancelamentosFerias(filtros?: { colaboradorId?: number; empresa?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({
      id: cancelamentoFerias.id,
      colaboradorId: cancelamentoFerias.colaboradorId,
      colaboradorNome: cancelamentoFerias.colaboradorNome,
      dataSaida: cancelamentoFerias.dataSaida,
      dataRetorno: cancelamentoFerias.dataRetorno,
      diasGozados: cancelamentoFerias.diasGozados,
      diasVendidos: cancelamentoFerias.diasVendidos,
      periodoRef: cancelamentoFerias.periodoRef,
      motivo: cancelamentoFerias.motivo,
      canceladoPorNome: cancelamentoFerias.canceladoPorNome,
      canceladoEm: cancelamentoFerias.canceladoEm,
      empresaId: colaboradores.empresaId,
    })
    .from(cancelamentoFerias)
    .leftJoin(colaboradores, eq(colaboradores.id, cancelamentoFerias.colaboradorId))
    .orderBy(desc(cancelamentoFerias.canceladoEm))
    .limit(filtros?.limit ?? 200);
  return query;
}

export async function deleteColaborador(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Mês e ano atuais para preservar histórico de VT/VR de meses anteriores
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1; // 1-12

  // Remove registros de férias, abonos, atestados, exames e plano de saúde (sem histórico relevante)
  await db.delete(historicoFerias).where(eq(historicoFerias.colaboradorId, id));
  await db.delete(abonos).where(eq(abonos.colaboradorId, id));
  await db.delete(atestados).where(eq(atestados.colaboradorId, id));
  await db.delete(examesPeriodicos).where(eq(examesPeriodicos.colaboradorId, id));
  await db.delete(planoSaude).where(eq(planoSaude.colaboradorId, id));
  await db.delete(movimentacaoSeguroVida).where(eq(movimentacaoSeguroVida.colaboradorId, id));
  await db.delete(movimentacaoAuxilioNotebook).where(eq(movimentacaoAuxilioNotebook.colaboradorId, id));
  await db.delete(movimentacaoPlanoSaude).where(eq(movimentacaoPlanoSaude.colaboradorId, id));
  await db.delete(movimentacaoValeTransporte).where(eq(movimentacaoValeTransporte.colaboradorId, id));
  await db.delete(movimentacaoAuxilioCreche).where(eq(movimentacaoAuxilioCreche.colaboradorId, id));
  await db.delete(movimentacaoBonusIndicacao).where(eq(movimentacaoBonusIndicacao.indicadorId, id));

  // VT/VR: preserva histórico de meses ANTERIORES ao atual.
  // Remove apenas registros do mês atual em diante (planilhas ainda não fechadas).
  await db.delete(folhaMes).where(
    and(
      eq(folhaMes.colaboradorId, id),
      or(
        sql`${folhaMes.ano} > ${anoAtual}`,
        and(sql`${folhaMes.ano} = ${anoAtual}`, sql`${folhaMes.mes} >= ${mesAtual}`)
      )
    )
  );
  // folhaMesExcecoes não tem colunas ano/mes — exclui todas as exceções do colaborador
  await db.delete(folhaMesExcecoes).where(eq(folhaMesExcecoes.colaboradorId, id));
  await db.delete(ausenciasVRVT).where(
    and(
      eq(ausenciasVRVT.colaboradorId, id),
      or(
        sql`${ausenciasVRVT.ano} > ${anoAtual}`,
        and(sql`${ausenciasVRVT.ano} = ${anoAtual}`, sql`${ausenciasVRVT.mes} >= ${mesAtual}`)
      )
    )
  );
  await db.delete(diasCustomVRVT).where(
    and(
      eq(diasCustomVRVT.colaboradorId, id),
      or(
        sql`${diasCustomVRVT.ano} > ${anoAtual}`,
        and(sql`${diasCustomVRVT.ano} = ${anoAtual}`, sql`${diasCustomVRVT.mes} >= ${mesAtual}`)
      )
    )
  );

  // Remove o colaborador
  await db.delete(colaboradores).where(eq(colaboradores.id, id));
}

export async function getResumoMensalFerias(ano: number) {
  const db = await getDb();
  if (!db) return [];
  // Usa strings ISO para evitar bug de timezone com new Date(year, month, day)
  const inicioStr = `${ano}-01-01`;
  const fimStr = `${ano}-12-31`;
  return db
    .select({
      id: historicoFerias.id,
      colaboradorNome: colaboradores.nome,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      dataSaida: historicoFerias.dataSaida,
      dataRetorno: historicoFerias.dataRetorno,
      diasGozados: historicoFerias.diasGozados,
      venda10: historicoFerias.venda10,
      diasVendidos: historicoFerias.diasVendidos,
    })
    .from(historicoFerias)
    .leftJoin(colaboradores, eq(historicoFerias.colaboradorId, colaboradores.id))
    .leftJoin(empresas, eq(historicoFerias.empresaId, empresas.id))
    .leftJoin(setores, eq(historicoFerias.setorId, setores.id))
    .where(and(
      sql`${historicoFerias.dataSaida}::date >= ${inicioStr}`,
      sql`${historicoFerias.dataSaida}::date <= ${fimStr}`
    ))
    .orderBy(asc(historicoFerias.dataSaida));
}

// ─── Abonos ───────────────────────────────────────────────────────────────────

export type AbonoBusca = {
  colaboradorId?: number;
  empresaId?: number;
  setorId?: number;
  anoReferencia?: number;
  page?: number;
  pageSize?: number;
};

export async function getAbonos(filtros: AbonoBusca = {}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const { colaboradorId, empresaId, setorId, anoReferencia, page = 1, pageSize = 50 } = filtros;

  const conditions: any[] = [];
  if (colaboradorId) conditions.push(eq(abonos.colaboradorId, colaboradorId));
  if (empresaId) conditions.push(eq(abonos.empresaId, empresaId));
  if (setorId) conditions.push(eq(abonos.setorId, setorId));
  if (anoReferencia) conditions.push(eq(abonos.anoReferencia, anoReferencia));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, data] = await Promise.all([
    db.select({ count: count() }).from(abonos).where(whereClause),
    db
      .select({
        id: abonos.id,
        colaboradorId: abonos.colaboradorId,
        colaboradorNome: colaboradores.nome,
        admissao: colaboradores.admissao,
        empresaId: abonos.empresaId,
        empresaNome: empresas.nome,
        setorId: abonos.setorId,
        setorNome: setores.nome,
        anoReferencia: abonos.anoReferencia,
        dataAbono: abonos.dataAbono,
        dataAbono2: abonos.dataAbono2,
        diasAbonados: abonos.diasAbonados,
        observacao: abonos.observacao,
        createdAt: abonos.createdAt,
        createdByNome: abonos.createdByNome,
        createdByUserId: abonos.createdByUserId,
      })
      .from(abonos)
      .leftJoin(colaboradores, eq(abonos.colaboradorId, colaboradores.id))
      .leftJoin(empresas, eq(abonos.empresaId, empresas.id))
      .leftJoin(setores, eq(abonos.setorId, setores.id))
      .where(whereClause)
      .orderBy(desc(abonos.dataAbono))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

// Retorna o total de dias abonados por colaborador em determinado ano
export async function getSaldoAbonoPorColaborador(colaboradorId: number, anoReferencia: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${abonos.diasAbonados}), 0)` })
    .from(abonos)
    .where(and(eq(abonos.colaboradorId, colaboradorId), eq(abonos.anoReferencia, anoReferencia)));
  return Number(result[0]?.total ?? 0);
}

export async function createAbono(data: InsertAbono) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(abonos).values(data);
  return result;
}

export async function updateAbono(id: number, data: Partial<InsertAbono>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(abonos).set({ ...data, updatedAt: new Date() }).where(eq(abonos.id, id));
}

export async function deleteAbono(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(abonos).where(eq(abonos.id, id));
}

// ─── Atestados ────────────────────────────────────────────────────────────────

export async function getAtestados(filters: {
  mes?: number;
  ano?: number;
  empresaId?: number;
  setorId?: number;
  colaboradorId?: number;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conditions: any[] = [];

  if (filters.empresaId) conditions.push(eq(atestados.empresaId, filters.empresaId));
  if (filters.setorId) conditions.push(eq(atestados.setorId, filters.setorId));
  if (filters.colaboradorId) conditions.push(eq(atestados.colaboradorId, filters.colaboradorId));

  if (filters.mes && filters.ano) {
    // Usa strings ISO para evitar bug de timezone com new Date(year, month, day)
    const mesStr = String(filters.mes).padStart(2, "0");
    const ultimoDia = new Date(filters.ano, filters.mes, 0).getDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, "0");
    const inicioStr = `${filters.ano}-${mesStr}-01`;
    const fimStr = `${filters.ano}-${mesStr}-${ultimoDiaStr}`;
    conditions.push(sql`${atestados.dataInicio}::date >= ${inicioStr}` as any);
    conditions.push(sql`${atestados.dataInicio}::date <= ${fimStr}` as any);
  } else if (filters.ano) {
    const inicioStr = `${filters.ano}-01-01`;
    const fimStr = `${filters.ano}-12-31`;
    conditions.push(sql`${atestados.dataInicio}::date >= ${inicioStr}` as any);
    conditions.push(sql`${atestados.dataInicio}::date <= ${fimStr}` as any);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 100;
  const offset = (page - 1) * pageSize;

  const [data, totalResult] = await Promise.all([
    db.select({
      id: atestados.id,
      colaboradorId: atestados.colaboradorId,
      colaboradorNome: colaboradores.nome,
      empresaId: atestados.empresaId,
      empresaNome: empresas.nome,
      setorId: atestados.setorId,
      setorNome: setores.nome,
      dataInicio: atestados.dataInicio,
      dataFim: atestados.dataFim,
      diasAfastamento: atestados.diasAfastamento,
      diasDescontar: atestados.diasDescontar,
      tipoAfastamento: atestados.tipoAfastamento,
      tipo: atestados.tipo,
      cid: atestados.cid,
      medico: atestados.medico,
      observacao: atestados.observacao,
      createdAt: atestados.createdAt,
      createdByNome: atestados.createdByNome,
      createdByUserId: atestados.createdByUserId,
    })
      .from(atestados)
      .leftJoin(colaboradores, eq(atestados.colaboradorId, colaboradores.id))
      .leftJoin(empresas, eq(atestados.empresaId, empresas.id))
      .leftJoin(setores, eq(atestados.setorId, setores.id))
      .where(where)
      .orderBy(desc(atestados.dataInicio))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() })
      .from(atestados)
      .where(where),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function createAtestado(data: Omit<InsertAtestado, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(atestados).values(data as any).returning({ id: atestados.id });
  return { id: result[0]?.id ?? 0 };
}

export async function updateAtestado(
  id: number,
  data: Partial<Omit<InsertAtestado, "id" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(atestados).set(data as any).where(eq(atestados.id, id));
}

export async function deleteAtestado(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(atestados).where(eq(atestados.id, id));
}

export async function getResumoMensalAtestados(ano: number) {
  const db = await getDb();
  if (!db) return [];

  // Usa strings ISO para evitar bug de timezone com new Date(year, month, day)
  const inicioStr = `${ano}-01-01`;
  const fimStr = `${ano}-12-31`;

  const rows = await db.select({
    dataInicio: atestados.dataInicio,
    diasAfastamento: atestados.diasAfastamento,
    tipo: atestados.tipo,
  })
    .from(atestados)
    .where(and(
      sql`${atestados.dataInicio}::date >= ${inicioStr}` as any,
      sql`${atestados.dataInicio}::date <= ${fimStr}` as any
    ));

  // Agrupa por mês
  const meses: Record<number, { mes: number; total: number; diasTotal: number; medico: number; odontologico: number; acompanhante: number; outros: number }> = {};
  for (let m = 1; m <= 12; m++) {
    meses[m] = { mes: m, total: 0, diasTotal: 0, medico: 0, odontologico: 0, acompanhante: 0, outros: 0 };
  }

  for (const r of rows) {
    const d = parseDateCol(r.dataInicio);
    const mes = d.getUTCMonth() + 1;
    if (meses[mes]) {
      meses[mes].total++;
      meses[mes].diasTotal += r.diasAfastamento ?? 0;
      const tipo = r.tipo ?? "medico";
      if (tipo === "medico") meses[mes].medico++;
      else if (tipo === "odontologico") meses[mes].odontologico++;
      else if (tipo === "acompanhante") meses[mes].acompanhante++;
      else meses[mes].outros++;
    }
  }

  return Object.values(meses);
}

// ─── System Users (autenticação própria) ──────────────────────────────────────

export async function getSystemUsers() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select({
    id: systemUsers.id,
    nome: systemUsers.nome,
    email: systemUsers.email,
    role: systemUsers.role,
    ativo: systemUsers.ativo,
    createdAt: systemUsers.createdAt,
  }).from(systemUsers).orderBy(asc(systemUsers.nome));
}

export async function getSystemUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await withTimeout(db.select().from(systemUsers).where(eq(systemUsers.email, email.toLowerCase().trim())).limit(1));
  return rows[0] ?? null;
}

export async function getSystemUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await withTimeout(
    db.select({
      id: systemUsers.id,
      nome: systemUsers.nome,
      email: systemUsers.email,
      role: systemUsers.role,
      ativo: systemUsers.ativo,
      createdAt: systemUsers.createdAt,
    }).from(systemUsers).where(eq(systemUsers.id, id)).limit(1)
  );
  return rows[0] ?? null;
}

export async function createSystemUser(data: { nome: string; email: string; role: "admin" | "usuario" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Gera senha aleatória de 8 caracteres (letras + números)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let senhaGerada = "";
  for (let i = 0; i < 8; i++) senhaGerada += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(senhaGerada, 10);
  await db.insert(systemUsers).values({
    nome: data.nome,
    email: data.email.toLowerCase().trim(),
    passwordHash,
    role: data.role,
    ativo: true,
  });
  return { senhaGerada };
}

export async function updateSystemUser(id: number, data: { nome?: string; email?: string; role?: "admin" | "usuario"; ativo?: boolean; passwordHash?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // PROTEÇÃO: nunca permite alterar passwordHash via esta função genérica.
  // Senhas só podem ser alteradas via changeSystemUserPassword() ou resetSystemUserPassword().
  const { passwordHash: _ignored, ...safeData } = data as any;
  if (Object.keys(safeData).length === 0) return; // nada a atualizar
  await db.update(systemUsers).set(safeData).where(eq(systemUsers.id, id));
}

/** Função dedicada para alterar a senha de um usuário do sistema.
 *  Diferente de updateSystemUser(), esta função PERMITE alterar o passwordHash.
 *  Deve ser usada exclusivamente pelo changePassword e resetPassword.
 */
export async function changeSystemUserPassword(id: number, novaSenha: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const passwordHash = await bcrypt.hash(novaSenha, 10);
  await db.update(systemUsers).set({ passwordHash } as any).where(eq(systemUsers.id, id));
}

export async function resetSystemUserPassword(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let novaSenha = "";
  for (let i = 0; i < 8; i++) novaSenha += chars[Math.floor(Math.random() * chars.length)];
  const passwordHash = await bcrypt.hash(novaSenha, 10);
  await db.update(systemUsers).set({ passwordHash } as any).where(eq(systemUsers.id, id));
  return { novaSenha };
}

export async function deleteSystemUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(systemUsers).where(eq(systemUsers.id, id));
}

export async function verifySystemUserPassword(email: string, senha: string): Promise<SystemUser | null> {
  const user = await getSystemUserByEmail(email);
  if (!user || !user.ativo) return null;
  const ok = await bcrypt.compare(senha, user.passwordHash);
  return ok ? user : null;
}

export async function countSystemAdmins(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select({ c: count() }).from(systemUsers).where(and(eq(systemUsers.role, "admin"), eq(systemUsers.ativo, true)));
  return rows[0]?.c ?? 0;
}

// ─── Seguro de Vida ───────────────────────────────────────────────────────────
export async function getSeguroVida(filtros: { busca?: string; empresaId?: number; setorId?: number; seguro?: "com" | "sem" | "todos" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { busca, empresaId, setorId, seguro = "todos" } = filtros;
  const conditions: any[] = [eq(colaboradores.status, "ativo")];
  if (seguro === "com") conditions.push(eq(colaboradores.temSeguroVida, true) as any);
  else if (seguro === "sem") conditions.push(eq(colaboradores.temSeguroVida, false) as any);
  // seguro === "todos" não adiciona filtro de seguro
  if (busca) conditions.push(sql`LOWER(${colaboradores.nome}) LIKE ${`%${busca.toLowerCase()}%`}` as any);
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId) as any);
  if (setorId) conditions.push(eq(colaboradores.setorId, setorId) as any);
  const rows = await db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      cpf: colaboradores.cpf,
      dataNascimento: colaboradores.dataNascimento,
      empresaId: colaboradores.empresaId,
      setorId: colaboradores.setorId,
      temSeguroVida: colaboradores.temSeguroVida,
      valorSeguroVida: colaboradores.valorSeguroVida,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(...conditions))
    .orderBy(colaboradores.nome);
  return rows;
}

export async function updateSeguroVida(id: number, data: { temSeguroVida: boolean; valorSeguroVida?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(colaboradores).set(data as any).where(eq(colaboradores.id, id));
}

// ─── Benefícios VR/VT ─────────────────────────────────────────────────────────
export async function getBeneficios(filtros: { busca?: string; empresaId?: number; setorId?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { busca, empresaId, setorId } = filtros;
  const conditions: any[] = [eq(colaboradores.status, "ativo")];
  if (busca) conditions.push(sql`LOWER(${colaboradores.nome}) LIKE ${`%${busca.toLowerCase()}%`}` as any);
  if (empresaId) conditions.push(eq(colaboradores.empresaId, empresaId) as any);
  if (setorId) conditions.push(eq(colaboradores.setorId, setorId) as any);
  const rows = await db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      empresaId: colaboradores.empresaId,
      setorId: colaboradores.setorId,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      setorBeneficio: colaboradores.setorBeneficio,
      valorVR: colaboradores.valorVR,
      valorVT: colaboradores.valorVT,
      auxilioVeiculo: colaboradores.auxilioVeiculo,
      auxilioVeiculoFolha: colaboradores.auxilioVeiculoFolha,
      auxilioCelularFolha: colaboradores.auxilioCelularFolha,
      tipoRecebimentoCaju: colaboradores.tipoRecebimentoCaju,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(...conditions))
    .orderBy(colaboradores.nome);
  return rows;
}

export async function updateBeneficio(
  id: number,
  data: {
    valorVR?: string | null;
    valorVT?: string | null;
    auxilioVeiculo?: string | null;
    auxilioVeiculoFolha?: string | null;
    auxilioCelularFolha?: string | null;
    setorBeneficio?: string | null;
    valorFixoQuinzenal?: string | null;
    tipoRecebimentoCaju?: "normal" | "vt_saldo_livre" | "vr_saldo_livre" | "auxilio_veiculo" | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(colaboradores).set(data as any).where(eq(colaboradores.id, id));
}

// ─── Eventos do Calendário ────────────────────────────────────────────────────
// (imports eq, gte, lte, and já estão no topo do arquivo)

export async function getEventos(anoMes?: { ano: number; mes: number }): Promise<EventoCalendario[]> {
  const db = await getDb();
  if (!db) return [];
  if (anoMes) {
    // Usa UTC para evitar bug de timezone: UTC-3 pode deslocar o primeiro/último dia do mês
    const inicio = new Date(Date.UTC(anoMes.ano, anoMes.mes - 1, 1, 0, 0, 0));
    const fim = new Date(Date.UTC(anoMes.ano, anoMes.mes, 0, 23, 59, 59));
    return db.select().from(eventosCalendario)
      .where(and(gte(eventosCalendario.dataHora, inicio), lte(eventosCalendario.dataHora, fim)))
      .orderBy(eventosCalendario.dataHora);
  }
  return db.select().from(eventosCalendario).orderBy(eventosCalendario.dataHora);
}

export async function getEventoById(id: number): Promise<EventoCalendario | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(eventosCalendario).where(eq(eventosCalendario.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createEvento(data: InsertEventoCalendario): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(eventosCalendario).values(data).returning({ id: eventosCalendario.id });
  return result[0]?.id ?? 0;
}

export async function updateEvento(id: number, data: Partial<InsertEventoCalendario>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(eventosCalendario).set(data).where(eq(eventosCalendario.id, id));
}

export async function deleteEvento(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(eventosCalendario).where(eq(eventosCalendario.id, id));
}

export async function getEventosByTaskUid(taskUid: string): Promise<EventoCalendario | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(eventosCalendario).orderBy(eventosCalendario.dataHora);
  // busca por taskUid na lista separada por vírgula
  const found = rows.find(e => e.lembretesTaskUids?.split(",").map(s => s.trim()).includes(taskUid));
  return found ?? null;
}

// ─── Planilha VR/VT ──────────────────────────────────────────────────────────

// Calcula dias úteis (seg-sex) de um mês/ano, retornando total e dias por quinzena
// Função auxiliar para buscar feriados do mês como Set
export async function getFeriadosSet(ano: number, mes: number): Promise<Set<string>> {
  const db = await getDb();
  const feriadosSet = new Set<string>();
  if (!db) return feriadosSet;
  const todosFeriados = await db.select().from(feriados).where(eq(feriados.ativo, true));
  for (const f of todosFeriados) {
    const dataFeriado = parseDateCol(f.data);
    const fAno = dataFeriado.getUTCFullYear();
    const fMes = dataFeriado.getUTCMonth() + 1;
    const fDia = dataFeriado.getUTCDate();
    if (f.recorrente) {
      if (fMes === mes) feriadosSet.add(`${ano}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`);
    } else {
      if (fAno === ano && fMes === mes) feriadosSet.add(`${ano}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`);
    }
  }
  return feriadosSet;
}

export async function getDiasUteisComFeriados(ano: number, mes: number) {
  const feriadosSet = await getFeriadosSet(ano, mes);
  const result = calcularDiasUteisQuinzenas(ano, mes, feriadosSet);
  // Montar lista de feriados que caem em dias úteis (para exibir na UI)
  const feriadosUteis: string[] = [];
  Array.from(feriadosSet).forEach((dataStr) => {
    const d = new Date(dataStr + 'T12:00:00Z');
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) feriadosUteis.push(dataStr);
  });
  return { ...result, feriadosUteis };
}

export function calcularDiasUteisQuinzenas(
  ano: number,
  mes: number,
  feriadosSet?: Set<string> // Set de strings "YYYY-MM-DD"
): {
  total: number;
  diasQ1: number;
  diasQ2: number;
  diasUteisQ1: number[];
  diasUteisQ2: number[];
} {
  const diasUteis: number[] = [];
  const diasNoMes = new Date(ano, mes, 0).getDate(); // mes é 1-based
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mes - 1, d).getDay(); // 0=dom, 6=sab
    if (dow === 0 || dow === 6) continue; // fim de semana
    // Verificar se é feriado
    const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (feriadosSet && feriadosSet.has(dataStr)) continue; // feriado
    diasUteis.push(d);
  }
  const total = diasUteis.length;
  // Q1 sempre fixo em 10 dias úteis; Q2 = restante
  const diasQ1 = Math.min(10, total);
  const diasQ2 = Math.max(0, total - diasQ1);
  return {
    total,
    diasQ1,
    diasQ2,
    diasUteisQ1: diasUteis.slice(0, diasQ1),
    diasUteisQ2: diasUteis.slice(diasQ1),
  };
}

export function calcularDiasUteisFerias(
  dataSaida: Date | string,
  dataFim: Date | string,
  ano: number,
  mes: number,
  feriadosSet?: Set<string>
): number {
  const dataSaidaStr = toDateStrSafe(dataSaida);
  const dataFimStr = toDateStrSafe(dataFim);
  if (!dataSaidaStr || !dataFimStr) return 0;

  const mesPad = String(mes).padStart(2, "0");
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const inicioMesStr = `${ano}-${mesPad}-01`;
  const fimMesStr = `${ano}-${mesPad}-${String(ultimoDiaMes).padStart(2, "0")}`;

  const inicioIntersecao = dataSaidaStr > inicioMesStr ? dataSaidaStr : inicioMesStr;
  const fimIntersecao = dataFimStr < fimMesStr ? dataFimStr : fimMesStr;
  if (inicioIntersecao > fimIntersecao) return 0;

  let diasUteisFerias = 0;
  for (let dataStr = inicioIntersecao; dataStr <= fimIntersecao; dataStr = addDiasStr(dataStr, 1)) {
    const [y, m, d] = dataStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (feriadosSet?.has(dataStr)) continue;
    diasUteisFerias++;
  }

  return diasUteisFerias;
}

export type PlanilhaVRVTColaborador = {
  id: number;
  nome: string;
  setorNome: string;
  setorBeneficio: string | null;
  empresaNome: string;
  // Valores base
  valorVR: number;
  valorVT: number;
  valorFixoQuinzenal: number;
  diasAusencia: number;
  ausenciaDetalhe: { ferias: number; atestado: number; manual: number };
  // 1ª Quinzena
  diasVrQ1: number;
  diasVtQ1: number;
  totalVrQ1: number;
  totalVtQ1: number;
  totalQ1: number;
  // 2ª Quinzena
  diasVrQ2: number;
  diasVtQ2: number;
  totalVrQ2: number;
  totalVtQ2: number;
  totalQ2: number;
  // Totais gerais
  geralVR: number;
  descontoVR: number;
  tipoDescontoVR: string;
  tipoRecebimentoCaju: string | null;
  vtFixoQ1?: number;
  vtFixoQ2?: number;
  geralVT: number;
  totalGeral: number;
};

export type PlanilhaVRVTSetor = {
  setorId: number | null;
  setorNome: string;
  empresaId: number | null;
  empresaNome: string;
  colaboradores: PlanilhaVRVTColaborador[];
  totalVrQ1: number;
  totalVtQ1: number;
  totalQ1: number;
  totalVrQ2: number;
  totalVtQ2: number;
  totalQ2: number;
  totalGeralVR: number;
  totalDescontoVR: number;
  totalGeralVT: number;
  totalGeral: number;
  totalAuxilioVeiculo: number;
};

export async function editarColaboradorVRVT(id: number, data: {
  nome?: string;
  valorVR?: number | null;
  valorVT?: number | null;
  ativoVRVT?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, any> = {};
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.valorVR !== undefined) updateData.valorVR = data.valorVR;
  if (data.valorVT !== undefined) updateData.valorVT = data.valorVT;
  if (data.ativoVRVT !== undefined) updateData.ativoVRVT = data.ativoVRVT;
  await db.update(colaboradores).set(updateData).where(eq(colaboradores.id, id));
}

export async function toggleAtivoVRVT(id: number, ativo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(colaboradores).set({ ativoVRVT: ativo }).where(eq(colaboradores.id, id));
}

export async function getColaboradoresSemVRVT(busca?: string) {
  // Retorna colaboradores ativos que NÃO estão na planilha VR/VT (ativoVRVT = false ou sem VR/VT)
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    eq(colaboradores.status, "ativo"),
    eq(colaboradores.ativoVRVT, false),
  ];
  if (busca) {
    conditions.push(sql`LOWER(${colaboradores.nome}) LIKE ${`%${busca.toLowerCase()}%`}`);
  }
  return db.select({
    id: colaboradores.id,
    nome: colaboradores.nome,
    setorNome: setores.nome,
    empresaNome: empresas.nome,
    valorVR: colaboradores.valorVR,
    valorVT: colaboradores.valorVT,
    ativoVRVT: colaboradores.ativoVRVT,
    vtDiasExtrasQ2: colaboradores.vtDiasExtrasQ2,
  })
  .from(colaboradores)
  .leftJoin(setores, eq(colaboradores.setorId, setores.id))
  .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
  .where(and(...conditions))
  .orderBy(empresas.nome, setores.nome, colaboradores.nome);
}

export async function getPlanilhaVRVT(
  ano: number,
  mes: number,
  empresaId?: number,
  setorId?: number
): Promise<{
  setores: PlanilhaVRVTSetor[];
  diasUteis: number;
  diasQ1: number;
  diasQ2: number;
  valorVR: number;
  feriadosDescontados: { data: string; nome: string }[];
}> {
  const db = await getDb();
  if (!db) return { setores: [], diasUteis: 0, diasQ1: 0, diasQ2: 0, valorVR: 39.52, feriadosDescontados: [] };

  // Buscar feriados ativos do mês — inclui recorrentes (qualquer ano, mesmo dia/mês) e não-recorrentes do ano exato
  const mesPad = String(mes).padStart(2, '0');
  const todosFeriados = await db.select().from(feriados).where(eq(feriados.ativo, true));
  const feriadosSet = new Set<string>(); // feriados universais (nacional, estadual, municipal sem restrição)
  const feriadosNomeMap = new Map<string, string>();
  const municipaisRestritos: { key: string; nome: string; setorIds: number[] }[] = [];
  for (let fi = 0; fi < todosFeriados.length; fi++) {
    const f = todosFeriados[fi];
    const dataFeriado = parseDateCol(f.data);
    const fAno = dataFeriado.getUTCFullYear();
    const fMes = dataFeriado.getUTCMonth() + 1;
    const fDia = dataFeriado.getUTCDate();
    const isNoMes = f.recorrente ? fMes === mes : (fAno === ano && fMes === mes);
    if (!isNoMes) continue;
    const key = `${ano}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`;
    if (f.tipo === 'municipal' && (f as any).setoresAfetados) {
      let setorIds: number[] = [];
      try { setorIds = JSON.parse((f as any).setoresAfetados); } catch { setorIds = []; }
      if (setorIds.length > 0) {
        municipaisRestritos.push({ key, nome: f.nome, setorIds });
        feriadosNomeMap.set(key, f.nome);
        continue;
      }
    }
    feriadosSet.add(key);
    feriadosNomeMap.set(key, f.nome);
  }
  const getFeriadosSetColab = (colabSetorId: number | null | undefined): Set<string> => {
    if (municipaisRestritos.length === 0) return feriadosSet;
    const s = new Set<string>(feriadosSet);
    for (let ri = 0; ri < municipaisRestritos.length; ri++) {
      const mr = municipaisRestritos[ri];
      if (colabSetorId && mr.setorIds.includes(colabSetorId)) s.add(mr.key);
    }
    return s;
  };
  const { total, diasQ1, diasQ2 } = calcularDiasUteisQuinzenas(ano, mes, feriadosSet);
  const VALOR_VR = 39.52;

  // Buscar colaboradores ativos com benefícios
  const rows = await db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      empresaId: colaboradores.empresaId,
      setorId: colaboradores.setorId,
      setorBeneficio: colaboradores.setorBeneficio,
      valorVR: colaboradores.valorVR,
      valorVT: colaboradores.valorVT,
      valorFixoQuinzenal: colaboradores.valorFixoQuinzenal,
      valorFixoQ1: colaboradores.valorFixoQ1,
      valorFixoQ2: colaboradores.valorFixoQ2,
      vtFixoQ1: colaboradores.vtFixoQ1,
      vtFixoQ2: colaboradores.vtFixoQ2,
      vtDiasExtrasQ2: colaboradores.vtDiasExtrasQ2,
      tipoDescontoVR: colaboradores.tipoDescontoVR,
      escalaDias: colaboradores.escalaDias,
      tipoRecebimentoCaju: colaboradores.tipoRecebimentoCaju,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      admissao: colaboradores.admissao,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(
      and(
        eq(colaboradores.status, "ativo"),
        eq(colaboradores.ativoVRVT, true),
        empresaId ? eq(colaboradores.empresaId, empresaId) : undefined,
        setorId ? eq(colaboradores.setorId, setorId) : undefined
      )
    )
    .orderBy(empresas.nome, setores.nome, colaboradores.nome);

    // Buscar ausências do mês para todos os colaboradores
  const ausencias = await getAusenciasDoMes(ano, mes);
  const ausenciaMap = new Map<number, number>(); // colaboradorId -> diasAusencia total
  const ausenciaManualMap = new Map<number, number>(); // colaboradorId -> dias inseridos manualmente
  for (const a of ausencias) {
    ausenciaMap.set(a.colaboradorId, a.diasAusencia);
    ausenciaManualMap.set(a.colaboradorId, a.diasAusencia);
  }

  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const inicioMesStr = `${ano}-${mesPad}-01`;
  const fimMesStr = `${ano}-${mesPad}-${String(ultimoDiaMes).padStart(2, '0')}`;

  const ausenciaFeriasMap = new Map<number, number>(); // colaboradorId -> dias de férias

  const feriasDoMes = await db
    .select({
      colaboradorId: historicoFerias.colaboradorId,
      dataSaida: historicoFerias.dataSaida,
      dataFim: historicoFerias.dataFim,
      dataRetorno: historicoFerias.dataRetorno,
    })
    .from(historicoFerias)
    .where(
      and(
        sql`${historicoFerias.dataSaida}::date <= ${fimMesStr}` as any,
        sql`COALESCE(${historicoFerias.dataFim}::date, (${historicoFerias.dataRetorno}::date - INTERVAL '1 day')) >= ${inicioMesStr}` as any,
        empresaId ? eq(historicoFerias.empresaId, empresaId) : undefined,
        setorId ? eq(historicoFerias.setorId, setorId) : undefined,
      )
    );

  for (const ferias of feriasDoMes) {
    const dataSaidaStr = toDateStrSafe(ferias.dataSaida);
    const dataFimStr = toDateStrSafe(ferias.dataFim)
      ?? (toDateStrSafe(ferias.dataRetorno) ? addDiasStr(toDateStrSafe(ferias.dataRetorno)!, -1) : null);

    if (!dataSaidaStr || !dataFimStr) continue;

    const diasUteisFeriasNoMes = calcularDiasUteisFerias(
      dataSaidaStr,
      dataFimStr,
      ano,
      mes,
      feriadosSet
    );

    if (diasUteisFeriasNoMes <= 0) continue;

    ausenciaMap.set(
      ferias.colaboradorId,
      (ausenciaMap.get(ferias.colaboradorId) ?? 0) + diasUteisFeriasNoMes
    );
    ausenciaFeriasMap.set(
      ferias.colaboradorId,
      (ausenciaFeriasMap.get(ferias.colaboradorId) ?? 0) + diasUteisFeriasNoMes
    );
  }

  // Buscar atestados de afastamento integral do mês ANTERIOR e somar às ausências
  // Regra de competência: atestado emitido no mês M desconta na planilha do mês M+1.
  // Exemplo: atestado de julho desconta na planilha de agosto.
  // Atestados de outros meses (mesmo mês, 2+ meses atrás, mês futuro) NÃO descontam.
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const mesAnteriorPad = String(mesAnterior).padStart(2, '0');
  const ultimoDiaMesAnterior = new Date(anoAnterior, mesAnterior, 0).getDate();
  const inicioMesAnteriorStr = `${anoAnterior}-${mesAnteriorPad}-01`;
  const fimMesAnteriorStr = `${anoAnterior}-${mesAnteriorPad}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`;
  const ausenciaAtestadoMap = new Map<number, number>(); // colaboradorId -> dias de atestado

  const atestadosIntegraisDoMes = await db
    .select({
      colaboradorId: atestados.colaboradorId,
      dataInicio: atestados.dataInicio,
      dataFim: atestados.dataFim,
      diasAfastamento: atestados.diasAfastamento,
      diasDescontar: atestados.diasDescontar,
      tipoAfastamento: atestados.tipoAfastamento,
    })
    .from(atestados)
    .where(
      and(
        sql`${atestados.tipoAfastamento} = 'integral'` as any,
        // Atestado deve ter sido emitido (dataInicio) no mês anterior ao mês da planilha
        sql`${atestados.dataInicio}::date >= ${inicioMesAnteriorStr}` as any,
        sql`${atestados.dataInicio}::date <= ${fimMesAnteriorStr}` as any,
        empresaId ? eq(atestados.empresaId, empresaId) : undefined,
        setorId ? eq(atestados.setorId, setorId) : undefined,
      )
    );
  for (const atest of atestadosIntegraisDoMes) {
    // Usa diasDescontar quando preenchido (ex: observação do RH indica menos dias a descontar)
    // Caso contrário, usa diasAfastamento como padrão
    const diasUteis = (atest.diasDescontar != null ? atest.diasDescontar : atest.diasAfastamento) ?? 0;
    if (diasUteis <= 0) continue;
    ausenciaMap.set(
      atest.colaboradorId,
      (ausenciaMap.get(atest.colaboradorId) ?? 0) + diasUteis
    );
    ausenciaAtestadoMap.set(
      atest.colaboradorId,
      (ausenciaAtestadoMap.get(atest.colaboradorId) ?? 0) + diasUteis
    );
  }
  // Buscar dias customizados do mês
  const diasCustom = await getDiasCustomDoMes(ano, mes);
  // Map: `${colaboradorId}_${quinzena}_${tipo}` -> dias
  const diasCustomMap = new Map<string, number>();
  for (const d of diasCustom) {
    diasCustomMap.set(`${d.colaboradorId}_${d.quinzena}_${d.tipo}`, d.dias);
  }
  // Agrupar por setor
  const setorMap = new Map<string, PlanilhaVRVTSetor>();

  for (const c of rows) {
        const vr = parseFloat(String(c.valorVR ?? "0")) || 0;
    const vt = parseFloat(String(c.valorVT ?? "0")) || 0;
    const valorFixo = parseFloat(String(c.valorFixoQuinzenal ?? "0")) || 0;
    // Valores fixos por quinzena independentes (prevalecem sobre valorFixoQuinzenal)
    const fixoQ1 = parseFloat(String(c.valorFixoQ1 ?? "0")) || 0;
    const fixoQ2 = parseFloat(String(c.valorFixoQ2 ?? "0")) || 0;
    const temFixoIndividual = fixoQ1 > 0 || fixoQ2 > 0;
    // VT fixo por quinzena (substitui cálculo por dias quando preenchido)
    const vtFixoQ1 = parseFloat(String(c.vtFixoQ1 ?? "0")) || 0;
    const vtFixoQ2 = parseFloat(String(c.vtFixoQ2 ?? "0")) || 0;
    const temVtFixo = vtFixoQ1 > 0 || vtFixoQ2 > 0;
    const vtExtrasQ2 = c.vtDiasExtrasQ2 ?? 0; // dias extras de VT na 2ª quinzena
    // Se não tem VR nem VT nem valor fixo, pula
    if (vr === 0 && vt === 0 && valorFixo === 0 && !temFixoIndividual && !temVtFixo) continue;
    // Calcular proporcional por data de admissão (admitidos no mês corrente)
    let diasEscalaQ1 = diasQ1;
    let diasEscalaQ2 = diasQ2;
    if (c.admissao) {
      const admissaoDate = parseDateCol(c.admissao);
      const admAno = admissaoDate.getUTCFullYear();
      const admMes = admissaoDate.getUTCMonth() + 1;
      const admDia = admissaoDate.getUTCDate();
      // Se foi admitido neste mês/ano, calcular apenas dias úteis a partir da admissão
      if (admAno === ano && admMes === mes && admDia > 1) {
        // Contar dias úteis do mês a partir da admissão
        const diasNoMes = new Date(ano, mes, 0).getDate();
        const diasUteisAposAdmissao: number[] = [];
        for (let d = admDia; d <= diasNoMes; d++) {
          const dow = new Date(ano, mes - 1, d).getDay();
          if (dow === 0 || dow === 6) continue; // fim de semana
          const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          if (getFeriadosSetColab(c.setorId).has(dataStr)) continue;
          diasUteisAposAdmissao.push(d);
        }
        // Q1 = dias úteis até o dia 15 (ou 10 dias, o que for menor); Q2 = restante
        const diasQ1Proporcional = diasUteisAposAdmissao.filter(d => d <= 15).length;
        const diasQ2Proporcional = diasUteisAposAdmissao.filter(d => d > 15).length;
        diasEscalaQ1 = Math.min(10, diasQ1Proporcional);
        diasEscalaQ2 = diasQ2Proporcional;
      }
    }
    // Calcular dias efetivos considerando escala personalizada do colaborador
    if (c.escalaDias) {
      // escalaDias é um JSON array de dias da semana permitidos: [0,1,3,4,5,6] = todos exceto terça
      try {
        const diasPermitidos: number[] = JSON.parse(c.escalaDias);
        const diasNoMes = new Date(ano, mes, 0).getDate();
        const todosDiasEscala: number[] = [];
        for (let d = 1; d <= diasNoMes; d++) {
          const dow = new Date(ano, mes - 1, d).getDay();
          if (!diasPermitidos.includes(dow)) continue;
          const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          if (getFeriadosSetColab(c.setorId).has(dataStr)) continue;
          todosDiasEscala.push(d);
        }
        const totalEscala = todosDiasEscala.length;
        // Q1 = sempre 10 dias (ou total se menor); Q2 = restante
        diasEscalaQ1 = Math.min(10, totalEscala);
        diasEscalaQ2 = Math.max(0, totalEscala - diasEscalaQ1);
      } catch {}
    }
    // Descontar dias de ausência — distribuir proporcionalmente entre Q1 e Q2
    const diasAusencia = ausenciaMap.get(c.id) ?? 0;
    // Desconta primeiro da Q2 (segunda quinzena), depois da Q1 se necessário
    const ausenciaQ2 = Math.min(diasAusencia, diasEscalaQ2);
    const ausenciaQ1 = Math.min(diasAusencia - ausenciaQ2, diasEscalaQ1);
    let diasEfetivosQ1 = Math.max(0, diasEscalaQ1 - ausenciaQ1);
    let diasEfetivosQ2 = Math.max(0, diasEscalaQ2 - ausenciaQ2);
    // Override de dias customizados (editados manualmente pelo usuário)
    const customVrQ1 = diasCustomMap.get(`${c.id}_Q1_VR`);
    const customVrQ2 = diasCustomMap.get(`${c.id}_Q2_VR`);
    const customVtQ1 = diasCustomMap.get(`${c.id}_Q1_VT`);
    const customVtQ2 = diasCustomMap.get(`${c.id}_Q2_VT`);
    if (customVrQ1 !== undefined) diasEfetivosQ1 = customVrQ1;
    if (customVrQ2 !== undefined) diasEfetivosQ2 = customVrQ2;
    // Dias de VT na Q2 incluem os dias extras configurados por colaborador
    // Se há override manual (customVtQ2), ele representa o valor final — não somar vtExtrasQ2
    const diasVtEfetivosQ2 = customVtQ2 !== undefined ? customVtQ2 : (diasEfetivosQ2 + vtExtrasQ2);
    const diasVtEfetivosQ1 = customVtQ1 !== undefined ? customVtQ1 : diasEfetivosQ1;
    let vrQ1: number, vrQ2: number, vtQ1: number, vtQ2: number;
    if (temFixoIndividual) {
      // Valores fixos independentes por quinzena (ex: Beatriz Rabelo — só Q1)
      const propQ1 = diasQ1 > 0 ? diasEfetivosQ1 / diasQ1 : 1;
      const propQ2 = diasQ2 > 0 ? diasEfetivosQ2 / diasQ2 : 1;
      vrQ1 = parseFloat((fixoQ1 * propQ1).toFixed(2));
      vrQ2 = parseFloat((fixoQ2 * propQ2).toFixed(2));
      vtQ1 = 0;
      vtQ2 = 0;
    } else if (valorFixo > 0) {
      // Valor fixo igual nas duas quinzenas
      const propQ1 = diasQ1 > 0 ? diasEfetivosQ1 / diasQ1 : 1;
      const propQ2 = diasQ2 > 0 ? diasEfetivosQ2 / diasQ2 : 1;
      vrQ1 = parseFloat((valorFixo * propQ1).toFixed(2));
      vrQ2 = parseFloat((valorFixo * propQ2).toFixed(2));
      vtQ1 = 0;
      vtQ2 = 0;
    } else {
      vrQ1 = vr > 0 ? parseFloat((vr * diasEfetivosQ1).toFixed(2)) : 0;
      vrQ2 = vr > 0 ? parseFloat((vr * diasEfetivosQ2).toFixed(2)) : 0;
      // VT: usa valor fixo por quinzena se configurado, senão calcula por dias
      if (temVtFixo) {
        // VT fixo independente (ex: Beatriz Rabelo — R$223,20 só na Q1)
        vtQ1 = vtFixoQ1;
        vtQ2 = vtFixoQ2;
      } else {
        vtQ1 = vt > 0 ? parseFloat((vt * diasVtEfetivosQ1).toFixed(2)) : 0;
        vtQ2 = vt > 0 ? parseFloat((vt * diasVtEfetivosQ2).toFixed(2)) : 0; // usa dias extras de VT
      }
    }
    const totalQ1 = parseFloat((vrQ1 + vtQ1).toFixed(2));
    const totalQ2 = parseFloat((vrQ2 + vtQ2).toFixed(2));
    const geralVR = parseFloat((vrQ1 + vrQ2).toFixed(2));
    // Desconto VR conforme tipo do colaborador
    const tipoDesc = c.tipoDescontoVR ?? 'pct10';
    let descontoVR = 0;
    if (tipoDesc === 'zero') {
      descontoVR = 0;
    } else if (tipoDesc === 'fixo1') {
      descontoVR = geralVR > 0 ? 1.0 : 0;
    } else {
      // pct10 — 10% do total VR do mês
      descontoVR = parseFloat((geralVR * 0.1).toFixed(2));
    }
    const geralVT = parseFloat((vtQ1 + vtQ2).toFixed(2));
    const totalGeral = parseFloat((geralVR + geralVT).toFixed(2));

    const setorKey = `${c.empresaId ?? 0}_${c.setorId ?? 0}`;
    if (!setorMap.has(setorKey)) {
      setorMap.set(setorKey, {
        setorId: c.setorId,
        setorNome: c.setorNome ?? "Sem Setor",
        empresaId: c.empresaId,
        empresaNome: c.empresaNome ?? "Sem Empresa",
        colaboradores: [],
        totalVrQ1: 0, totalVtQ1: 0, totalQ1: 0,
        totalVrQ2: 0, totalVtQ2: 0, totalQ2: 0,
        totalGeralVR: 0, totalDescontoVR: 0, totalGeralVT: 0, totalGeral: 0,
        totalAuxilioVeiculo: 0,
      });
    }

    const setor = setorMap.get(setorKey)!;
    setor.colaboradores.push({
      id: c.id,
      nome: c.nome,
      setorNome: c.setorNome ?? "Sem Setor",
      setorBeneficio: c.setorBeneficio,
      empresaNome: c.empresaNome ?? "Sem Empresa",
      valorVR: vr,
      valorVT: vt,
      valorFixoQuinzenal: valorFixo,
      diasAusencia,
      ausenciaDetalhe: {
        ferias: ausenciaFeriasMap.get(c.id) ?? 0,
        atestado: ausenciaAtestadoMap.get(c.id) ?? 0,
        manual: ausenciaManualMap.get(c.id) ?? 0,
      },
      diasVrQ1: vr > 0 ? diasEfetivosQ1 : 0,
      diasVtQ1: vt > 0 ? diasVtEfetivosQ1 : 0,
      totalVrQ1: vrQ1,
      totalVtQ1: vtQ1,
      totalQ1,
      diasVrQ2: vr > 0 ? diasEfetivosQ2 : 0,
      diasVtQ2: vt > 0 ? diasVtEfetivosQ2 : 0,
      totalVrQ2: vrQ2,
      totalVtQ2: vtQ2,
      totalQ2,
      geralVR,
      descontoVR,
      tipoDescontoVR: tipoDesc,
      tipoRecebimentoCaju: c.tipoRecebimentoCaju ?? null,
      vtFixoQ1: vtFixoQ1 > 0 ? vtFixoQ1 : undefined,
      vtFixoQ2: vtFixoQ2 > 0 ? vtFixoQ2 : undefined,
      geralVT,
      totalGeral,
    });

    if (temVtFixo) {
      // Auxílio Veículo: acumula separado, NÃO entra nos totais normais de VT
      setor.totalAuxilioVeiculo = parseFloat((setor.totalAuxilioVeiculo + geralVT).toFixed(2));
      // VR ainda entra normalmente (colaborador pode ter VR)
      setor.totalVrQ1 = parseFloat((setor.totalVrQ1 + vrQ1).toFixed(2));
      setor.totalQ1 = parseFloat((setor.totalQ1 + vrQ1).toFixed(2));
      setor.totalVrQ2 = parseFloat((setor.totalVrQ2 + vrQ2).toFixed(2));
      setor.totalQ2 = parseFloat((setor.totalQ2 + vrQ2).toFixed(2));
      setor.totalGeralVR = parseFloat((setor.totalGeralVR + geralVR).toFixed(2));
      setor.totalDescontoVR = parseFloat((setor.totalDescontoVR + descontoVR).toFixed(2));
      // totalGeral do setor NÃO inclui o VT de auxílio veículo
      setor.totalGeral = parseFloat((setor.totalGeral + geralVR).toFixed(2));
    } else {
      setor.totalVrQ1 = parseFloat((setor.totalVrQ1 + vrQ1).toFixed(2));
      setor.totalVtQ1 = parseFloat((setor.totalVtQ1 + vtQ1).toFixed(2));
      setor.totalQ1 = parseFloat((setor.totalQ1 + totalQ1).toFixed(2));
      setor.totalVrQ2 = parseFloat((setor.totalVrQ2 + vrQ2).toFixed(2));
      setor.totalVtQ2 = parseFloat((setor.totalVtQ2 + vtQ2).toFixed(2));
      setor.totalQ2 = parseFloat((setor.totalQ2 + totalQ2).toFixed(2));
      setor.totalGeralVR = parseFloat((setor.totalGeralVR + geralVR).toFixed(2));
      setor.totalDescontoVR = parseFloat((setor.totalDescontoVR + descontoVR).toFixed(2));
      setor.totalGeralVT = parseFloat((setor.totalGeralVT + geralVT).toFixed(2));
      setor.totalGeral = parseFloat((setor.totalGeral + totalGeral).toFixed(2));
    }
  }

  // Montar lista de feriados que foram realmente descontados (caem em dias de semana)
  const feriadosDescontados: { data: string; nome: string }[] = [];
  Array.from(feriadosSet).forEach((dataStr) => {
    const d = new Date(dataStr + 'T12:00:00Z');
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      feriadosDescontados.push({ data: dataStr, nome: feriadosNomeMap.get(dataStr) || dataStr });
    }
  });
  feriadosDescontados.sort((a, b) => a.data.localeCompare(b.data));
  return {
    setores: Array.from(setorMap.values()),
    diasUteis: total,
    diasQ1,
    diasQ2,
    valorVR: VALOR_VR,
    feriadosDescontados,
  };
}

// ─── Feriados ─────────────────────────────────────────────────────────────────

export async function getFeriados(ano?: number): Promise<Feriado[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(feriados).orderBy(asc(feriados.data));
  if (!ano) return rows;
  // Filtrar: retorna recorrentes (qualquer ano) + não-recorrentes do ano solicitado
  return rows.filter(f => {
    const dataF = parseDateCol(f.data);
    const fAno = dataF.getUTCFullYear();
    return f.recorrente || fAno === ano;
  });
}

export async function createFeriado(data: InsertFeriado): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(feriados).values(data).returning({ id: feriados.id });
  return { id: result[0]?.id ?? 0 };
}

export async function updateFeriado(id: number, data: Partial<InsertFeriado>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(feriados).set(data).where(eq(feriados.id, id));
}

export async function deleteFeriado(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(feriados).where(eq(feriados.id, id));
}

export async function getFeriadosDoMes(ano: number, mes: number): Promise<string[]> {
  // Retorna lista de strings "YYYY-MM-DD" dos feriados ativos do mês
  const todos = await getFeriados();
  const result: string[] = [];
  for (const f of todos) {
    if (!f.ativo) continue;
    const dataF = parseDateCol(f.data);
    const fMes = dataF.getUTCMonth() + 1;
    const fDia = dataF.getUTCDate();
    const fAno = dataF.getUTCFullYear();
    if (f.recorrente && fMes === mes) {
      result.push(`${ano}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`);
    } else if (!f.recorrente && fAno === ano && fMes === mes) {
      result.push(`${ano}-${String(fMes).padStart(2, '0')}-${String(fDia).padStart(2, '0')}`);
    }
  }
  return result;
}

// ─── Ausências VR/VT ──────────────────────────────────────────────────────────

export async function getAusenciasDoMes(ano: number, mes: number): Promise<AusenciaVRVT[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ausenciasVRVT)
    .where(and(eq(ausenciasVRVT.ano, ano), eq(ausenciasVRVT.mes, mes)));
}

export async function upsertAusencia(
  colaboradorId: number,
  ano: number,
  mes: number,
  diasAusencia: number,
  observacao?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Verificar se já existe
  const existing = await db
    .select()
    .from(ausenciasVRVT)
    .where(
      and(
        eq(ausenciasVRVT.colaboradorId, colaboradorId),
        eq(ausenciasVRVT.ano, ano),
        eq(ausenciasVRVT.mes, mes)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    if (diasAusencia === 0 && !observacao) {
      // Remover registro se zerado sem observação
      await db
        .delete(ausenciasVRVT)
        .where(eq(ausenciasVRVT.id, existing[0].id));
    } else {
      await db
        .update(ausenciasVRVT)
        .set({ diasAusencia, observacao: observacao ?? null })
        .where(eq(ausenciasVRVT.id, existing[0].id));
    }
  } else if (diasAusencia > 0 || observacao) {
    await db.insert(ausenciasVRVT).values({
      colaboradorId,
      ano,
      mes,
      diasAusencia,
      observacao: observacao ?? null,
    });
  }
}

// ─── Dias Customizados VR/VT ─────────────────────────────────────────────────

export async function getDiasCustomDoMes(
  ano: number,
  mes: number
): Promise<{ colaboradorId: number; quinzena: "Q1" | "Q2"; tipo: "VR" | "VT"; dias: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      colaboradorId: diasCustomVRVT.colaboradorId,
      quinzena: diasCustomVRVT.quinzena,
      tipo: diasCustomVRVT.tipo,
      dias: diasCustomVRVT.dias,
    })
    .from(diasCustomVRVT)
    .where(and(eq(diasCustomVRVT.ano, ano), eq(diasCustomVRVT.mes, mes)));
}

export async function upsertDiasCustomVRVT(
  colaboradorId: number,
  ano: number,
  mes: number,
  quinzena: "Q1" | "Q2",
  tipo: "VR" | "VT",
  dias: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(diasCustomVRVT)
    .where(
      and(
        eq(diasCustomVRVT.colaboradorId, colaboradorId),
        eq(diasCustomVRVT.ano, ano),
        eq(diasCustomVRVT.mes, mes),
        eq(diasCustomVRVT.quinzena, quinzena),
        eq(diasCustomVRVT.tipo, tipo)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(diasCustomVRVT)
      .set({ dias })
      .where(eq(diasCustomVRVT.id, existing[0].id));
  } else {
    await db.insert(diasCustomVRVT).values({ colaboradorId, ano, mes, quinzena, tipo, dias });
  }
}

// ─── Controle de Meses Gerados (Planilha VR/VT) ───────────────────────────────

/** Verifica se um mês já foi gerado na planilha VR/VT */
export async function isMesGerado(ano: number, mes: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: planilhasGeradas.id })
    .from(planilhasGeradas)
    .where(and(eq(planilhasGeradas.ano, ano), eq(planilhasGeradas.mes, mes)))
    .limit(1);
  return rows.length > 0;
}

/** Marca um mês como gerado */
export async function marcarMesGerado(ano: number, mes: number, userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Evita duplicatas
  const exists = await isMesGerado(ano, mes);
  if (exists) return;
  await db.insert(planilhasGeradas).values({ ano, mes, geradoPor: userId ?? null });
}

/** Lista todos os meses gerados */
export async function getMesesGerados(): Promise<{ ano: number; mes: number }[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({ ano: planilhasGeradas.ano, mes: planilhasGeradas.mes })
    .from(planilhasGeradas)
    .orderBy(planilhasGeradas.ano, planilhasGeradas.mes);
}

/** Remove um mês gerado (apaga a planilha e todos os dias customizados do mês) */
export async function deletarMesGerado(ano: number, mes: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Remove dias customizados do mês
  await db.delete(diasCustomVRVT).where(and(eq(diasCustomVRVT.ano, ano), eq(diasCustomVRVT.mes, mes)));
  // Remove o registro da planilha gerada
  await db.delete(planilhasGeradas).where(and(eq(planilhasGeradas.ano, ano), eq(planilhasGeradas.mes, mes)));
}

// ─── Exames Periódicos ────────────────────────────────────────────────────────

export interface ExamePeriodicoRow {
  colaboradorId: number;
  colaboradorNome: string;
  empresaId: number;
  empresaNome: string;
  setorId: number | null;
  setorNome: string | null;
  status: string | null;
  exameId: number | null;
  realizou: boolean;
  dataExame: string | null; // "YYYY-MM-DD"
  observacoes: string | null;
  enviadoContabilidade: boolean;
  dataEnvioContabilidade: string | null; // "YYYY-MM-DD"
  admissao: string | null; // "YYYY-MM-DD"
  proximoExame: string | null; // "YYYY-MM-DD" — próximo aniversário de admissão sem exame registrado
  diasParaProximoExame: number | null; // negativo = vencido
  statusExame: "ok" | "vencido" | "a_vencer" | "sem_admissao"; // calculado
}

/** Lista todos os colaboradores ativos com seu status de exame periódico no ano informado */
export async function getExamesPeriodicos(ano: number): Promise<ExamePeriodicoRow[]> {
  const db = await getDb();
  if (!db) return [];

  const colabs = await db
    .select({
      colaboradorId: colaboradores.id,
      colaboradorNome: colaboradores.nome,
      empresaId: colaboradores.empresaId,
      empresaNome: empresas.nome,
      setorId: colaboradores.setorId,
      setorNome: setores.nome,
      status: colaboradores.status,
      admissao: colaboradores.admissao,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(eq(colaboradores.status, "ativo"), eq(colaboradores.examePeriodicoIsento, false)))
    .orderBy(asc(empresas.nome), asc(setores.nome), asc(colaboradores.nome));

  const exames = await db
    .select()
    .from(examesPeriodicos)
    .where(eq(examesPeriodicos.ano, ano));

    const exameMap = new Map(exames.map(e => [e.colaboradorId, e]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return colabs.map(c => {
    const exame = exameMap.get(c.colaboradorId);

    // Calcular próximo exame por aniversário de admissão
    let admissaoStr: string | null = null;
    let proximoExame: string | null = null;
    let diasParaProximoExame: number | null = null;
    let statusExame: "ok" | "vencido" | "a_vencer" | "sem_admissao" = "sem_admissao";

    if (c.admissao) {
      const admissaoDate = parseDateCol(c.admissao);
      admissaoStr = admissaoDate.toISOString().substring(0, 10);
      const anoAtual = hoje.getFullYear();
      let proximaData = new Date(admissaoDate);
      proximaData.setFullYear(anoAtual);
      if (proximaData < hoje) proximaData.setFullYear(anoAtual + 1);
      proximoExame = proximaData.toISOString().substring(0, 10);
      const diffMs = proximaData.getTime() - hoje.getTime();
      diasParaProximoExame = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (exame?.realizou) {
        statusExame = "ok";
      } else if (diasParaProximoExame <= 0) {
        statusExame = "vencido";
      } else if (diasParaProximoExame <= 30) {
        statusExame = "a_vencer";
      } else {
        statusExame = "ok";
      }
    }

    return {
      colaboradorId: c.colaboradorId,
      colaboradorNome: c.colaboradorNome,
      empresaId: c.empresaId ?? 0,
      empresaNome: c.empresaNome ?? "",
      setorId: c.setorId ?? null,
      setorNome: c.setorNome ?? null,
      status: c.status,
      exameId: exame?.id ?? null,
      realizou: exame?.realizou ?? false,
      dataExame: exame?.dataExame ? String(exame.dataExame).substring(0, 10) : null,
      observacoes: exame?.observacoes ?? null,
      enviadoContabilidade: exame?.enviadoContabilidade ?? false,
      dataEnvioContabilidade: exame?.dataEnvioContabilidade ? String(exame.dataEnvioContabilidade).substring(0, 10) : null,
      admissao: admissaoStr,
      proximoExame,
      diasParaProximoExame,
      statusExame,
    };
  });
}

/** Cria ou atualiza o registro de exame periódico de um colaborador */
export async function upsertExamePeriodico(
  colaboradorId: number,
  ano: number,
  realizou: boolean,
  dataExame: string | null,
  observacoes?: string,
  enviadoContabilidade?: boolean,
  dataEnvioContabilidade?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ id: examesPeriodicos.id })
    .from(examesPeriodicos)
    .where(and(eq(examesPeriodicos.colaboradorId, colaboradorId), eq(examesPeriodicos.ano, ano)));

  if (existing.length > 0) {
    await db
      .update(examesPeriodicos)
      .set({
        realizou,
        dataExame: dataExame ? (dataExame as any) : null,
        observacoes: observacoes ?? null,
        enviadoContabilidade: enviadoContabilidade ?? false,
        dataEnvioContabilidade: dataEnvioContabilidade ? (dataEnvioContabilidade as any) : null,
      })
      .where(and(eq(examesPeriodicos.colaboradorId, colaboradorId), eq(examesPeriodicos.ano, ano)));
  } else {
    await db.insert(examesPeriodicos).values({
      colaboradorId,
      ano,
      realizou,
      dataExame: dataExame ? (dataExame as any) : null,
      observacoes: observacoes ?? null,
      enviadoContabilidade: enviadoContabilidade ?? false,
      dataEnvioContabilidade: dataEnvioContabilidade ? (dataEnvioContabilidade as any) : null,
    });
  }
}

// ─── Plano de Saúde ──────────────────────────────────────────────────────────

export async function getPlanoSaude(params: {
  empresa?: string;
  tipo?: string;
  busca?: string;
  mesReferencia?: number;
  anoReferencia?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const { empresa, tipo, busca, mesReferencia = 7, anoReferencia = 2026 } = params;
  const { like } = await import("drizzle-orm");

  const conditions: any[] = [
    eq(planoSaude.ativo, true),
    eq(planoSaude.mesReferencia, mesReferencia),
    eq(planoSaude.anoReferencia, anoReferencia),
  ];

  if (empresa) conditions.push(eq(planoSaude.empresa, empresa as any));
  if (tipo) conditions.push(eq(planoSaude.tipo, tipo as any));
  if (busca) {
    const term = `%${busca}%`;
    conditions.push(or(
      like(planoSaude.nome, term),
      like(planoSaude.numeroBeneficiario, term),
      like(planoSaude.cpf, term),
    ));
  }

  const rows = await db
    .select()
    .from(planoSaude)
    .where(and(...conditions))
    .orderBy(planoSaude.empresa, planoSaude.nome);

  return rows.map((r) => ({
    ...r,
    mensalidade: Number(r.mensalidade),
    totalFamilia: r.totalFamilia != null ? Number(r.totalFamilia) : null,
    titularNumeroBeneficiario: r.titularNumeroBeneficiario ?? null,
  }));
}

export async function getPlanoSaudeResumo(mesReferencia: number, anoReferencia: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      empresa: planoSaude.empresa,
      tipo: planoSaude.tipo,
      total: count(),
      totalMensalidade: sum(planoSaude.mensalidade),
    })
    .from(planoSaude)
    .where(and(
      eq(planoSaude.ativo, true),
      eq(planoSaude.mesReferencia, mesReferencia),
      eq(planoSaude.anoReferencia, anoReferencia),
    ))
    .groupBy(planoSaude.empresa, planoSaude.tipo);

  return rows.map((r) => ({
    ...r,
    totalMensalidade: Number(r.totalMensalidade ?? 0),
  }));
}

// ─── Tabela de Preços AMIL ────────────────────────────────────────────────────

export async function getTabelaPrecos(empresa?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (empresa) conditions.push(eq(tabelaPrecos.empresa, empresa as any));
  const rows = await db
    .select()
    .from(tabelaPrecos)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(tabelaPrecos.empresa), asc(tabelaPrecos.codigoPlano), asc(tabelaPrecos.faixaInicio));
  return rows.map((r) => ({
    ...r,
    valorTitular: Number(r.valorTitular),
    valorDependente: Number(r.valorDependente),
  }));
}

export async function getValorPorFaixaEtaria(empresa: string, codigoPlano: string, idade: number): Promise<{ valorTitular: number; valorDependente: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(tabelaPrecos)
    .where(
      and(
        eq(tabelaPrecos.empresa, empresa as any),
        eq(tabelaPrecos.codigoPlano, codigoPlano),
        lte(tabelaPrecos.faixaInicio, idade),
        gte(tabelaPrecos.faixaFim, idade),
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  return {
    valorTitular: Number(rows[0].valorTitular),
    valorDependente: Number(rows[0].valorDependente),
  };
}

// ─── Coparticipação Plano de Saúde ───────────────────────────────────────────

export async function getCoparticipacao(params: {
  empresa?: string;
  mes?: number;
  ano?: number;
  numeroBeneficiario?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const { empresa, mes, ano, numeroBeneficiario } = params;
  const conditions: any[] = [];
  if (empresa) conditions.push(eq(coparticipacaoPlanoSaude.empresa, empresa as any));
  if (mes) conditions.push(eq(coparticipacaoPlanoSaude.mes, mes));
  if (ano) conditions.push(eq(coparticipacaoPlanoSaude.ano, ano));
  if (numeroBeneficiario) conditions.push(eq(coparticipacaoPlanoSaude.numeroBeneficiario, numeroBeneficiario));
  const rows = await db
    .select()
    .from(coparticipacaoPlanoSaude)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(coparticipacaoPlanoSaude.empresa, coparticipacaoPlanoSaude.nomeBeneficiario, coparticipacaoPlanoSaude.ano, coparticipacaoPlanoSaude.mes);
  return rows.map((r) => ({
    ...r,
    valor: Number(r.valor),
  }));
}

export async function getCoparticipacaoResumo(params: {
  mes?: number;
  ano?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const { mes, ano } = params;
  const conditions: any[] = [];
  if (mes) conditions.push(eq(coparticipacaoPlanoSaude.mes, mes));
  if (ano) conditions.push(eq(coparticipacaoPlanoSaude.ano, ano));
  const rows = await db
    .select({
      empresa: coparticipacaoPlanoSaude.empresa,
      totalValor: sum(coparticipacaoPlanoSaude.valor),
      totalLancamentos: count(),
    })
    .from(coparticipacaoPlanoSaude)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(coparticipacaoPlanoSaude.empresa);
  return rows.map((r) => ({
    ...r,
    totalValor: Number(r.totalValor ?? 0),
    totalLancamentos: Number(r.totalLancamentos ?? 0),
  }));
}

export async function createCoparticipacao(data: {
  numeroBeneficiario: string;
  empresa: string;
  nomeBeneficiario: string;
  tipoBeneficiario: "T" | "D";
  mes: number;
  ano: number;
  valor: number;
  observacao?: string;
  createdByUserId?: number;
  createdByNome?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(coparticipacaoPlanoSaude).values({
    numeroBeneficiario: data.numeroBeneficiario,
    empresa: data.empresa as any,
    nomeBeneficiario: data.nomeBeneficiario,
    tipoBeneficiario: data.tipoBeneficiario,
    mes: data.mes,
    ano: data.ano,
    valor: String(data.valor),
    observacao: data.observacao ?? null,
    createdByUserId: data.createdByUserId ?? null,
    createdByNome: data.createdByNome ?? null,
  }).returning({ id: coparticipacaoPlanoSaude.id });
  return result[0]?.id ?? 0;
}

export async function updateCoparticipacao(id: number, data: {
  valor?: number;
  observacao?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updateData: any = {};
  if (data.valor !== undefined) updateData.valor = String(data.valor);
  if (data.observacao !== undefined) updateData.observacao = data.observacao;
  await db.update(coparticipacaoPlanoSaude).set(updateData).where(eq(coparticipacaoPlanoSaude.id, id));
}

export async function deleteCoparticipacao(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(coparticipacaoPlanoSaude).where(eq(coparticipacaoPlanoSaude.id, id));
}

// ─── Plano de Saúde: CRUD de beneficiários ────────────────────────────────────

export async function createPlanoSaude(data: {
  empresa: "FREIRE" | "JOANES" | "SUDOESTE" | "SOLAR";
  numeroBeneficiario: string;
  nome: string;
  cpf?: string;
  dataNascimento?: string; // YYYY-MM-DD
  idade: number;
  plano: string;
  tipo: "T" | "D";
  tipoDepend?: "Filho/Filha" | "Conjuge" | "Agregado" | "";
  mensalidade: number;
  matriculaFuncional?: string;
  colaboradorId?: number;
  titularNumeroBeneficiario?: string;
  mesReferencia: number;
  anoReferencia: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(planoSaude).values({
    empresa: data.empresa,
    numeroBeneficiario: data.numeroBeneficiario,
    nome: data.nome,
    cpf: data.cpf ?? null,
    dataNascimento: data.dataNascimento ?? null,
    idade: data.idade,
    plano: data.plano,
    tipo: data.tipo,
    tipoDepend: (data.tipoDepend ?? "") as any,
    mensalidade: String(data.mensalidade),
    matriculaFuncional: data.matriculaFuncional ?? null,
    colaboradorId: data.colaboradorId ?? null,
    titularNumeroBeneficiario: data.titularNumeroBeneficiario ?? null,
    mesReferencia: data.mesReferencia,
    anoReferencia: data.anoReferencia,
    ativo: true,
  }).returning({ id: planoSaude.id });
  return result[0]?.id ?? 0;
}

export async function updatePlanoSaude(id: number, data: {
  nome?: string;
  cpf?: string;
  dataNascimento?: string;
  idade?: number;
  plano?: string;
  tipo?: "T" | "D";
  tipoDepend?: "Filho/Filha" | "Conjuge" | "Agregado" | "";
  mensalidade?: number;
  matriculaFuncional?: string;
  titularNumeroBeneficiario?: string;
  ativo?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const upd: any = { updatedAt: new Date() };
  if (data.nome !== undefined) upd.nome = data.nome;
  if (data.cpf !== undefined) upd.cpf = data.cpf;
  if (data.dataNascimento !== undefined) upd.dataNascimento = data.dataNascimento;
  if (data.idade !== undefined) upd.idade = data.idade;
  if (data.plano !== undefined) upd.plano = data.plano;
  if (data.tipo !== undefined) upd.tipo = data.tipo;
  if (data.tipoDepend !== undefined) upd.tipoDepend = data.tipoDepend;
  if (data.mensalidade !== undefined) upd.mensalidade = String(data.mensalidade);
  if (data.matriculaFuncional !== undefined) upd.matriculaFuncional = data.matriculaFuncional;
  if (data.titularNumeroBeneficiario !== undefined) upd.titularNumeroBeneficiario = data.titularNumeroBeneficiario;
  if (data.ativo !== undefined) upd.ativo = data.ativo;
  await db.update(planoSaude).set(upd).where(eq(planoSaude.id, id));
}

export async function deletePlanoSaude(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(planoSaude).where(eq(planoSaude.id, id));
}

// Gera o próximo número de beneficiário disponível para uma empresa
export async function getProximoNumeroBeneficiario(empresa: string): Promise<string> {
  const db = await getDb();
  if (!db) return "0001";
  const rows = await db
    .select({ num: planoSaude.numeroBeneficiario })
    .from(planoSaude)
    .where(eq(planoSaude.empresa, empresa as any))
    .orderBy(desc(planoSaude.id))
    .limit(50);
  // Tenta extrair o maior número inteiro dos beneficiários existentes
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.num.replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1).padStart(4, "0");
}

// ─── Folha do Mês ─────────────────────────────────────────────────────────────

// Código do plano base (Prata QC = enfermaria) — subsídio de 70% é sempre calculado sobre este plano
const PLANO_BASE_CODIGO = "967067"; // PRATA QC COPART TP

/**
 * Calcula o desconto de plano de saúde de um titular para a folha do mês.
 * Regras:
 * - Empresa subsidia 70% do valor do Prata QC (plano base) na faixa etária do titular
 * - Se o titular tem plano superior: desconto = mensalidade_titular - 70% do Prata QC
 * - Se o titular tem o próprio Prata QC: desconto = 30% do Prata QC
 * - Exceção: se o colaborador tem subsidio70PorcentoPlanoSuperior, desconta apenas 30% do plano que tem
 * - Dependentes: 100% da mensalidade de cada dependente
 */
async function calcularDescontoPlanoSaude(
  db: ReturnType<typeof drizzle>,
  empresa: string,
  colaboradorId: number | null,
  titularNumeroBeneficiario: string,
  mes: number,
  ano: number
): Promise<{
  descontoPlanoSaude: number;
  planoTitular: string;
  mensalidadeTitular: number;
  valorBasePlano: number;
  subsidioEmpresa: number;
  totalDependentes: number;
  temExcecao: boolean;
}> {
  const zero = { descontoPlanoSaude: 0, planoTitular: "", mensalidadeTitular: 0, valorBasePlano: 0, subsidioEmpresa: 0, totalDependentes: 0, temExcecao: false };

  // Buscar o titular
  const titulares = await db
    .select()
    .from(planoSaude)
    .where(and(
      eq(planoSaude.numeroBeneficiario, titularNumeroBeneficiario),
      eq(planoSaude.empresa, empresa as any),
      eq(planoSaude.tipo, "T"),
      eq(planoSaude.ativo, true),
    ))
    .limit(1);

  if (titulares.length === 0) return zero;
  const titular = titulares[0];

  // Buscar dependentes do titular
  const dependentes = await db
    .select()
    .from(planoSaude)
    .where(and(
      eq(planoSaude.titularNumeroBeneficiario, titularNumeroBeneficiario),
      eq(planoSaude.empresa, empresa as any),
      eq(planoSaude.tipo, "D"),
      eq(planoSaude.ativo, true),
    ));

  // Verificar se há exceção de subsídio 70% no plano superior para este colaborador/mês
  // BUG FIX: filtrar também por empresa para não aplicar exceção de outra empresa
  let temExcecao = false;
  if (colaboradorId) {
    const excecoes = await db
      .select()
      .from(folhaMesExcecoes)
      .where(and(
        eq(folhaMesExcecoes.colaboradorId, colaboradorId),
        eq(folhaMesExcecoes.empresa, empresa as any),
      ))
      .limit(10);

    for (const exc of excecoes) {
      const inicioOk = !exc.mesInicio || !exc.anoInicio ||
        (ano > exc.anoInicio) || (ano === exc.anoInicio && mes >= exc.mesInicio);
      const fimOk = !exc.mesFim || !exc.anoFim ||
        (ano < exc.anoFim) || (ano === exc.anoFim && mes <= exc.mesFim);
      if (inicioOk && fimOk) { temExcecao = true; break; }
    }
  }

  // Buscar o valor do plano base (Prata QC) para a faixa etária do titular
  // BUG FIX: calcular idade atual a partir de dataNascimento (campo estático 'idade' pode estar desatualizado)
  let idadeTitular = titular.idade ?? 0;
  if (titular.dataNascimento) {
    const hoje = new Date();
    const nasc = new Date(titular.dataNascimento);
    const idadeCalculada = hoje.getFullYear() - nasc.getFullYear()
      - (hoje.getMonth() < nasc.getMonth() ||
        (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate()) ? 1 : 0);
    if (idadeCalculada > 0) idadeTitular = idadeCalculada;
  }
  const precosBase = await db
    .select()
    .from(tabelaPrecos)
    .where(and(
      eq(tabelaPrecos.empresa, empresa as any),
      eq(tabelaPrecos.codigoPlano, PLANO_BASE_CODIGO),
      lte(tabelaPrecos.faixaInicio, idadeTitular),
      gte(tabelaPrecos.faixaFim, idadeTitular),
    ))
    .limit(1);

  const mensalidadeTitular = parseFloat(String(titular.mensalidade ?? 0));
  const totalDependentes = dependentes.reduce((acc, d) => acc + parseFloat(String(d.mensalidade ?? 0)), 0);

  let valorBasePlano = 0;
  let subsidioEmpresa = 0;
  let descontoTitular = 0;

  if (precosBase.length > 0) {
    valorBasePlano = parseFloat(String(precosBase[0].valorTitular));
    subsidioEmpresa = parseFloat((valorBasePlano * 0.7).toFixed(2));

    if (temExcecao) {
      // Exceção: empresa subsidia 70% do plano que o colaborador tem (não apenas o base)
      subsidioEmpresa = parseFloat((mensalidadeTitular * 0.7).toFixed(2));
      descontoTitular = parseFloat((mensalidadeTitular * 0.3).toFixed(2));
    } else {
      // Regra padrão: desconto = mensalidade_titular - subsidio (70% do Prata QC)
      descontoTitular = parseFloat(Math.max(0, mensalidadeTitular - subsidioEmpresa).toFixed(2));
    }
  } else {
    // Sem tabela de preços: cobra 30% da mensalidade
    descontoTitular = parseFloat((mensalidadeTitular * 0.3).toFixed(2));
  }

  const descontoPlanoSaude = parseFloat((descontoTitular + totalDependentes).toFixed(2));

  return {
    descontoPlanoSaude,
    planoTitular: titular.plano,
    mensalidadeTitular,
    valorBasePlano,
    subsidioEmpresa,
    totalDependentes,
    temExcecao,
  };
}

/**
 * Gera (ou atualiza) a folha do mês para TODOS os colaboradores ativos de uma empresa.
 * Inclui descontos de VR, Plano de Saúde e Seguro de Vida.
 * Colaboradores sem desconto aparecem com R$ 0,00 em cada coluna.
 */
export async function gerarFolhaMes(
  mes: number,
  ano: number,
  empresa: string,
  diasUteis: number,
  userId: number,
  userName: string
): Promise<{ gerados: number; erros: number }> {
  const db = await getDb();
  if (!db) return { gerados: 0, erros: 0 };

  // 1. Buscar TODOS os colaboradores ativos da empresa (via join com empresas)
  const todosColabs = await db
    .select({
      id: colaboradores.id,
      nome: colaboradores.nome,
      empresaNome: empresas.nome,
      setorNome: setores.nome,
      tipoDescontoVR: colaboradores.tipoDescontoVR,
      temSeguroVida: colaboradores.temSeguroVida,
      valorSeguroVida: colaboradores.valorSeguroVida,
    })
    .from(colaboradores)
    .leftJoin(empresas, eq(colaboradores.empresaId, empresas.id))
    .leftJoin(setores, eq(colaboradores.setorId, setores.id))
    .where(and(
      eq(colaboradores.status, "ativo"),
      // Filtrar pela empresa pelo nome (FREIRE, JOANES, SUDOESTE, SOLAR)
    ))
    .orderBy(asc(colaboradores.nome));

  // Filtrar pela empresa pelo nome (case-insensitive)
  const colabsEmpresa = todosColabs.filter(c =>
    c.empresaNome?.toUpperCase().includes(empresa.toUpperCase())
  );

  // 2. Buscar planilha VR/VT do mês ANTERIOR (VR pago em agosto = planilha de julho)
  // A folha do mês M paga o salário de M-1, então o VR é do mês anterior
  const mesVR = mes === 1 ? 12 : mes - 1;
  const anoVR = mes === 1 ? ano - 1 : ano;
  const planilha = await getPlanilhaVRVT(anoVR, mesVR);
  // Mapear VR por colaboradorId
  const vrPorColabId = new Map<number, { descontoVR: number; totalVRMes: number; tipoDescontoVR: string }>();
  for (const setor of planilha.setores) {
    for (const c of setor.colaboradores) {
      vrPorColabId.set(c.id, {
        descontoVR: c.descontoVR ?? 0,
        totalVRMes: c.geralVR ?? 0,
        tipoDescontoVR: c.tipoDescontoVR ?? "pct10",
      });
    }
  }

  // 3. Buscar titulares do plano de saúde da empresa
  const titulares = await db
    .select()
    .from(planoSaude)
    .where(and(
      eq(planoSaude.empresa, empresa as any),
      eq(planoSaude.tipo, "T"),
      eq(planoSaude.ativo, true),
    ));
  const titularPorColabId = new Map<number, typeof titulares[0]>();
  const titularPorNome = new Map<string, typeof titulares[0]>();
  for (const t of titulares) {
    if (t.colaboradorId) titularPorColabId.set(t.colaboradorId, t);
    titularPorNome.set(t.nome.toLowerCase().trim(), t);
  }

  let gerados = 0;
  let erros = 0;

  for (const c of colabsEmpresa) {
    try {
      // --- VR ---
      const vrInfo = vrPorColabId.get(c.id);
      const tipoDescontoVR = vrInfo?.tipoDescontoVR ?? c.tipoDescontoVR ?? "pct10";
      const totalVRMes = vrInfo?.totalVRMes ?? 0;
      // Se o colaborador não está na planilha VR/VT (ativoVRVT=false), calcular desconto
      // direto pelo tipo, usando totalVRMes=0 (sem VR no mês = sem desconto)
      let descontoVR: number;
      if (vrInfo !== undefined) {
        // Colaborador está na planilha — usar o desconto já calculado
        descontoVR = vrInfo.descontoVR;
      } else {
        // Não está na planilha VR/VT do mês anterior:
        // BUG FIX: fixo1 só desconta R$1 se o colaborador recebeu VR no mês
        // Se não está na planilha, não recebeu VR → desconto = R$0 para todos os tipos
        descontoVR = 0;
      }

      // --- Plano de Saúde ---
      const titular = titularPorColabId.get(c.id) ??
        titularPorNome.get(c.nome?.toLowerCase().trim() ?? "");
      let descontoPS = 0;
      let planoTitular = "";
      let mensalidadeTitular = 0;
      let valorBasePlano = 0;
      let subsidioEmpresa = 0;
      let totalDependentes = 0;
      if (titular) {
        const calc = await calcularDescontoPlanoSaude(
          db, empresa, c.id, titular.numeroBeneficiario, mes, ano
        );
        descontoPS = calc.descontoPlanoSaude;
        planoTitular = calc.planoTitular;
        mensalidadeTitular = calc.mensalidadeTitular;
        valorBasePlano = calc.valorBasePlano;
        subsidioEmpresa = calc.subsidioEmpresa;
        totalDependentes = calc.totalDependentes;
      }

            // --- Seguro de Vida ---
      let descontoSV = 0;
      if (c.temSeguroVida && c.valorSeguroVida) {
        const v = parseFloat(String(c.valorSeguroVida).replace(",", "."));
        if (!isNaN(v)) descontoSV = v;
      }
      // --- Férias no mês ---
      // Buscar férias do mês ANTERIOR (mesma competência do VR)
      // Folha de agosto paga salário de julho → férias de julho
      const primeiroDia = `${anoVR}-${String(mesVR).padStart(2,'0')}-01`;
      const ultimoDia = `${anoVR}-${String(mesVR).padStart(2,'0')}-${new Date(anoVR, mesVR, 0).getDate().toString().padStart(2,'0')}`;
      const feriasDoMes = await db
        .select({
          diasGozados: historicoFerias.diasGozados,
          diasVendidos: historicoFerias.diasVendidos,
          dataSaida: historicoFerias.dataSaida,
          dataRetorno: historicoFerias.dataRetorno,
        })
        .from(historicoFerias)
        .where(and(
          eq(historicoFerias.colaboradorId, c.id),
          // dataSaida <= ultimoDia E dataRetorno >= primeiroDia (sobreposicao)
          sql`${historicoFerias.dataSaida} <= ${ultimoDia}` as any,
          sql`${historicoFerias.dataRetorno} >= ${primeiroDia}` as any,
        ));
      const totalDiasFerias = feriasDoMes.reduce((acc, f) => acc + (f.diasGozados ?? 0), 0);
      const totalDiasVendidos = feriasDoMes.reduce((acc, f) => acc + (f.diasVendidos ?? 0), 0);
      const totalDescontos = parseFloat((descontoVR + descontoPS + descontoSV).toFixed(2));
      // Upsert: deletar registro existente e inserir novo
      await db.delete(folhaMes).where(and(
        eq(folhaMes.colaboradorId, c.id),
        eq(folhaMes.mes, mes),
        eq(folhaMes.ano, ano),
      ));
      await db.insert(folhaMes).values({
        colaboradorId: c.id,
        empresa: empresa as any,
        mes,
        ano,
        descontoVR: String(descontoVR.toFixed(2)),
        tipoDescontoVR,
        totalVRMes: String(totalVRMes.toFixed(2)),
        descontoPlanoSaude: String(descontoPS.toFixed(2)),
        planoTitular: planoTitular || null,
        mensalidadeTitular: mensalidadeTitular > 0 ? String(mensalidadeTitular.toFixed(2)) : null,
        valorBasePlano: valorBasePlano > 0 ? String(valorBasePlano.toFixed(2)) : null,
        subsidioEmpresa: subsidioEmpresa > 0 ? String(subsidioEmpresa.toFixed(2)) : null,
        totalDependentes: totalDependentes > 0 ? String(totalDependentes.toFixed(2)) : null,
        descontoSeguroVida: String(descontoSV.toFixed(2)),
        setorNome: c.setorNome ?? null,
        mesVRReferencia: mesVR,
        anoVRReferencia: anoVR,
        diasFerias: totalDiasFerias,
        diasVendidosFerias: totalDiasVendidos,
        totalDescontos: String(totalDescontos.toFixed(2)),
        createdByUserId: userId,
        createdByNome: userName,
      });
      gerados++;
    } catch (e) {
      erros++;
    }
  }
  return { gerados, erros };
}

/**
 * Busca a folha do mês gerada para uma empresa/mês/ano.
 */
export async function getFolhaMes(mes: number, ano: number, empresa?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(folhaMes.mes, mes), eq(folhaMes.ano, ano)];
  if (empresa) conditions.push(eq(folhaMes.empresa, empresa as any));

  const rows = await db
    .select({
      id: folhaMes.id,
      colaboradorId: folhaMes.colaboradorId,
      empresa: folhaMes.empresa,
      mes: folhaMes.mes,
      ano: folhaMes.ano,
      descontoVR: folhaMes.descontoVR,
      tipoDescontoVR: folhaMes.tipoDescontoVR,
      totalVRMes: folhaMes.totalVRMes,
      descontoPlanoSaude: folhaMes.descontoPlanoSaude,
      planoTitular: folhaMes.planoTitular,
      mensalidadeTitular: folhaMes.mensalidadeTitular,
      valorBasePlano: folhaMes.valorBasePlano,
      subsidioEmpresa: folhaMes.subsidioEmpresa,
      totalDependentes: folhaMes.totalDependentes,
      totalDescontos: folhaMes.totalDescontos,
      descontoSeguroVida: folhaMes.descontoSeguroVida,
      setorNome: folhaMes.setorNome,
      mesVRReferencia: folhaMes.mesVRReferencia,
      anoVRReferencia: folhaMes.anoVRReferencia,
      diasFerias: folhaMes.diasFerias,
      diasVendidosFerias: folhaMes.diasVendidosFerias,
      observacao: folhaMes.observacao,
      geradoEm: folhaMes.geradoEm,
      // Join com colaboradores
      nomeColaborador: colaboradores.nome,
      setorId: colaboradores.setorId,
    })
    .from(folhaMes)
    .innerJoin(colaboradores, eq(folhaMes.colaboradorId, colaboradores.id))
    .where(and(...conditions))
    .orderBy(asc(colaboradores.nome));

  return rows.map(r => ({
    ...r,
    descontoVR: parseFloat(String(r.descontoVR ?? 0)),
    totalVRMes: parseFloat(String(r.totalVRMes ?? 0)),
    descontoPlanoSaude: parseFloat(String(r.descontoPlanoSaude ?? 0)),
    mensalidadeTitular: r.mensalidadeTitular ? parseFloat(String(r.mensalidadeTitular)) : null,
    valorBasePlano: r.valorBasePlano ? parseFloat(String(r.valorBasePlano)) : null,
    subsidioEmpresa: r.subsidioEmpresa ? parseFloat(String(r.subsidioEmpresa)) : null,
    totalDependentes: r.totalDependentes ? parseFloat(String(r.totalDependentes)) : null,
    totalDescontos: parseFloat(String(r.totalDescontos ?? 0)),
    descontoSeguroVida: parseFloat(String(r.descontoSeguroVida ?? 0)),
    setorNome: r.setorNome ?? null,
    diasFerias: r.diasFerias ?? 0,
    diasVendidosFerias: r.diasVendidosFerias ?? 0,
  }));
}

/**
 * Resumo da folha do mês por empresa.
 */
export async function getResumoFolhaMes(mes: number, ano: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      empresa: folhaMes.empresa,
            totalDescontoVR: sum(folhaMes.descontoVR),
      totalDescontoPS: sum(folhaMes.descontoPlanoSaude),
      totalDescontoSV: sum(folhaMes.descontoSeguroVida),
      totalDescontos: sum(folhaMes.totalDescontos),
      qtdColaboradores: count(folhaMes.id),
    })
    .from(folhaMes)
    .where(and(eq(folhaMes.mes, mes), eq(folhaMes.ano, ano)))
    .groupBy(folhaMes.empresa);
  return rows.map(r => ({
    empresa: r.empresa,
    totalDescontoVR: parseFloat(String(r.totalDescontoVR ?? 0)),
    totalDescontoPS: parseFloat(String(r.totalDescontoPS ?? 0)),
    totalDescontoSV: parseFloat(String(r.totalDescontoSV ?? 0)),
    totalDescontos: parseFloat(String(r.totalDescontos ?? 0)),
    qtdColaboradores: Number(r.qtdColaboradores ?? 0),
  }));
}

/**
 * Lista as exceções de subsídio 70% no plano superior.
 */
export async function getFolhaMesExcecoes(empresa?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (empresa) conditions.push(eq(folhaMesExcecoes.empresa, empresa as any));

  const rows = await db
    .select({
      id: folhaMesExcecoes.id,
      colaboradorId: folhaMesExcecoes.colaboradorId,
      empresa: folhaMesExcecoes.empresa,
      mesInicio: folhaMesExcecoes.mesInicio,
      anoInicio: folhaMesExcecoes.anoInicio,
      mesFim: folhaMesExcecoes.mesFim,
      anoFim: folhaMesExcecoes.anoFim,
      descricao: folhaMesExcecoes.descricao,
      createdByNome: folhaMesExcecoes.createdByNome,
      createdAt: folhaMesExcecoes.createdAt,
      nomeColaborador: colaboradores.nome,
    })
    .from(folhaMesExcecoes)
    .innerJoin(colaboradores, eq(folhaMesExcecoes.colaboradorId, colaboradores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(colaboradores.nome));

  return rows;
}

export async function createFolhaMesExcecao(data: {
  colaboradorId: number;
  empresa: string;
  mesInicio?: number;
  anoInicio?: number;
  mesFim?: number;
  anoFim?: number;
  descricao?: string;
  userId: number;
  userName: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(folhaMesExcecoes).values({
    colaboradorId: data.colaboradorId,
    empresa: data.empresa as any,
    mesInicio: data.mesInicio ?? null,
    anoInicio: data.anoInicio ?? null,
    mesFim: data.mesFim ?? null,
    anoFim: data.anoFim ?? null,
    descricao: data.descricao ?? null,
    createdByUserId: data.userId,
    createdByNome: data.userName,
  });
}

export async function deleteFolhaMesExcecao(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(folhaMesExcecoes).where(eq(folhaMesExcecoes.id, id));
}

export async function updateFolhaMesObservacao(id: number, observacao: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(folhaMes).set({ observacao }).where(eq(folhaMes.id, id));
}


// ─── Movimentação do Mês ──────────────────────────────────────────────────────

// ── Seguro de Vida ────────────────────────────────────────────────────────────
export async function getMovimentacaoSeguroVida(filters: {
  empresa?: string;
  mes?: number;
  ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoSeguroVida.empresa, filters.empresa as any));
  if (filters.mes && filters.ano) {
    conditions.push(sql`EXTRACT(MONTH FROM ${movimentacaoSeguroVida.data}) = ${filters.mes}`);
    conditions.push(sql`EXTRACT(YEAR FROM ${movimentacaoSeguroVida.data}) = ${filters.ano}`);
  }
  return db.select().from(movimentacaoSeguroVida)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoSeguroVida.createdAt));
}

export async function createMovimentacaoSeguroVida(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; data: string; observacao?: string;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movimentacaoSeguroVida).values({
    colaboradorId: data.colaboradorId,
    nomeColaborador: data.nomeColaborador,
    empresa: data.empresa as any,
    tipo: data.tipo,
    data: data.data as any,
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoSeguroVida(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoSeguroVida).where(eq(movimentacaoSeguroVida.id, id));
}

export async function updateMovimentacaoSeguroVida(id: number, data: {
  tipo?: "incluir" | "excluir"; data?: string; observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const set: any = {};
  if (data.tipo !== undefined) set.tipo = data.tipo;
  if (data.data !== undefined) set.data = data.data;
  if (data.observacao !== undefined) set.observacao = data.observacao;
  if (Object.keys(set).length > 0) await db.update(movimentacaoSeguroVida).set(set).where(eq(movimentacaoSeguroVida.id, id));
}

// ── Auxílio Notebook ──────────────────────────────────────────────────────────
export async function getMovimentacaoAuxilioNotebook(filters: {
  empresa?: string; mes?: number; ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoAuxilioNotebook.empresa, filters.empresa as any));
  if (filters.mes && filters.ano) {
    conditions.push(sql`EXTRACT(MONTH FROM ${movimentacaoAuxilioNotebook.dataInicio}) = ${filters.mes}`);
    conditions.push(sql`EXTRACT(YEAR FROM ${movimentacaoAuxilioNotebook.dataInicio}) = ${filters.ano}`);
  }
  return db.select().from(movimentacaoAuxilioNotebook)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoAuxilioNotebook.createdAt));
}

export async function createMovimentacaoAuxilioNotebook(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; dataInicio: string; valor?: number; observacao?: string;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movimentacaoAuxilioNotebook).values({
    colaboradorId: data.colaboradorId,
    nomeColaborador: data.nomeColaborador,
    empresa: data.empresa as any,
    tipo: data.tipo,
    dataInicio: data.dataInicio as any,
    valor: data.valor != null ? String(data.valor) : "150.00",
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoAuxilioNotebook(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoAuxilioNotebook).where(eq(movimentacaoAuxilioNotebook.id, id));
}

export async function updateMovimentacaoAuxilioNotebook(id: number, data: {
  tipo?: "incluir" | "excluir"; dataInicio?: string; valor?: number; observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const set: any = {};
  if (data.tipo !== undefined) set.tipo = data.tipo;
  if (data.dataInicio !== undefined) set.dataInicio = data.dataInicio;
  if (data.valor !== undefined) set.valor = String(data.valor);
  if (data.observacao !== undefined) set.observacao = data.observacao;
  if (Object.keys(set).length > 0) await db.update(movimentacaoAuxilioNotebook).set(set).where(eq(movimentacaoAuxilioNotebook.id, id));
}

// ── Plano de Saúde ────────────────────────────────────────────────────────────
export async function getMovimentacaoPlanoSaude(filters: {
  empresa?: string; mes?: number; ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoPlanoSaude.empresa, filters.empresa as any));
  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoPlanoSaude.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoPlanoSaude.competenciaAno, filters.ano));
  }
  return db.select().from(movimentacaoPlanoSaude)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoPlanoSaude.createdAt));
}

export async function createMovimentacaoPlanoSaude(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; tipoPlano?: string; categoria?: "titular" | "dependente";
  dataNascimento?: string; valor?: number; valorEmpresa?: number; valorColaborador?: number;
  observacao?: string; competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movimentacaoPlanoSaude).values({
    colaboradorId: data.colaboradorId,
    nomeColaborador: data.nomeColaborador,
    empresa: data.empresa as any,
    tipo: data.tipo,
    tipoPlano: data.tipoPlano,
    categoria: data.categoria ?? "titular",
    dataNascimento: data.dataNascimento ?? undefined,
    valor: data.valor != null ? String(data.valor) : undefined,
    valorEmpresa: data.valorEmpresa != null ? String(data.valorEmpresa) : undefined,
    valorColaborador: data.valorColaborador != null ? String(data.valorColaborador) : undefined,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoPlanoSaude(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoPlanoSaude).where(eq(movimentacaoPlanoSaude.id, id));
}

export async function updateMovimentacaoPlanoSaude(id: number, data: {
  tipo?: "incluir" | "excluir"; tipoPlano?: string; categoria?: "titular" | "dependente";
  dataNascimento?: string; valor?: number; valorEmpresa?: number; valorColaborador?: number;
  observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const set: any = {};
  if (data.tipo !== undefined) set.tipo = data.tipo;
  if (data.tipoPlano !== undefined) set.tipoPlano = data.tipoPlano;
  if (data.categoria !== undefined) set.categoria = data.categoria;
  if (data.dataNascimento !== undefined) set.dataNascimento = data.dataNascimento;
  if (data.valor !== undefined) set.valor = String(data.valor);
  if (data.valorEmpresa !== undefined) set.valorEmpresa = String(data.valorEmpresa);
  if (data.valorColaborador !== undefined) set.valorColaborador = String(data.valorColaborador);
  if (data.observacao !== undefined) set.observacao = data.observacao;
  if (Object.keys(set).length > 0) await db.update(movimentacaoPlanoSaude).set(set).where(eq(movimentacaoPlanoSaude.id, id));
}

// ── Vale Transporte ───────────────────────────────────────────────────────────
export async function getMovimentacaoValeTransporte(filters: {
  empresa?: string; mes?: number; ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoValeTransporte.empresa, filters.empresa as any));
  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoValeTransporte.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoValeTransporte.competenciaAno, filters.ano));
  }
  return db.select().from(movimentacaoValeTransporte)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoValeTransporte.createdAt));
}

export async function createMovimentacaoValeTransporte(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; observacao?: string;
  competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movimentacaoValeTransporte).values({
    colaboradorId: data.colaboradorId,
    nomeColaborador: data.nomeColaborador,
    empresa: data.empresa as any,
    tipo: data.tipo,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoValeTransporte(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoValeTransporte).where(eq(movimentacaoValeTransporte.id, id));
}

export async function updateMovimentacaoValeTransporte(id: number, data: {
  tipo?: "incluir" | "excluir"; observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const set: any = {};
  if (data.tipo !== undefined) set.tipo = data.tipo;
  if (data.observacao !== undefined) set.observacao = data.observacao;
  if (Object.keys(set).length > 0) await db.update(movimentacaoValeTransporte).set(set).where(eq(movimentacaoValeTransporte.id, id));
}

// ── Auxílio Creche ────────────────────────────────────────────────────────────
export async function getMovimentacaoAuxilioCreche(filters: {
  empresa?: string; mes?: number; ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoAuxilioCreche.empresa, filters.empresa as any));
  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoAuxilioCreche.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoAuxilioCreche.competenciaAno, filters.ano));
  }
  return db.select().from(movimentacaoAuxilioCreche)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoAuxilioCreche.createdAt));
}

export async function createMovimentacaoAuxilioCreche(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; nomeFilho: string; dataNascimentoFilho?: string;
  valor?: number; observacao?: string;
  competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(movimentacaoAuxilioCreche).values({
    colaboradorId: data.colaboradorId,
    nomeColaborador: data.nomeColaborador,
    empresa: data.empresa as any,
    tipo: data.tipo,
    nomeFilho: data.nomeFilho,
    dataNascimentoFilho: data.dataNascimentoFilho ?? undefined,
    valor: data.valor != null ? String(data.valor) : undefined,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoAuxilioCreche(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoAuxilioCreche).where(eq(movimentacaoAuxilioCreche.id, id));
}

export async function updateMovimentacaoAuxilioCreche(id: number, data: {
  tipo?: "incluir" | "excluir"; nomeFilho?: string; dataNascimentoFilho?: string;
  valor?: number; observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const set: any = {};
  if (data.tipo !== undefined) set.tipo = data.tipo;
  if (data.nomeFilho !== undefined) set.nomeFilho = data.nomeFilho;
  if (data.dataNascimentoFilho !== undefined) set.dataNascimentoFilho = data.dataNascimentoFilho;
  if (data.valor !== undefined) set.valor = String(data.valor);
  if (data.observacao !== undefined) set.observacao = data.observacao;
  if (Object.keys(set).length > 0) await db.update(movimentacaoAuxilioCreche).set(set).where(eq(movimentacaoAuxilioCreche.id, id));
}

// ── Bônus por Indicação ───────────────────────────────────────────────────────
export async function getMovimentacaoBonusIndicacao(filters: {
  empresa?: string; status?: string; mes?: number; ano?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoBonusIndicacao.empresa, filters.empresa as any));
  if (filters.status) conditions.push(eq(movimentacaoBonusIndicacao.status, filters.status as any));
  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoBonusIndicacao.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoBonusIndicacao.competenciaAno, filters.ano));
  }
  return db.select().from(movimentacaoBonusIndicacao)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoBonusIndicacao.createdAt));
}

export async function createMovimentacaoBonusIndicacao(data: {
  indicadorId: number; nomeIndicador?: string; indicadoId?: number; nomeIndicado: string;
  empresa: string; dataAdmissaoIndicado: string; dataPagamentoPrevisto?: string;
  dataPagamentoEfetivo?: string; valorBonus?: number; status?: "pendente" | "pago" | "cancelado";
  observacao?: string; competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
}) {
  const db = await getDb();
  if (!db) return;
  // Calcular data de pagamento previsto: 3 meses após admissão
  let dataPagamentoPrevisto = data.dataPagamentoPrevisto;
  if (!dataPagamentoPrevisto && data.dataAdmissaoIndicado) {
    const [y, m, d] = data.dataAdmissaoIndicado.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + 3, d));
    dataPagamentoPrevisto = dt.toISOString().slice(0, 10);
  }
  await db.insert(movimentacaoBonusIndicacao).values({
    indicadorId: data.indicadorId,
    nomeIndicador: data.nomeIndicador,
    indicadoId: data.indicadoId,
    nomeIndicado: data.nomeIndicado,
    empresa: data.empresa as any,
    dataAdmissaoIndicado: data.dataAdmissaoIndicado as any,
    dataPagamentoPrevisto: dataPagamentoPrevisto ?? undefined,
    dataPagamentoEfetivo: data.dataPagamentoEfetivo ?? undefined,
    valorBonus: data.valorBonus != null ? String(data.valorBonus) : "1000.00",
    status: data.status ?? "pendente",
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function updateMovimentacaoBonusIndicacao(id: number, data: {
  status?: "pendente" | "pago" | "cancelado";
  dataPagamentoEfetivo?: string;
  observacao?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(movimentacaoBonusIndicacao)
    .set({
      status: data.status,
      dataPagamentoEfetivo: data.dataPagamentoEfetivo ?? undefined,
      observacao: data.observacao,
    })
    .where(eq(movimentacaoBonusIndicacao.id, id));
}

export async function deleteMovimentacaoBonusIndicacao(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoBonusIndicacao).where(eq(movimentacaoBonusIndicacao.id, id));
}

// ── Painel Auxílios & Bônus ───────────────────────────────────────────────────

/** Lista todos os registros de Auxílio Notebook com tipo "incluir" (ativos),
 *  agrupando por colaborador e mantendo apenas o mais recente por colaborador.
 *  Se o último registro for "excluir", o colaborador não aparece.
 */
export async function getAuxilioNotebookAtivos(filters: {
  empresa?: string; busca?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  // Busca todos os registros ordenados por data desc
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoAuxilioNotebook.empresa, filters.empresa as any));
  const todos = await db.select().from(movimentacaoAuxilioNotebook)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoAuxilioNotebook.createdAt));

  // Agrupa por colaboradorId, mantém apenas o registro mais recente
  const porColaborador = new Map<number, typeof todos[0]>();
  for (const r of todos) {
    if (!porColaborador.has(r.colaboradorId)) {
      porColaborador.set(r.colaboradorId, r);
    }
  }
  // Filtra apenas os que têm tipo "incluir" (ativos)
  let ativos = Array.from(porColaborador.values()).filter(r => r.tipo === "incluir");
  // Filtro de busca por nome
  if (filters.busca) {
    const lower = filters.busca.toLowerCase();
    ativos = ativos.filter(r => (r.nomeColaborador ?? "").toLowerCase().includes(lower));
  }
  return ativos.sort((a, b) => (a.nomeColaborador ?? "").localeCompare(b.nomeColaborador ?? ""));
}

/** Lista todos os registros de Auxílio Creche com tipo "incluir" (ativos),
 *  agrupando por colaboradorId + nomeFilho para suportar múltiplos filhos.
 */
export async function getAuxilioCrecheAtivos(filters: {
  empresa?: string; busca?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoAuxilioCreche.empresa, filters.empresa as any));
  const todos = await db.select().from(movimentacaoAuxilioCreche)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(movimentacaoAuxilioCreche.createdAt));

  // Agrupa por colaboradorId + nomeFilho
  const porChave = new Map<string, typeof todos[0]>();
  for (const r of todos) {
    const chave = `${r.colaboradorId}__${r.nomeFilho}`;
    if (!porChave.has(chave)) {
      porChave.set(chave, r);
    }
  }
  let ativos = Array.from(porChave.values()).filter(r => r.tipo === "incluir");
  if (filters.busca) {
    const lower = filters.busca.toLowerCase();
    ativos = ativos.filter(r =>
      (r.nomeColaborador ?? "").toLowerCase().includes(lower) ||
      (r.nomeFilho ?? "").toLowerCase().includes(lower)
    );
  }
  return ativos.sort((a, b) => (a.nomeColaborador ?? "").localeCompare(b.nomeColaborador ?? ""));
}

/** Lista todos os bônus por indicação com status pendente ou todos,
 *  calculando dias restantes até o pagamento previsto e flag de "pronto para pagar".
 */
export async function getBonusIndicacaoPanel(filters: {
  empresa?: string; status?: string; busca?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters.empresa) conditions.push(eq(movimentacaoBonusIndicacao.empresa, filters.empresa as any));
  if (filters.status && filters.status !== "todos") {
    conditions.push(eq(movimentacaoBonusIndicacao.status, filters.status as any));
  }
  const rows = await db.select().from(movimentacaoBonusIndicacao)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(movimentacaoBonusIndicacao.dataPagamentoPrevisto);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let result = rows.map(r => {
    const previsto = r.dataPagamentoPrevisto ? new Date(r.dataPagamentoPrevisto) : null;
    if (previsto) previsto.setHours(0, 0, 0, 0);
    const diasRestantes = previsto
      ? Math.ceil((previsto.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const prontoParaPagar = diasRestantes !== null && diasRestantes <= 0 && r.status === "pendente";
    const venceEm7Dias = diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 7 && r.status === "pendente";
    return { ...r, diasRestantes, prontoParaPagar, venceEm7Dias };
  });

  if (filters.busca) {
    const lower = filters.busca.toLowerCase();
    result = result.filter(r =>
      (r.nomeIndicador ?? "").toLowerCase().includes(lower) ||
      (r.nomeIndicado ?? "").toLowerCase().includes(lower)
    );
  }
  return result;
}

// ─── Geração automática de competência mensal do Plano de Saúde ──────────────
/**
 * Copia todos os beneficiários ativos de um mês/ano de origem para um novo mês/ano de destino.
 * Para cada beneficiário:
 *  1. Recalcula a idade com base na dataNascimento e no primeiro dia do mês destino.
 *  2. Busca na tabelaPrecos a faixa etária correta para empresa + codigoPlano + nova idade.
 *  3. Insere o registro com o novo mês/ano e o valor atualizado.
 * Retorna { inseridos, ignorados (já existiam) }.
 */
export async function gerarCompetenciaPlanoSaude(
  origemMes: number,
  origemAno: number,
  destinoMes: number,
  destinoAno: number,
): Promise<{ inseridos: number; ignorados: number }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Buscar beneficiários da competência de origem
  const origem = await db
    .select()
    .from(planoSaude)
    .where(and(
      eq(planoSaude.ativo, true),
      eq(planoSaude.mesReferencia, origemMes),
      eq(planoSaude.anoReferencia, origemAno),
    ));

  if (origem.length === 0) {
    throw new Error(`Nenhum beneficiário encontrado na competência ${origemMes}/${origemAno}`);
  }

  // Verificar se já existe algum registro no destino
  const [{ total }] = await db
    .select({ total: count() })
    .from(planoSaude)
    .where(and(
      eq(planoSaude.mesReferencia, destinoMes),
      eq(planoSaude.anoReferencia, destinoAno),
    ));

  if (Number(total) > 0) {
    throw new Error(`A competência ${destinoMes}/${destinoAno} já possui ${total} beneficiário(s) cadastrado(s). Exclua-os antes de gerar novamente.`);
  }

  // Buscar toda a tabela de preços
  const precos = await db.select().from(tabelaPrecos);

  // Data de referência = primeiro dia do mês destino
  const dataRef = new Date(destinoAno, destinoMes - 1, 1);

  function calcularIdade(dataNasc: string | null): number {
    if (!dataNasc) return 0;
    const nasc = new Date(dataNasc);
    if (isNaN(nasc.getTime())) return 0;
    let idade = dataRef.getFullYear() - nasc.getFullYear();
    const m = dataRef.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && dataRef.getDate() < nasc.getDate())) idade--;
    return Math.max(0, idade);
  }

  function buscarValor(empresa: string, codigoPlano: string, idade: number, tipo: "T" | "D"): number | null {
    const faixa = precos.find(
      (p) =>
        p.empresa === empresa &&
        p.codigoPlano === codigoPlano &&
        p.faixaInicio <= idade &&
        p.faixaFim >= idade,
    );
    if (!faixa) return null;
    return tipo === "T" ? Number(faixa.valorTitular) : Number(faixa.valorDependente);
  }

  let inseridos = 0;
  const ignorados = 0;

  for (const b of origem) {
    const novaIdade = calcularIdade(b.dataNascimento);
    const novoValor = buscarValor(b.empresa, b.plano, novaIdade, b.tipo as "T" | "D");

    await db.insert(planoSaude).values({
      empresa: b.empresa,
      numeroBeneficiario: b.numeroBeneficiario,
      nome: b.nome,
      matriculaFuncional: b.matriculaFuncional,
      cpf: b.cpf,
      dataNascimento: b.dataNascimento,
      plano: b.plano,
      tipo: b.tipo,
      idade: novaIdade,
      tipoDepend: b.tipoDepend,
      mensalidade: novoValor !== null ? String(novoValor) : b.mensalidade,
      totalFamilia: null, // será recalculado após inserção
      colaboradorId: b.colaboradorId,
      titularNumeroBeneficiario: b.titularNumeroBeneficiario,
      mesReferencia: destinoMes,
      anoReferencia: destinoAno,
      ativo: true,
    });
    inseridos++;
  }

  // Recalcular totalFamilia para cada titular no destino
  const titulares = await db
    .select()
    .from(planoSaude)
    .where(and(
      eq(planoSaude.mesReferencia, destinoMes),
      eq(planoSaude.anoReferencia, destinoAno),
      eq(planoSaude.tipo, "T"),
    ));

  for (const titular of titulares) {
    const dependentes = await db
      .select()
      .from(planoSaude)
      .where(and(
        eq(planoSaude.mesReferencia, destinoMes),
        eq(planoSaude.anoReferencia, destinoAno),
        eq(planoSaude.titularNumeroBeneficiario, titular.numeroBeneficiario),
      ));

    const totalFamilia =
      Number(titular.mensalidade) +
      dependentes.reduce((acc, d) => acc + Number(d.mensalidade), 0);

    await db
      .update(planoSaude)
      .set({ totalFamilia: String(totalFamilia) })
      .where(and(
        eq(planoSaude.mesReferencia, destinoMes),
        eq(planoSaude.anoReferencia, destinoAno),
        eq(planoSaude.numeroBeneficiario, titular.numeroBeneficiario),
      ));
  }

  return { inseridos, ignorados };
}

/**
 * Recalcula os campos diasFerias e diasVendidosFerias na folhaMes de um colaborador
 * para todos os meses onde a folha já foi gerada e que são afetados pelas férias alteradas.
 *
 * A lógica é: folha do mês M usa férias do mês M-1 (mesVRReferencia).
 * Então, se as férias do colaborador mudaram no mês X, precisamos atualizar a folha do mês X+1.
 */
export async function recalcularFolhaMesColaborador(
  colaboradorId: number,
  mesesAfetados: { mes: number; ano: number }[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (let i = 0; i < mesesAfetados.length; i++) {
    const mesFerias = mesesAfetados[i].mes;
    const anoFerias = mesesAfetados[i].ano;
    // A folha que usa férias do mês X é a folha do mês X+1
    const mesFolha = mesFerias === 12 ? 1 : mesFerias + 1;
    const anoFolha = mesFerias === 12 ? anoFerias + 1 : anoFerias;

    // Verificar se existe folha gerada para esse mês
    const folhaExistente = await db
      .select({ id: folhaMes.id, empresa: folhaMes.empresa })
      .from(folhaMes)
      .where(and(
        eq(folhaMes.colaboradorId, colaboradorId),
        eq(folhaMes.mes, mesFolha),
        eq(folhaMes.ano, anoFolha),
      ))
      .limit(1);

    if (folhaExistente.length === 0) continue; // Folha não gerada ainda, nada a fazer

    // Recalcular dias de férias do mês anterior (mesFerias)
    const primeiroDia = `${anoFerias}-${String(mesFerias).padStart(2,'0')}-01`;
    const ultimoDia = `${anoFerias}-${String(mesFerias).padStart(2,'0')}-${new Date(anoFerias, mesFerias, 0).getDate().toString().padStart(2,'0')}`;

    const feriasDoMes = await db
      .select({
        diasGozados: historicoFerias.diasGozados,
        diasVendidos: historicoFerias.diasVendidos,
      })
      .from(historicoFerias)
      .where(and(
        eq(historicoFerias.colaboradorId, colaboradorId),
        sql`${historicoFerias.dataSaida} <= ${ultimoDia}` as any,
        sql`${historicoFerias.dataRetorno} >= ${primeiroDia}` as any,
      ));

    const totalDiasFerias = feriasDoMes.reduce((acc, f) => acc + (f.diasGozados ?? 0), 0);
    const totalDiasVendidos = feriasDoMes.reduce((acc, f) => acc + (f.diasVendidos ?? 0), 0);

    // Atualizar apenas os campos de férias na folha existente
    await db
      .update(folhaMes)
      .set({
        diasFerias: totalDiasFerias,
        diasVendidosFerias: totalDiasVendidos,
      })
      .where(and(
        eq(folhaMes.colaboradorId, colaboradorId),
        eq(folhaMes.mes, mesFolha),
        eq(folhaMes.ano, anoFolha),
      ));
  }
}

/**
 * Extrai os meses afetados por um registro de férias (pode cruzar múltiplos meses).
 */
export function getMesesAfetadosPorFerias(
  dataSaida: Date | string | null,
  dataRetorno: Date | string | null
): { mes: number; ano: number }[] {
  if (!dataSaida || !dataRetorno) return [];
  const toDate = (d: Date | string) => typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')) : d;
  const saida = toDate(dataSaida);
  const retorno = toDate(dataRetorno);
  const meses: { mes: number; ano: number }[] = [];
  const cur = new Date(saida.getFullYear(), saida.getMonth(), 1);
  const fim = new Date(retorno.getFullYear(), retorno.getMonth(), 1);
  while (cur <= fim) {
    meses.push({ mes: cur.getMonth() + 1, ano: cur.getFullYear() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return meses;
}
