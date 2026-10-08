import { z } from "zod/v4";

/** Função centralizada de cálculo CLT de período aquisitivo (backend).
 *  Regra: PA = base, vencimento = PA + 1 ano - 1 dia, dataLimite = vencimento + 11 meses + 1 dia.
 *  Válida para qualquer período (1º, 2º, 3º...) e qualquer data base (admissão ou PA atual).
 */
function calcPeriodoFeriasBackend(periodoAquisitivoIso: string): { periodoAquisitivo: string; vencimento: string; dataLimite: string } {
  const [y, m, d] = periodoAquisitivoIso.split('-').map(Number);
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const vencDate = new Date(y + 1, m - 1, d - 1);
  const limDate  = new Date(vencDate);
  limDate.setMonth(limDate.getMonth() + 11);
  limDate.setDate(limDate.getDate() + 1);
  return { periodoAquisitivo: periodoAquisitivoIso, vencimento: toIso(vencDate), dataLimite: toIso(limDate) };
}
import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, deleteHeartbeatJob } from "./_core/heartbeat";
import { systemUsersRouter } from "./systemUsersRouter";
import {
  createColaborador,
  createEmpresa,
  createSetor,
  deleteColaborador,
  exportColaboradoresCSV,
  getAlertasUrgentes,
  getColaboradorById,
  getColaboradores,
  getColaboradoresAtivos,
  getColaboradoresPorSetor,
  getDashboardStats,
  getEmpresas,
  getSetores,
  getStatusPorEmpresa,
  getStatusPorSetor,
  toggleStatusColaborador,
  updateColaborador,
  updateEmpresa,
  updateEmpresaValorSeguro,
  updateSetor,
  getHistoricoFerias,
  createHistoricoFerias,
  updateHistoricoFerias,
  deleteHistoricoFerias,
  getResumoMensalFerias,
  getCancelamentosFerias,
  getAbonos,
  createAbono,
  updateAbono,
  deleteAbono,
  getSaldoAbonoPorColaborador,
  getAtestados,
  createAtestado,
  updateAtestado,
  deleteAtestado,
  getResumoMensalAtestados,
  getSeguroVida,
  updateSeguroVida,
  getBeneficios,
  updateBeneficio,
  getEventos,
  getEventoById,
  createEvento,
  updateEvento,
  deleteEvento,
  exportHistoricoFerias,
  exportAbonos,
  exportAtestados,
  exportBeneficios,
  exportSeguroVida,
  getPlanilhaVRVT,
  calcularDiasUteisQuinzenas,
  getDiasUteisComFeriados,
  toggleAtivoVRVT,
  editarColaboradorVRVT,
  getColaboradoresSemVRVT,
  getFeriados,
  createFeriado,
  updateFeriado,
  deleteFeriado,
  getFeriadosDoMes,
  getAusenciasDoMes,
  upsertAusencia,
  upsertDiasCustomVRVT,
  isMesGerado,
  marcarMesGerado,
  getMesesGerados,
  deletarMesGerado,
  getExamesPeriodicos,
  upsertExamePeriodico,
  getPlanoSaude,
  getPlanoSaudeResumo,
  createPlanoSaude,
  updatePlanoSaude,
  deletePlanoSaude,
  gerarCompetenciaPlanoSaude,
  getProximoNumeroBeneficiario,
  getTabelaPrecos,
  getValorPorFaixaEtaria,
  getCoparticipacao,
  getCoparticipacaoResumo,
  createCoparticipacao,
  updateCoparticipacao,
  deleteCoparticipacao,
  gerarFolhaMes,
  getFolhaMes,
  getResumoFolhaMes,
  getFolhaMesExcecoes,
  createFolhaMesExcecao,
  deleteFolhaMesExcecao,
  updateFolhaMesObservacao,
  getMovimentacaoSeguroVida,
  createMovimentacaoSeguroVida,
  updateMovimentacaoSeguroVida,
  deleteMovimentacaoSeguroVida,
  getMovimentacaoAuxilioNotebook,
  createMovimentacaoAuxilioNotebook,
  updateMovimentacaoAuxilioNotebook,
  deleteMovimentacaoAuxilioNotebook,
  getMovimentacaoPlanoSaude,
  createMovimentacaoPlanoSaude,
  updateMovimentacaoPlanoSaude as updateMovimentacaoPlanoSaudeMovimentacao,
  deleteMovimentacaoPlanoSaude,
  getMovimentacaoValeTransporte,
  createMovimentacaoValeTransporte,
  updateMovimentacaoValeTransporte,
  deleteMovimentacaoValeTransporte,
  getMovimentacaoAuxilioCreche,
  createMovimentacaoAuxilioCreche,
  updateMovimentacaoAuxilioCreche,
  deleteMovimentacaoAuxilioCreche,
  getMovimentacaoBonusIndicacao,
  createMovimentacaoBonusIndicacao,
  updateMovimentacaoBonusIndicacao,
  deleteMovimentacaoBonusIndicacao,
  getAuxilioNotebookAtivos,
  getAuxilioCrecheAtivos,
  getBonusIndicacaoPanel,
  getDb,
} from "./db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { movimentacaoAuxilioNotebook, movimentacaoAuxilioCreche } from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,
  systemUsers: systemUsersRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Empresas ──────────────────────────────────────────────────────────────
  empresas: router({
    list: protectedProcedure.query(async () => {
      return getEmpresas();
    }),
    create: protectedProcedure
      .input(z.object({ nome: z.string().min(1).max(150) }))
      .mutation(async ({ input }) => {
        return createEmpresa(input.nome);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), nome: z.string().min(1).max(150) }))
      .mutation(async ({ input }) => {
        await updateEmpresa(input.id, input.nome);
        return { success: true };
      }),
    updateValorSeguro: protectedProcedure
      .input(z.object({ id: z.number(), valorSeguroVida: z.string().nullable() }))
      .mutation(async ({ input }) => {
        await updateEmpresaValorSeguro(input.id, input.valorSeguroVida);
        return { success: true };
      }),
  }),

  // ─── Setores ───────────────────────────────────────────────────────────────
  setores: router({
    list: protectedProcedure
      .input(z.object({ empresaId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getSetores(input?.empresaId);
      }),
    create: protectedProcedure
      .input(z.object({ nome: z.string().min(1).max(100), empresaId: z.number().optional() }))
      .mutation(async ({ input }) => {
        return createSetor(input.nome, input.empresaId);
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), nome: z.string().min(1).max(100), empresaId: z.number().optional() }))
      .mutation(async ({ input }) => {
        await updateSetor(input.id, input.nome, input.empresaId);
        return { success: true };
      }),
    statusPorSetor: protectedProcedure
      .input(z.object({ empresaId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getStatusPorSetor(input?.empresaId);
      }),
    colaboradoresPorSetor: protectedProcedure
      .input(z.object({ setorId: z.number() }))
      .query(async ({ input }) => {
        return getColaboradoresPorSetor(input.setorId);
      }),
  }),

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return getDashboardStats();
    }),
    alertas: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getAlertasUrgentes(input?.limit ?? 10);
      }),
    statusPorEmpresa: protectedProcedure.query(async () => {
      return getStatusPorEmpresa();
    }),
    statusPorSetor: protectedProcedure
      .input(z.object({ empresaId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getStatusPorSetor(input?.empresaId);
      }),
  }),

  // ─── Colaboradores ─────────────────────────────────────────────────────────
  colaboradores: router({
    // Lista todos os ativos sem paginação — para selects/modais
    listAtivos: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getColaboradoresAtivos(input?.empresaId, input?.setorId);
      }),
    list: protectedProcedure
      .input(
        z.object({
          busca: z.string().max(200).trim().optional(),
          empresaId: z.number().optional(),
          setorId: z.number().optional(),
          status: z.enum(["ativo", "inativo", "todos"]).optional(),
          statusFerias: z.enum(["vencida", "vence30", "vence60", "vence90", "em_dia", "todos"]).optional(),
          page: z.number().optional(),
          pageSize: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getColaboradores(input ?? {});
      }),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const colaborador = await getColaboradorById(input.id);
        if (colaborador === null) {
          // Pode ser que o banco não está disponível (cold start) ou o ID não existe
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados indisponível. Tente novamente em instantes.' });
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Colaborador não encontrado.' });
        }
        return colaborador;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          nome: z.string().min(1).max(150).optional(),
          codigo: z.string().max(30).optional(),
          empresaId: z.number().optional().nullable(),
          setorId: z.number().optional().nullable(),
          admissao: z.string().max(10).optional().nullable(),
          periodoAquisitivo: z.string().max(30).optional().nullable(),
          vencimento: z.string().max(10).optional().nullable(),
          dataLimite: z.string().max(10).optional().nullable(),
          diasDireito: z.number().min(0).max(365).optional(),
          saldo: z.number().min(0).max(365).optional(),
          venda10: z.enum(["SIM", "NAO"]).optional().nullable(),
          fracionada: z.string().max(50).optional().nullable(),
          planejamento1: z.string().max(200).optional().nullable(),
          planejamento2: z.string().max(200).optional().nullable(),
          planejamento3: z.string().max(200).optional().nullable(),
          observacoes: z.string().max(1000).optional().nullable(),
          // Ficha Técnica
          dataNascimento: z.string().max(10).optional().nullable(),
          nacionalidade: z.string().max(60).optional().nullable(),
          estadoCivil: z.enum(["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel", "outro"]).optional().nullable(),
          naturalidade: z.string().max(80).optional().nullable(),
          estado: z.string().max(2).optional().nullable(),
          sexo: z.enum(["masculino", "feminino", "outro"]).optional().nullable(),
          temFilhos: z.boolean().optional().nullable(),
          qtdFilhos: z.number().min(0).max(20).optional().nullable(),
          idadeAdmissao: z.number().min(0).max(120).optional().nullable(),
          rg: z.string().max(20).optional().nullable(),
          cpf: z.string().max(14).optional().nullable(),
          telefone: z.string().max(20).optional().nullable(),
          celular: z.string().max(20).optional().nullable(),
          emailCorporativo: z.string().max(150).email().optional().nullable(),
          cargo: z.string().max(100).optional().nullable(),
                    contatoEmergenciaNome: z.string().max(150).optional().nullable(),
          contatoEmergenciaTelefone: z.string().max(20).optional().nullable(),
          // Filiação
          nomePai: z.string().max(150).optional().nullable(),
          nomeMae: z.string().max(150).optional().nullable(),
          // RG - expedição
          rgExpedicao: z.string().max(10).optional().nullable(),
          rgOrgaoExpedidor: z.string().max(20).optional().nullable(),
          // Endereço
          enderecoLogradouro: z.string().max(200).optional().nullable(),
          enderecoNumero: z.string().max(15).optional().nullable(),
          enderecoComplemento: z.string().max(80).optional().nullable(),
          enderecoBairro: z.string().max(80).optional().nullable(),
          enderecoCidade: z.string().max(80).optional().nullable(),
          enderecoEstado: z.string().max(2).optional().nullable(),
          enderecoCep: z.string().max(9).optional().nullable(),
          // Título de Eleitor
          tituloEleitor: z.string().max(20).optional().nullable(),
          zonaEleitoral: z.string().max(10).optional().nullable(),
          secaoEleitoral: z.string().max(10).optional().nullable(),
          pis: z.string().max(20).optional().nullable(),
          // Carteira de Trabalho
          ctpsDigital: z.boolean().optional().nullable(),
          ctpsNumero: z.string().max(25).optional().nullable(),
          ctpsSerie: z.string().max(15).optional().nullable(),
          // Dados Bancários
          bancoCodigo: z.string().max(10).optional().nullable(),
          bancoNome: z.string().max(100).optional().nullable(),
          bancoAgencia: z.string().max(20).optional().nullable(),
          bancoConta: z.string().max(30).optional().nullable(),
          bancoTipoConta: z.string().max(20).optional().nullable(),
          bancoChavePix: z.string().max(150).optional().nullable(),
          bancoTipoChavePix: z.string().max(20).optional().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateColaborador(id, data);
        return { success: true };
      }),
    toggleStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["ativo", "inativo"]),
          dataDemissao: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ input }) => {
        await toggleStatusColaborador(input.id, input.status, input.dataDemissao);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteColaborador(input.id);
        return { success: true };
      }),

    create: protectedProcedure
      .input(
        z.object({
          nome: z.string().min(1, "Nome é obrigatório").max(150),
          codigo: z.string().max(30).optional().nullable(),
          empresaId: z.number().optional().nullable(),
          setorId: z.number().optional().nullable(),
          admissao: z.string().max(10).optional().nullable(),
          periodoAquisitivo: z.string().max(30).optional().nullable(),
          vencimento: z.string().max(10).optional().nullable(),
          dataLimite: z.string().max(10).optional().nullable(),
          diasDireito: z.number().min(0).max(365).optional(),
          saldo: z.number().min(0).max(365).optional(),
          observacoes: z.string().max(1000).optional().nullable(),
          // Ficha técnica
          cpf: z.string().max(14).optional().nullable(),
          rg: z.string().max(20).optional().nullable(),
          dataNascimento: z.string().max(10).optional().nullable(),
          cargo: z.string().max(150).optional().nullable(),
          celular: z.string().max(30).optional().nullable(),
          telefone: z.string().max(30).optional().nullable(),
          emailCorporativo: z.string().max(200).optional().nullable(),
          sexo: z.enum(["masculino", "feminino", "outro"]).optional().nullable(),
          estadoCivil: z.enum(["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel", "outro"]).optional().nullable(),
          nacionalidade: z.string().max(100).optional().nullable(),
          naturalidade: z.string().max(100).optional().nullable(),
          temFilhos: z.boolean().optional().nullable(),
          qtdFilhos: z.number().min(0).max(20).optional().nullable(),
          idadeAdmissao: z.number().min(14).max(99).optional().nullable(),
          nomePai: z.string().max(200).optional().nullable(),
          nomeMae: z.string().max(200).optional().nullable(),
          contatoEmergenciaNome: z.string().max(200).optional().nullable(),
          contatoEmergenciaTelefone: z.string().max(30).optional().nullable(),
          rgExpedicao: z.string().max(10).optional().nullable(),
          rgOrgaoExpedidor: z.string().max(30).optional().nullable(),
          enderecoLogradouro: z.string().max(300).optional().nullable(),
          enderecoNumero: z.string().max(20).optional().nullable(),
          enderecoComplemento: z.string().max(100).optional().nullable(),
          enderecoBairro: z.string().max(100).optional().nullable(),
          enderecoCidade: z.string().max(100).optional().nullable(),
          enderecoEstado: z.string().max(2).optional().nullable(),
          enderecoCep: z.string().max(10).optional().nullable(),
          tituloEleitor: z.string().max(30).optional().nullable(),
          zonaEleitoral: z.string().max(10).optional().nullable(),
          secaoEleitoral: z.string().max(10).optional().nullable(),
          pis: z.string().max(20).optional().nullable(),
          ctpsTipo: z.string().max(10).optional().nullable(),
          ctpsNumero: z.string().max(30).optional().nullable(),
          ctpsSerie: z.string().max(20).optional().nullable(),
          valorVR: z.number().min(0).optional().nullable(),
          valorVT: z.number().min(0).optional().nullable(),
        })
      )
            .mutation(async ({ input, ctx }) => {
        // Calcula automaticamente período aquisitivo, vencimento e data limite
        // se a admissão for informada mas os campos não forem enviados
        // Regra CLT: PA = admissão, vencimento = PA + 1 ano - 1 dia, limite = vencimento + 11 meses + 1 dia
        let periodoAquisitivo = input.periodoAquisitivo;
        let vencimento = input.vencimento;
        let dataLimite = input.dataLimite;
        if (input.admissao && !periodoAquisitivo) {
          const calc = calcPeriodoFeriasBackend(input.admissao);
          periodoAquisitivo = calc.periodoAquisitivo;
          vencimento = calc.vencimento;
          dataLimite = calc.dataLimite;
        } else if (periodoAquisitivo && !vencimento) {
          // Se PA foi informado mas vencimento não: recalcula a partir do PA
          // Útil para colaboradores já avançados
          const calc = calcPeriodoFeriasBackend(periodoAquisitivo);
          vencimento = calc.vencimento;
          dataLimite = calc.dataLimite;
        }
        return createColaborador({
          ...input,
          periodoAquisitivo,
          vencimento,
          dataLimite,
          createdByUserId: ctx.systemUser?.id ?? null,
          createdByNome: ctx.systemUser?.nome ?? null,
        });
      }),
    exportCsv: protectedProcedure
      .input(
        z.object({
          empresaId: z.number().optional(),
          setorId: z.number().optional(),
          colaboradorId: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return exportColaboradoresCSV(input?.empresaId, input?.setorId, input?.colaboradorId);
      }),
  }),
  // ─── Histórico de Férias ─────────────────────────────────────────────────────────────────────────────────
  historicoFerias: router({
  list: protectedProcedure
    .input(
      z.object({
        mes: z.number().min(1).max(12).optional(),
        ano: z.number().optional(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        colaboradorId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return getHistoricoFerias(input);
    }),

  resumoAnual: protectedProcedure
    .input(z.object({ ano: z.number() }))
    .query(async ({ input }) => {
      return getResumoMensalFerias(input.ano);
    }),

  create: protectedProcedure
    .input(
      z.object({
        colaboradorId: z.number(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        dataSaida: z.string().max(10),
        dataFim: z.string().max(10).optional().nullable(),
        dataRetorno: z.string().max(10),
        diasGozados: z.number().min(0).max(365),
        venda10: z.enum(["SIM", "NAO"]).default("NAO"),
        diasVendidos: z.number().min(0).max(30).optional(),
        periodoRef: z.string().max(30).optional(),
        observacao: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { dataFim, ...rest } = input;
      return createHistoricoFerias({
        ...rest,
        // Passa string YYYY-MM-DD diretamente para colunas date() do PostgreSQL
        dataSaida: input.dataSaida as any,
        ...(dataFim ? { dataFim: dataFim as any } : {}),
        dataRetorno: input.dataRetorno as any,
        diasVendidos: input.diasVendidos ?? 0,
        createdByUserId: ctx.systemUser?.id ?? null,
        createdByNome: ctx.systemUser?.nome ?? null,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        colaboradorId: z.number(), // obrigatório para recalcular saldo
        empresaId: z.number().nullable().optional(),
        setorId: z.number().nullable().optional(),
        dataSaida: z.string().optional(),
        dataFim: z.string().optional().nullable(),
        dataRetorno: z.string().optional(),
        diasGozados: z.number().optional(),
        venda10: z.enum(["SIM", "NAO"]).optional(),
        diasVendidos: z.number().optional(),
        periodoRef: z.string().optional(),
        observacao: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, dataSaida, dataFim, dataRetorno, ...rest } = input;
      return updateHistoricoFerias(id, {
        ...rest,
        ...(dataSaida ? { dataSaida: dataSaida as any } : {}),
        ...(dataFim !== undefined ? { dataFim: dataFim ? dataFim as any : null } : {}),
        ...(dataRetorno ? { dataRetorno: dataRetorno as any } : {}),
      });
    }),

    delete: protectedProcedure
    .input(z.object({
      id: z.number(),
      motivo: z.string().trim().min(3, "Informe o motivo do cancelamento"),
    }))
    .mutation(async ({ input, ctx }) => {
      return deleteHistoricoFerias(input.id, ctx.user?.id ?? undefined, ctx.user?.name ?? undefined, input.motivo);
    }),
  listCancelamentos: protectedProcedure
    .input(z.object({
      colaboradorId: z.number().optional(),
      empresaId: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return getCancelamentosFerias(input ?? {});
    }),
  exportar: protectedProcedure
    .input(z.object({
      empresaId: z.number().optional(),
      setorId: z.number().optional(),
      colaboradorId: z.number().optional(),
      ano: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return exportHistoricoFerias(input ?? {});
    }),
  }),
  abonos: router({
    list: protectedProcedure
      .input(z.object({
        colaboradorId: z.number().optional(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        anoReferencia: z.number().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getAbonos(input);
      }),

    saldo: protectedProcedure
      .input(z.object({ colaboradorId: z.number(), anoReferencia: z.number() }))
      .query(async ({ input }) => {
        const usado = await getSaldoAbonoPorColaborador(input.colaboradorId, input.anoReferencia);
        return { usado, direito: 2, saldo: Math.max(0, 2 - usado) };
      }),

    create: protectedProcedure
      .input(z.object({
        colaboradorId: z.number(),
        empresaId: z.number().nullable().optional(),
        setorId: z.number().nullable().optional(),
        anoReferencia: z.number(),
        dataAbono: z.string().max(10),
        dataAbono2: z.string().max(10).nullable().optional(),
        diasAbonados: z.number().min(1).max(2),
        observacao: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { dataAbono, dataAbono2, ...rest } = input;
        // Valida que não ultrapassa 2 dias no ano
        const usado = await getSaldoAbonoPorColaborador(input.colaboradorId, input.anoReferencia);
        if (usado + input.diasAbonados > 2) {
          throw new Error(`Limite de 2 dias de abono por ano atingido. Já utilizados: ${usado} dia(s).`);
        }
        return createAbono({
          ...rest,
          // Passa string YYYY-MM-DD diretamente para colunas date() do PostgreSQL
          dataAbono: dataAbono as any,
          ...(dataAbono2 ? { dataAbono2: dataAbono2 as any } : {}),
          createdByUserId: ctx.systemUser?.id ?? null,
          createdByNome: ctx.systemUser?.nome ?? null,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        dataAbono: z.string().optional(),
        dataAbono2: z.string().nullable().optional(),
        diasAbonados: z.number().min(1).max(2).optional(),
        observacao: z.string().nullable().optional(),
        anoReferencia: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataAbono, dataAbono2, ...rest } = input;
        // Valida limite de 2 dias no ano ao editar
        if (rest.diasAbonados !== undefined) {
          const { getDb } = await import("./db");
          const { abonos } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [abonoAtual] = await db.select().from(abonos).where(eq(abonos.id, id)).limit(1);
            if (abonoAtual) {
              const anoRef = rest.anoReferencia ?? abonoAtual.anoReferencia;
              const diasNovos = rest.diasAbonados;
              const usado = await getSaldoAbonoPorColaborador(abonoAtual.colaboradorId, anoRef);
              const diasAntigos = abonoAtual.diasAbonados;
              if ((usado - diasAntigos) + diasNovos > 2) {
                throw new Error(`Limite de 2 dias de abono por ano atingido.`);
              }
            }
          }
        }
        return updateAbono(id, {
          ...rest,
          ...(dataAbono ? { dataAbono: dataAbono as any } : {}),
          // Só atualiza dataAbono2 se foi explicitamente enviada (undefined = não alterar, null = apagar)
          ...(dataAbono2 !== undefined ? { dataAbono2: dataAbono2 ? dataAbono2 as any : null } : {}),
        });
      }),

        delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteAbono(input.id);
      }),
    exportar: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        colaboradorId: z.number().optional(),
        ano: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return exportAbonos(input ?? {});
      }),
  }),
  // ─── Atestados ───────────────────────────────────────────────────────────────────────────
  atestados: router({
    list: protectedProcedure
      .input(z.object({
        mes: z.number().optional(),
        ano: z.number().optional(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        colaboradorId: z.number().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getAtestados(input);
      }),

    resumoMensal: protectedProcedure
      .input(z.object({ ano: z.number() }))
      .query(async ({ input }) => {
        return getResumoMensalAtestados(input.ano);
      }),

    create: protectedProcedure
      .input(z.object({
        colaboradorId: z.number(),
        empresaId: z.number().nullable().optional(),
        setorId: z.number().nullable().optional(),
        dataInicio: z.string().max(10),
        dataFim: z.string().max(10),
        diasAfastamento: z.number().min(1).max(365),
        diasDescontar: z.number().min(0).max(365).nullable().optional(),
        tipoAfastamento: z.enum(["integral", "comparecimento"]).default("integral"),
        tipo: z.enum(["medico", "odontologico", "acompanhante", "outros"]).default("medico"),
        cid: z.string().max(20).nullable().optional(),
        medico: z.string().max(150).nullable().optional(),
        observacao: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { dataInicio, dataFim, ...rest } = input;
        return createAtestado({
          ...rest,
          dataInicio: dataInicio as any,
          dataFim: dataFim as any,
          createdByUserId: ctx.systemUser?.id ?? null,
          createdByNome: ctx.systemUser?.nome ?? null,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        diasAfastamento: z.number().min(1).optional(),
        diasDescontar: z.number().min(0).max(365).nullable().optional(),
        tipoAfastamento: z.enum(["integral", "comparecimento"]).optional(),
        tipo: z.enum(["medico", "odontologico", "acompanhante", "outros"]).optional(),
        cid: z.string().max(20).nullable().optional(),
        medico: z.string().max(150).nullable().optional(),
        observacao: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataInicio, dataFim, ...rest } = input;
        return updateAtestado(id, {
          ...rest,
          ...(dataInicio ? { dataInicio: dataInicio as any } : {}),
          ...(dataFim ? { dataFim: dataFim as any } : {}),
        });
      }),

                delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteAtestado(input.id);
      }),
    exportar: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        colaboradorId: z.number().optional(),
        ano: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return exportAtestados(input ?? {});
      }),
  }),
  beneficios: router({
    list: protectedProcedure
      .input(z.object({
        busca: z.string().max(200).trim().optional(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getBeneficios(input ?? {});
      }),

        update: protectedProcedure
      .input(z.object({
        id: z.number(),
        valorVR: z.string().nullable().optional(),
        valorVT: z.string().nullable().optional(),
        auxilioVeiculo: z.string().nullable().optional(),
        auxilioVeiculoFolha: z.string().nullable().optional(),
        auxilioCelularFolha: z.string().nullable().optional(),
        setorBeneficio: z.string().nullable().optional(),
        valorFixoQuinzenal: z.string().nullable().optional(),
        tipoRecebimentoCaju: z.enum(["normal", "vt_saldo_livre", "vr_saldo_livre", "auxilio_veiculo"]).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateBeneficio(id, data);
        return { success: true };
      }),
    exportar: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return exportBeneficios(input ?? {});
      }),
  }),
  seguroVida: router({
    list: protectedProcedure
      .input(z.object({
        busca: z.string().max(200).trim().optional(),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        seguro: z.enum(["com", "sem", "todos"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getSeguroVida(input ?? {});
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        temSeguroVida: z.boolean(),
        valorSeguroVida: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSeguroVida(id, data);
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateSeguroVida(input.id, { temSeguroVida: false, valorSeguroVida: null });
        return { success: true };
      }),
    exportar: protectedProcedure
      .input(z.object({
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
        seguro: z.enum(["com", "sem", "todos"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return exportSeguroVida(input ?? {});
      }),
  }),
  // ─── Calendário ────────────────────────────────────────────────────────────────────────
  calendario: router({
    list: protectedProcedure
      .input(z.object({ ano: z.number(), mes: z.number() }).optional())
      .query(async ({ input }) => {
        return getEventos(input ?? undefined);
      }),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getEventoById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        titulo: z.string().min(1),
        descricao: z.string().optional(),
        dataHora: z.date(),
        diaInteiro: z.boolean().optional(),
        cor: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await createEvento({
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          dataHora: input.dataHora,
          diaInteiro: input.diaInteiro ?? false,
          cor: input.cor ?? "blue",
          createdByUserId: (ctx.user as any)?.id ?? null,
          createdByNome: (ctx.user as any)?.nome ?? null,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().min(1).optional(),
        descricao: z.string().nullable().optional(),
        dataHora: z.date().optional(),
        diaInteiro: z.boolean().optional(),
        cor: z.string().optional(),
        lembretesTaskUids: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateEvento(id, data as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEvento(input.id);
        return { success: true };
      }),
    agendarLembretes: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const evento = await getEventoById(input.id);
        if (!evento) throw new Error("Evento n\u00e3o encontrado");

        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const dataHora = new Date(evento.dataHora);

        // Antecedências em minutos: 2 dias, 1 dia, 15h, 2h, 30min, 15min
        const antecedencias = [
          { label: "2 dias antes", minutos: 2 * 24 * 60 },
          { label: "1 dia antes", minutos: 1 * 24 * 60 },
          { label: "15 horas antes", minutos: 15 * 60 },
          { label: "2 horas antes", minutos: 2 * 60 },
          { label: "30 minutos antes", minutos: 30 },
          { label: "15 minutos antes", minutos: 15 },
        ];

        const taskUids: string[] = [];
        const agora = new Date();

        for (const ant of antecedencias) {
          const disparo = new Date(dataHora.getTime() - ant.minutos * 60 * 1000);
          if (disparo <= agora) continue; // j\u00e1 passou, pula

          // Cron 6-field UTC: sec min hour dom mon dow
          const s = 0;
          const m = disparo.getUTCMinutes();
          const h = disparo.getUTCHours();
          const dom = disparo.getUTCDate();
          const mon = disparo.getUTCMonth() + 1;
          const cron = `${s} ${m} ${h} ${dom} ${mon} *`;

          const jobName = `lembrete-ev${input.id}-${ant.minutos}min`;
          try {
            const job = await createHeartbeatJob({
              name: jobName,
              cron,
              path: "/api/scheduled/lembrete-calendario",
              payload: { eventoId: input.id, antecedencia: ant.label },
              description: `Lembrete: ${evento.titulo} (${ant.label})`,
            }, sessionToken);
            taskUids.push(job.taskUid);
          } catch (e) {
            console.warn(`[Calendario] Falha ao agendar lembrete ${ant.label}:`, e);
          }
        }

        if (taskUids.length > 0) {
          const uidsStr = taskUids.join(",");
          await updateEvento(input.id, { lembretesTaskUids: uidsStr });
        }

        return { agendados: taskUids.length, taskUids };
      }),
    cancelarLembretes: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const evento = await getEventoById(input.id);
        if (!evento || !evento.lembretesTaskUids) return { cancelados: 0 };

        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const uids = evento.lembretesTaskUids.split(",").map(s => s.trim()).filter(Boolean);
        let cancelados = 0;
        for (const uid of uids) {
          try {
            await deleteHeartbeatJob(uid, sessionToken);
            cancelados++;
          } catch (e) {
            console.warn(`[Calendario] Falha ao cancelar lembrete ${uid}:`, e);
          }
        }
        await updateEvento(input.id, { lembretesTaskUids: null });
        return { cancelados };
      }),
  }),
  feriados: router({
    list: protectedProcedure
      .input(z.object({ ano: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getFeriados(input?.ano);
      }),
    doMes: protectedProcedure
      .input(z.object({ ano: z.number(), mes: z.number() }))
      .query(async ({ input }) => {
        return getFeriadosDoMes(input.ano, input.mes);
      }),
    create: protectedProcedure
      .input(z.object({
        data: z.string().max(10), // "YYYY-MM-DD"
        nome: z.string().min(1).max(200),
        tipo: z.enum(["nacional", "estadual", "municipal"]),
        recorrente: z.boolean().default(true),
        ativo: z.boolean().default(true),
        municipio: z.string().max(100).optional().nullable(),
        setoresAfetados: z.string().optional().nullable(), // JSON array de setorId
      }))
      .mutation(async ({ input }) => {
        return createFeriado({
          data: input.data as any,
          nome: input.nome,
          tipo: input.tipo,
          recorrente: input.recorrente,
          ativo: input.ativo,
          municipio: input.municipio ?? null,
          setoresAfetados: input.setoresAfetados ?? null,
        });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.string().optional(),
        nome: z.string().min(1).max(200).optional(),
        tipo: z.enum(["nacional", "estadual", "municipal"]).optional(),
        recorrente: z.boolean().optional(),
        ativo: z.boolean().optional(),
        municipio: z.string().max(100).optional().nullable(),
        setoresAfetados: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, data, ...rest } = input;
        await updateFeriado(id, {
          ...rest,
          ...(data ? { data: data as any } : {}),
        });
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFeriado(input.id);
        return { ok: true };
      }),
  }),
  ausenciasVRVT: router({
    doMes: protectedProcedure
      .input(z.object({ ano: z.number(), mes: z.number() }))
      .query(async ({ input }) => {
        return getAusenciasDoMes(input.ano, input.mes);
      }),
    upsert: protectedProcedure
      .input(z.object({
        colaboradorId: z.number(),
        ano: z.number(),
        mes: z.number(),
        diasAusencia: z.number().int().min(0).max(31),
        observacao: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertAusencia(
          input.colaboradorId,
          input.ano,
          input.mes,
          input.diasAusencia,
          input.observacao
        );
        return { ok: true };
      }),
  }),
  planilhaVRVT: router({
    getDados: protectedProcedure
      .input(z.object({
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
        empresaId: z.number().optional(),
        setorId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getPlanilhaVRVT(input.ano, input.mes, input.empresaId, input.setorId);
      }),
    getDiasUteis: protectedProcedure
      .input(z.object({
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return getDiasUteisComFeriados(input.ano, input.mes);
      }),
    toggleAtivo: protectedProcedure
      .input(z.object({
        id: z.number(),
        ativo: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await toggleAtivoVRVT(input.id, input.ativo);
        return { success: true };
      }),
    getExcluidos: protectedProcedure
      .input(z.object({ busca: z.string().max(200).trim().optional() }).optional())
      .query(async ({ input }) => {
        return await getColaboradoresSemVRVT(input?.busca);
      }),
    editar: protectedProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        valorVR: z.number().nullable().optional(),
        valorVT: z.number().nullable().optional(),
        ativoVRVT: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await editarColaboradorVRVT(id, data);
        return { success: true };
      }),
    editarDias: protectedProcedure
      .input(z.object({
        colaboradorId: z.number(),
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
        quinzena: z.enum(["Q1", "Q2"]),
        tipo: z.enum(["VR", "VT"]),
        dias: z.number().int().min(0).max(31),
      }))
      .mutation(async ({ input }) => {
        await upsertDiasCustomVRVT(
          input.colaboradorId,
          input.ano,
          input.mes,
          input.quinzena,
          input.tipo,
          input.dias
        );
        return { success: true };
      }),
    isMesGerado: protectedProcedure
      .input(z.object({
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
      }))
      .query(async ({ input }) => {
        const gerado = await isMesGerado(input.ano, input.mes);
        return { gerado };
      }),
    getMesesGerados: protectedProcedure
      .query(async () => {
        return await getMesesGerados();
      }),
    gerarMes: protectedProcedure
      .input(z.object({
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verifica se já foi gerado
        const jaGerado = await isMesGerado(input.ano, input.mes);
        if (jaGerado) return { success: true, message: 'Mês já estava gerado' };
        // Marca como gerado
        await marcarMesGerado(input.ano, input.mes, ctx.user?.id);
        return { success: true, message: 'Mês gerado com sucesso' };
      }),
    deletarMes: protectedProcedure
      .input(z.object({
        ano: z.number().int().min(2020).max(2100),
        mes: z.number().int().min(1).max(12),
      }))
      .mutation(async ({ input }) => {
        await deletarMesGerado(input.ano, input.mes);
        return { success: true };
      }),
  }),

  examesPeriodicos: router({
    getAll: protectedProcedure
      .input(z.object({ ano: z.number().int().min(2020).max(2100) }))
      .query(async ({ input }) => {
        return await getExamesPeriodicos(input.ano);
      }),

    upsert: protectedProcedure
      .input(z.object({
        colaboradorId: z.number().int(),
        ano: z.number().int().min(2020).max(2100),
        realizou: z.boolean(),
        dataExame: z.string().nullable(),
        observacoes: z.string().max(500).optional(),
        enviadoContabilidade: z.boolean().optional(),
        dataEnvioContabilidade: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertExamePeriodico(
          input.colaboradorId,
          input.ano,
          input.realizou,
          input.dataExame,
          input.observacoes,
          input.enviadoContabilidade,
          input.dataEnvioContabilidade
        );
        return { success: true };
      }),
  }),
  planoSaude: router({
    list: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        tipo: z.string().optional(),
        busca: z.string().max(200).trim().optional(),
        mesReferencia: z.number().int().min(1).max(12).optional(),
        anoReferencia: z.number().int().min(2020).max(2100).optional(),
      }))
      .query(async ({ input }) => {
        return await getPlanoSaude(input);
      }),
    resumo: protectedProcedure
      .input(z.object({
        mesReferencia: z.number().int().min(1).max(12).default(7),
        anoReferencia: z.number().int().min(2020).max(2100).default(2026),
      }))
      .query(async ({ input }) => {
        return await getPlanoSaudeResumo(input.mesReferencia, input.anoReferencia);
      }),
    // Gera próximo número de beneficiário disponível
    proximoNumero: protectedProcedure
      .input(z.object({ empresa: z.string() }))
      .query(async ({ input }) => {
        return await getProximoNumeroBeneficiario(input.empresa);
      }),
    create: protectedProcedure
      .input(z.object({
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]),
        numeroBeneficiario: z.string().min(1).max(20),
        nome: z.string().min(2).max(200),
        cpf: z.string().max(11).optional(),
        dataNascimento: z.string().max(10).optional(), // YYYY-MM-DD
        idade: z.number().int().min(0).max(120),
        plano: z.string().min(1).max(100),
        tipo: z.enum(["T", "D"]),
        tipoDepend: z.enum(["Filho/Filha", "Conjuge", "Agregado", ""]).optional(),
        mensalidade: z.number().min(0),
        matriculaFuncional: z.string().max(20).optional(),
        colaboradorId: z.number().int().optional(),
        titularNumeroBeneficiario: z.string().max(20).optional(),
        mesReferencia: z.number().int().min(1).max(12),
        anoReferencia: z.number().int().min(2020).max(2100),
      }))
      .mutation(async ({ input }) => {
        return await createPlanoSaude(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        nome: z.string().min(2).max(200).optional(),
        cpf: z.string().max(11).optional(),
        dataNascimento: z.string().max(10).optional(),
        idade: z.number().int().min(0).max(120).optional(),
        plano: z.string().max(100).optional(),
        tipo: z.enum(["T", "D"]).optional(),
        tipoDepend: z.enum(["Filho/Filha", "Conjuge", "Agregado", ""]).optional(),
        mensalidade: z.number().min(0).optional(),
        matriculaFuncional: z.string().max(20).optional(),
        titularNumeroBeneficiario: z.string().max(20).optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await updatePlanoSaude(id, rest);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await deletePlanoSaude(input.id);
      }),
    gerarCompetencia: protectedProcedure
      .input(z.object({
        origemMes: z.number().int().min(1).max(12),
        origemAno: z.number().int().min(2020).max(2100),
        destinoMes: z.number().int().min(1).max(12),
        destinoAno: z.number().int().min(2020).max(2100),
      }))
      .mutation(async ({ input }) => {
        return await gerarCompetenciaPlanoSaude(
          input.origemMes,
          input.origemAno,
          input.destinoMes,
          input.destinoAno,
        );
      }),
  }),
  tabelaPrecos: router({
    list: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getTabelaPrecos(input.empresa);
      }),
    valorPorIdade: protectedProcedure
      .input(z.object({
        empresa: z.string(),
        codigoPlano: z.string(),
        idade: z.number().int().min(0).max(120),
      }))
      .query(async ({ input }) => {
        return await getValorPorFaixaEtaria(input.empresa, input.codigoPlano, input.idade);
      }),
  }),

  coparticipacao: router({
    list: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        mes: z.number().int().min(1).max(12).optional(),
        ano: z.number().int().min(2020).max(2100).optional(),
        numeroBeneficiario: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getCoparticipacao(input);
      }),
    resumo: protectedProcedure
      .input(z.object({
        mes: z.number().int().min(1).max(12).optional(),
        ano: z.number().int().min(2020).max(2100).optional(),
      }))
      .query(async ({ input }) => {
        return await getCoparticipacaoResumo(input);
      }),
    create: protectedProcedure
      .input(z.object({
        numeroBeneficiario: z.string().min(1).max(20),
        empresa: z.string().min(1),
        nomeBeneficiario: z.string().min(1).max(200),
        tipoBeneficiario: z.enum(["T", "D"]),
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2100),
        valor: z.number().min(0).max(999999),
        observacao: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await createCoparticipacao({
          ...input,
          createdByUserId: ctx.systemUser?.id ?? ctx.user?.id,
          createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined,
        });
        return { id };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        valor: z.number().min(0).max(999999).optional(),
        observacao: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateCoparticipacao(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteCoparticipacao(input.id);
        return { success: true };
      }),
  }),

  // ─── Folha do Mês ─────────────────────────────────────────────────────────
  folhaMes: router({
    gerar: protectedProcedure
      .input(z.object({
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2100),
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]),
        diasUteis: z.number().int().min(1).max(31),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await gerarFolhaMes(
          input.mes,
          input.ano,
          input.empresa,
          input.diasUteis,
          ctx.systemUser?.id ?? 0,
          ctx.systemUser?.nome ?? "Sistema",
        );
        return result;
      }),

    list: protectedProcedure
      .input(z.object({
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2100),
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]).optional(),
      }))
      .query(async ({ input }) => {
        return getFolhaMes(input.mes, input.ano, input.empresa);
      }),

    resumo: protectedProcedure
      .input(z.object({
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2100),
      }))
      .query(async ({ input }) => {
        return getResumoFolhaMes(input.mes, input.ano);
      }),

    excecoes: router({
      list: protectedProcedure
        .input(z.object({ empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]).optional() }))
        .query(async ({ input }) => {
          return getFolhaMesExcecoes(input.empresa);
        }),

      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]),
          mesInicio: z.number().int().min(1).max(12).optional(),
          anoInicio: z.number().int().min(2020).max(2100).optional(),
          mesFim: z.number().int().min(1).max(12).optional(),
          anoFim: z.number().int().min(2020).max(2100).optional(),
          descricao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createFolhaMesExcecao({
            ...input,
            userId: ctx.systemUser?.id ?? 0,
            userName: ctx.systemUser?.nome ?? "Sistema",
          });
          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteFolhaMesExcecao(input.id);
          return { success: true };
        }),
    }),

    updateObservacao: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        observacao: z.string().max(500),
      }))
      .mutation(async ({ input }) => {
        await updateFolhaMesObservacao(input.id, input.observacao);
        return { success: true };
      }),
  }),

  // ─── Movimentação do Mês ───────────────────────────────────────────────────
  movimentacao: router({
    // Seguro de Vida
    seguroVida: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoSeguroVida(input);
        }),
      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          nomeColaborador: z.string().max(200).optional(),
          empresa: z.string().max(20),
          tipo: z.enum(["incluir", "excluir"]),
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoSeguroVida({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          tipo: z.enum(["incluir", "excluir"]).optional(),
          data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoSeguroVida(id, rest);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoSeguroVida(input.id);
          return { success: true };
        }),
    }),

    // Auxílio Notebook
    auxNotebook: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoAuxilioNotebook(input);
        }),
      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          nomeColaborador: z.string().max(200).optional(),
          empresa: z.string().max(20),
          tipo: z.enum(["incluir", "excluir"]),
          dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          valor: z.number().optional(),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoAuxilioNotebook({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          tipo: z.enum(["incluir", "excluir"]).optional(),
          dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valor: z.number().optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoAuxilioNotebook(id, rest);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoAuxilioNotebook(input.id);
          return { success: true };
        }),
    }),

    // Plano de Saúde
    planoSaude: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoPlanoSaude(input);
        }),
      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          nomeColaborador: z.string().max(200).optional(),
          empresa: z.string().max(20),
          tipo: z.enum(["incluir", "excluir"]),
          tipoPlano: z.string().max(100).optional(),
          categoria: z.enum(["titular", "dependente"]).optional(),
          dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valor: z.number().optional(),
          valorEmpresa: z.number().optional(),
          valorColaborador: z.number().optional(),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoPlanoSaude({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          tipo: z.enum(["incluir", "excluir"]).optional(),
          tipoPlano: z.string().max(100).optional(),
          categoria: z.enum(["titular", "dependente"]).optional(),
          dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valor: z.number().optional(),
          valorEmpresa: z.number().optional(),
          valorColaborador: z.number().optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoPlanoSaudeMovimentacao(id, rest);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoPlanoSaude(input.id);
          return { success: true };
        }),
    }),

    // Vale Transporte
    valeTransporte: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoValeTransporte(input);
        }),
      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          nomeColaborador: z.string().max(200).optional(),
          empresa: z.string().max(20),
          tipo: z.enum(["incluir", "excluir"]),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoValeTransporte({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          tipo: z.enum(["incluir", "excluir"]).optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoValeTransporte(id, rest);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoValeTransporte(input.id);
          return { success: true };
        }),
    }),

    // Auxílio Creche
    auxCreche: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoAuxilioCreche(input);
        }),
      create: protectedProcedure
        .input(z.object({
          colaboradorId: z.number().int().positive(),
          nomeColaborador: z.string().max(200).optional(),
          empresa: z.string().max(20),
          tipo: z.enum(["incluir", "excluir"]),
          nomeFilho: z.string().max(200),
          dataNascimentoFilho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valor: z.number().optional(),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoAuxilioCreche({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          tipo: z.enum(["incluir", "excluir"]).optional(),
          nomeFilho: z.string().max(200).optional(),
          dataNascimentoFilho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valor: z.number().optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoAuxilioCreche(id, rest);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoAuxilioCreche(input.id);
          return { success: true };
        }),
    }),

    // Exportar todas as abas
    exportAll: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        mes: z.number().int(),
        ano: z.number().int(),
      }))
      .query(async ({ input }) => {
        const [seguroVida, auxNotebook, planoSaude, valeTransporte, auxCreche, bonusIndicacao] = await Promise.all([
          getMovimentacaoSeguroVida(input),
          getMovimentacaoAuxilioNotebook(input),
          getMovimentacaoPlanoSaude(input),
          getMovimentacaoValeTransporte(input),
          getMovimentacaoAuxilioCreche(input),
          getMovimentacaoBonusIndicacao(input),
        ]);
        return { seguroVida, auxNotebook, planoSaude, valeTransporte, auxCreche, bonusIndicacao };
      }),

    // Bônus por Indicação
    bonusIndicacao: router({
      list: protectedProcedure
        .input(z.object({
          empresa: z.string().optional(),
          status: z.string().optional(),
          mes: z.number().int().optional(),
          ano: z.number().int().optional(),
        }))
        .query(async ({ input }) => {
          return getMovimentacaoBonusIndicacao(input);
        }),
      create: protectedProcedure
        .input(z.object({
          indicadorId: z.number().int().positive(),
          nomeIndicador: z.string().max(200).optional(),
          indicadoId: z.number().int().positive().optional(),
          nomeIndicado: z.string().max(200),
          empresa: z.string().max(20),
          dataAdmissaoIndicado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          dataPagamentoPrevisto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valorBonus: z.number().optional(),
          observacao: z.string().max(500).optional(),
          competenciaMes: z.number().int().min(1).max(12).optional(),
          competenciaAno: z.number().int().min(2020).max(2100).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await createMovimentacaoBonusIndicacao({ ...input, createdByUserId: ctx.systemUser?.id ?? ctx.user?.id, createdByNome: ctx.systemUser?.nome ?? ctx.user?.name ?? undefined });
          return { success: true };
        }),
      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          status: z.enum(["pendente", "pago", "cancelado"]),
          dataPagamentoEfetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          await updateMovimentacaoBonusIndicacao(input.id, input);
          return { success: true };
        }),
      update: protectedProcedure
        .input(z.object({
          id: z.number().int().positive(),
          nomeIndicado: z.string().max(200).optional(),
          empresa: z.string().max(20).optional(),
          dataAdmissaoIndicado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          valorBonus: z.number().optional(),
          observacao: z.string().max(500).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...rest } = input;
          await updateMovimentacaoBonusIndicacao(id, rest as any);
          return { success: true };
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteMovimentacaoBonusIndicacao(input.id);
          return { success: true };
        }),
    }),
  }),

  // ─── Painel Auxílios & Bônus ───────────────────────────────────────────────
  auxiliosBonus: router({
    notebookAtivos: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        busca: z.string().max(200).trim().optional(),
      }))
      .query(async ({ input }) => {
        return getAuxilioNotebookAtivos(input);
      }),

    crecheAtivos: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        busca: z.string().max(200).trim().optional(),
      }))
      .query(async ({ input }) => {
        return getAuxilioCrecheAtivos(input);
      }),

    bonusPanel: protectedProcedure
      .input(z.object({
        empresa: z.string().optional(),
        status: z.string().optional(),
        busca: z.string().max(200).trim().optional(),
      }))
      .query(async ({ input }) => {
        return getBonusIndicacaoPanel(input);
      }),

    updateBonusStatus: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(["pendente", "pago", "cancelado"]),
        dataPagamentoEfetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        observacao: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        await updateMovimentacaoBonusIndicacao(input.id, input);
        return { success: true };
      }),

    updateNotebook: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        nomeColaborador: z.string().optional(),
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]).optional(),
        tipo: z.enum(["incluir", "excluir"]).optional(),
        dataInicio: z.string().optional(),
        valor: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { id, ...data } = input;
        await db.update(movimentacaoAuxilioNotebook).set(data as any).where(eq(movimentacaoAuxilioNotebook.id, id));
        return { success: true };
      }),

    updateCreche: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        nomeColaborador: z.string().optional(),
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]).optional(),
        tipo: z.enum(["incluir", "excluir"]).optional(),
        nomeFilho: z.string().optional(),
        dataNascimentoFilho: z.string().optional(),
        valor: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { id, ...data } = input;
        await db.update(movimentacaoAuxilioCreche).set(data as any).where(eq(movimentacaoAuxilioCreche.id, id));
        return { success: true };
      }),

    updateBonus: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        nomeIndicador: z.string().optional(),
        nomeIndicado: z.string().optional(),
        empresa: z.enum(["FREIRE", "JOANES", "SUDOESTE", "SOLAR"]).optional(),
        dataAdmissaoIndicado: z.string().optional(),
        valorBonus: z.number().optional(),
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateMovimentacaoBonusIndicacao(input.id, input as any);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
