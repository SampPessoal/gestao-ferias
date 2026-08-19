import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getSystemUserFromRequest } from "../systemUsersRouter";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  systemUser: { id: number; nome: string; email: string; role: "admin" | "usuario" } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let systemUser: TrpcContext["systemUser"] = null;

  // Tenta autenticar via Manus OAuth (legado)
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // Tenta autenticar via cookie próprio do sistema (gf_sys_session)
  try {
    const su = await getSystemUserFromRequest(opts.req);
    if (su) {
      systemUser = { id: su.id, nome: su.nome, email: su.email, role: su.role };
      // Se não há usuário Manus, cria um user sintético para compatibilidade com protectedProcedure
      if (!user) {
        user = {
          id: su.id,
          openId: `sys_${su.id}`,
          name: su.nome,
          email: su.email,
          role: su.role === "admin" ? "admin" : "user",
          createdAt: new Date(),
        } as unknown as User;
      }
    }
  } catch {
    systemUser = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    systemUser,
  };
}
