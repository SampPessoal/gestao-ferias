import { z } from "zod/v4";
import jwt from "jsonwebtoken";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import {
  getSystemUsers,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  resetSystemUserPassword,
  verifySystemUserPassword,
  countSystemAdmins,
  getSystemUserById,
  changeSystemUserPassword,
} from "./db";

const SYS_COOKIE = "gf_sys_session";

// Cache em memória para evitar query ao banco a cada request de /me
// TTL de 10 minutos — reduz latência sem risco de dados obsoletos (invalidação manual em logout/update)
const userCache = new Map<number, { user: Awaited<ReturnType<typeof getSystemUserById>>; expiresAt: number }>();
const USER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export function invalidateUserCache(userId: number) {
  userCache.delete(userId);
}

async function getSystemUserCached(id: number) {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 5000)
    );
    const user = await Promise.race([getSystemUserById(id), timeout]);
    if (user) userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    else userCache.delete(id);
    return user;
  } catch {
    return null;
  }
}

// Helper: lê o usuário do sistema a partir do cookie JWT próprio
export async function getSystemUserFromRequest(req: any) {
  try {
    // Usa req.headers.cookie diretamente (sem depender do cookie-parser middleware)
    const rawCookies = parseCookieHeader(req.headers?.cookie ?? "");
    // Fallback: aceitar token via Authorization header (para preview em iframe onde cookies são bloqueados)
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const token = rawCookies[SYS_COOKIE] || bearerToken;
    if (!token) return null;
    const payload = jwt.verify(token, ENV.cookieSecret) as { id: number };
    const user = await getSystemUserCached(payload.id);
    if (!user || !user.ativo) return null;
    return user;
  } catch {
    return null;
  }
}

export const systemUsersRouter = router({
  // Login com e-mail e senha
  login: publicProcedure
    .input(z.object({
      email: z.string().email().max(254).trim().toLowerCase(),
      senha: z.string().min(1).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const timeout = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 15000)
      );
      const user = await Promise.race([verifySystemUserPassword(input.email, input.senha), timeout]).catch(() => {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível. Tente novamente em instantes." });
      });
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
      }
      const token = jwt.sign({ id: user.id }, ENV.cookieSecret, { expiresIn: "7d" });
      const cookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(SYS_COOKIE, token, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
      return {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        token,
      };
    }),

  // Retorna usuário logado (lê cookie próprio)
  me: publicProcedure.query(async ({ ctx }) => {
    const user = await getSystemUserFromRequest(ctx.req);
    if (!user) return null;
    return { id: user.id, nome: user.nome, email: user.email, role: user.role };
  }),

  // Logout
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOpts = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(SYS_COOKIE, { ...cookieOpts, maxAge: -1 });
    return { success: true };
  }),

  // Listar usuários (admin only — verificado via cookie próprio)
  list: publicProcedure.query(async ({ ctx }) => {
    const me = await getSystemUserFromRequest(ctx.req);
    if (!me || me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getSystemUsers();
  }),

  // Criar usuário (admin only)
  create: publicProcedure
    .input(z.object({
      nome: z.string().min(2).max(120).trim(),
      email: z.string().email().max(254).trim().toLowerCase(),
      role: z.enum(["admin", "usuario"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me || me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { senhaGerada } = await createSystemUser(input);
      return { senhaGerada };
    }),

  // Editar usuário (admin only)
  update: publicProcedure
    .input(z.object({
      id: z.number().int().positive(),
      nome: z.string().min(2).max(120).trim().optional(),
      email: z.string().email().max(254).trim().toLowerCase().optional(),
      role: z.enum(["admin", "usuario"]).optional(),
      ativo: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me || me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      // Impede remover o último admin
      if (input.role === "usuario" || input.ativo === false) {
        const target = await getSystemUserById(input.id);
        if (target?.role === "admin") {
          const totalAdmins = await countSystemAdmins();
          if (totalAdmins <= 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível rebaixar o único administrador." });
          }
        }
      }
      const { id, ...data } = input;
      await updateSystemUser(id, data);
      return { success: true };
    }),

  // Resetar senha (admin only)
  resetPassword: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me || me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { novaSenha } = await resetSystemUserPassword(input.id);
      return { novaSenha };
    }),

  // Alterar própria senha (qualquer usuário logado)
  changePassword: publicProcedure
    .input(z.object({
      senhaAtual: z.string().min(1).max(128),
      novaSenha: z.string().min(8).max(128)
        .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
        .regex(/[0-9]/, "A senha deve conter ao menos um número"),
    }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me) throw new TRPCError({ code: "UNAUTHORIZED" });
      // Verifica a senha atual
      const valid = await verifySystemUserPassword(me.email, input.senhaAtual);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Senha atual incorreta." });
      // Aplica a nova senha usando função dedicada (updateSystemUser ignora passwordHash por segurança)
      await changeSystemUserPassword(me.id, input.novaSenha);
      // Invalida o cache do usuário para forçar releitura do banco no próximo request
      invalidateUserCache(me.id);
      return { success: true };
    }),

  // Editar próprio perfil: nome e e-mail (qualquer usuário logado)
  updateProfile: publicProcedure
    .input(z.object({
      nome: z.string().min(2).max(120).trim().optional(),
      email: z.string().email().max(254).trim().toLowerCase().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me) throw new TRPCError({ code: "UNAUTHORIZED" });
      await updateSystemUser(me.id, input);
      return { success: true };
    }),

  // Remover usuário (admin only)
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const me = await getSystemUserFromRequest(ctx.req);
      if (!me || me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      // Impede remover o último admin
      const target = await getSystemUserById(input.id);
      if (target?.role === "admin") {
        const totalAdmins = await countSystemAdmins();
        if (totalAdmins <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível remover o único administrador." });
        }
      }
      await deleteSystemUser(input.id);
      return { success: true };
    }),
});
