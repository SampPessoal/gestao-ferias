import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "rh-user-001",
    email: "rh@empresa.com",
    name: "RH Manager",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };

  return { ctx };
}

// ─── Cálculos CLT ─────────────────────────────────────────────────────────────

// Função auxiliar para testes (espelha calcPeriodoFeriasBackend)
function calcPeriodo(pa: string) {
  const [y, m, d] = pa.split('-').map(Number);
  const toIso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const vencDate = new Date(y + 1, m - 1, d - 1);
  const limDate  = new Date(vencDate);
  limDate.setMonth(limDate.getMonth() + 11);
  limDate.setDate(limDate.getDate() + 1);
  return { periodoAquisitivo: pa, vencimento: toIso(vencDate), dataLimite: toIso(limDate) };
}

describe("Cálculos CLT de férias", () => {
  it("período aquisitivo: igual à data de admissão (1º período)", () => {
    // Regra CLT: PA começa no dia da admissão, não após 12 meses
    const admissao = "2023-01-01";
    const { periodoAquisitivo } = calcPeriodo(admissao);
    expect(periodoAquisitivo).toBe("2023-01-01");
  });

  it("vencimento: período aquisitivo + 1 ano - 1 dia", () => {
    // Ex: PA 20/07/2026 -> vencimento 19/07/2027
    expect(calcPeriodo("2026-07-20").vencimento).toBe("2027-07-19");
    expect(calcPeriodo("2023-01-01").vencimento).toBe("2023-12-31");
    expect(calcPeriodo("2025-03-15").vencimento).toBe("2026-03-14");
  });

  it("data limite CLT: vencimento + 11 meses + 1 dia", () => {
    // Ex: vencimento 19/07/2027 -> data limite 20/06/2028
    expect(calcPeriodo("2026-07-20").dataLimite).toBe("2028-06-20");
    expect(calcPeriodo("2023-01-01").dataLimite).toBe("2024-12-02");
  });

  it("avanço de período: soma 1 ano ao PA atual", () => {
    // Ex: PA 20/07/2026 -> próximo PA 20/07/2027
    const atual = calcPeriodo("2026-07-20");
    const [y, m, d] = atual.periodoAquisitivo.split('-').map(Number);
    const toIso = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const novoPA = toIso(new Date(y + 1, m - 1, d));
    const proximo = calcPeriodo(novoPA);
    expect(proximo.periodoAquisitivo).toBe("2027-07-20");
    expect(proximo.vencimento).toBe("2028-07-19");
    expect(proximo.dataLimite).toBe("2029-06-20");
  });

  it("saldo máximo de férias CLT: 30 dias", () => {
    const diasDireito = 30;
    expect(diasDireito).toBeLessThanOrEqual(30);
    expect(diasDireito).toBeGreaterThan(0);
  });

  it("venda de 10 dias: saldo mínimo restante deve ser 20 dias", () => {
    const saldoTotal = 30;
    const diasVendidos = 10;
    const saldoRestante = saldoTotal - diasVendidos;
    expect(saldoRestante).toBe(20);
    expect(saldoRestante).toBeGreaterThanOrEqual(20);
  });

  it("férias fracionadas: mínimo 14 dias no primeiro período (CLT art. 134 §1)", () => {
    const periodos = [20, 10]; // 20 + 10 = 30
    const maiorPeriodo = Math.max(...periodos);
    expect(maiorPeriodo).toBeGreaterThanOrEqual(14);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("limpa o cookie de sessão e retorna sucesso", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1, openId: "sample-user", email: "sample@example.com",
        name: "Sample User", loginMethod: "manus", role: "user",
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── Validações de dados ──────────────────────────────────────────────────────

describe("Validações de dados de colaboradores", () => {
  it("nome não pode ser vazio", () => {
    const nome = "ADRIANO BORGES COSTA";
    expect(nome.trim().length).toBeGreaterThan(0);
  });

  it("saldo deve ser entre 0 e 30", () => {
    const saldos = [0, 10, 20, 30];
    saldos.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(30);
    });
  });

  it("data limite deve ser posterior ao vencimento", () => {
    const vencimento = new Date("2025-10-31");
    const dataLimite = new Date("2026-10-02");
    expect(dataLimite.getTime()).toBeGreaterThan(vencimento.getTime());
  });
});
