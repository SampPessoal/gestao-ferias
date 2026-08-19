import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { colaboradores, empresas, setores } from "../drizzle/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";

// Usa string ISO para evitar bug de timezone (UTC midnight vira dia anterior em GMT-3)
function toIsoDateStr(date: Date | string | null): string | null {
  if (!date) return null;
  if (typeof date === "string") return date.split("T")[0];
  // Date object: usa UTC para evitar conversao de timezone
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateBR(date: Date | string | null): string {
  const iso = toIsoDateStr(date);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function diasRestantes(date: Date | string | null): number | null {
  const iso = toIsoDateStr(date);
  if (!iso) return null;
  // Compara strings ISO para evitar conversao de timezone
  const hojeIso = toIsoDateStr(new Date())!;
  const [hy, hm, hd] = hojeIso.split("-").map(Number);
  const [dy, dm, dd] = iso.split("-").map(Number);
  // Diferenca em dias usando timestamps UTC midnight
  const hojeMs = Date.UTC(hy, hm - 1, hd);
  const dataMs = Date.UTC(dy, dm - 1, dd);
  return Math.floor((dataMs - hojeMs) / (1000 * 60 * 60 * 24));
}

export async function alertasFeriasHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // Buscar todas as empresas
    const todasEmpresas = await db.select().from(empresas);

    // Data de hoje e +30 dias no fuso de Brasília (UTC-3)
    // Evita bug de timezone: new Date() em UTC pode retornar dia errado após 21h em GMT-3
    const hojeStr = (() => {
      const agora = new Date();
      const offsetBrasilia = -3 * 60;
      const localMs = agora.getTime() + (agora.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
      const hojeLocal = new Date(localMs);
      const y = hojeLocal.getUTCFullYear();
      const m = String(hojeLocal.getUTCMonth() + 1).padStart(2, "0");
      const d = String(hojeLocal.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    const [hy, hm, hd] = hojeStr.split("-").map(Number);
    const hoje = new Date(Date.UTC(hy, hm - 1, hd));
    const limite30Date = new Date(Date.UTC(hy, hm - 1, hd + 30));
    const limite30 = `${limite30Date.getUTCFullYear()}-${String(limite30Date.getUTCMonth() + 1).padStart(2, '0')}-${String(limite30Date.getUTCDate()).padStart(2, '0')}`;

    let totalAlertas = 0;

    for (const empresa of todasEmpresas) {
      // Buscar colaboradores ativos com data limite <= 30 dias ou já vencida
      const cols = await db
        .select({
          id: colaboradores.id,
          nome: colaboradores.nome,
          dataLimite: colaboradores.dataLimite,
          vencimento: colaboradores.vencimento,
          saldo: colaboradores.saldo,
          setorNome: setores.nome,
        })
        .from(colaboradores)
        .leftJoin(setores, eq(colaboradores.setorId, setores.id))
        .where(
          and(
            eq(colaboradores.empresaId, empresa.id),
            eq(colaboradores.status, "ativo"),
            isNotNull(colaboradores.dataLimite),
            lte(colaboradores.dataLimite, limite30)
          )
        )
        .orderBy(colaboradores.dataLimite);

      if (cols.length === 0) continue;

      // Separar vencidas e próximas do vencimento
      const vencidas = cols.filter(c => {
        const dias = diasRestantes(c.dataLimite);
        return dias !== null && dias < 0;
      });

      const proximasVencer = cols.filter(c => {
        const dias = diasRestantes(c.dataLimite);
        return dias !== null && dias >= 0;
      });

      // Montar conteúdo da notificação
      let content = `📋 **Relatório de Férias — ${empresa.nome}**\n`;
      content += `📅 Data do relatório: ${formatDateBR(hoje)}\n\n`;

      if (vencidas.length > 0) {
        content += `🔴 **FÉRIAS VENCIDAS (${vencidas.length} colaborador${vencidas.length > 1 ? "es" : ""}):**\n`;
        for (const c of vencidas) {
          const dias = Math.abs(diasRestantes(c.dataLimite) ?? 0);
          content += `• ${c.nome} — Setor: ${c.setorNome ?? "—"} — Data Limite: ${formatDateBR(c.dataLimite)} (vencida há ${dias} dia${dias !== 1 ? "s" : ""})\n`;
        }
        content += "\n";
      }

      if (proximasVencer.length > 0) {
        content += `🟡 **VENCENDO EM ATÉ 30 DIAS (${proximasVencer.length} colaborador${proximasVencer.length > 1 ? "es" : ""}):**\n`;
        for (const c of proximasVencer) {
          const dias = diasRestantes(c.dataLimite) ?? 0;
          content += `• ${c.nome} — Setor: ${c.setorNome ?? "—"} — Data Limite: ${formatDateBR(c.dataLimite)} (${dias} dia${dias !== 1 ? "s" : ""} restante${dias !== 1 ? "s" : ""})\n`;
        }
      }

      content += `\n⚠️ Acesse o sistema Gestão de RH para tomar as providências necessárias.`;

      const title = `⚠️ Alerta de Férias — ${empresa.nome}: ${vencidas.length} vencida${vencidas.length !== 1 ? "s" : ""}, ${proximasVencer.length} vencendo em 30 dias`;

      await notifyOwner({ title, content });
      totalAlertas += cols.length;
    }

    return res.json({
      ok: true,
      message: `Alertas enviados para ${todasEmpresas.length} empresas. Total de colaboradores em alerta: ${totalAlertas}`,
    });
  } catch (error: any) {
    console.error("[alertasFerias] Error:", error);
    return res.status(500).json({
      error: error?.message ?? "Unknown error",
      stack: error?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
