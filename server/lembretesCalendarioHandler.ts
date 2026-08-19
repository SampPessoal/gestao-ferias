import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import { getEventosByTaskUid } from "./db";

/**
 * Handler chamado pelo Heartbeat quando um lembrete de evento do calendário dispara.
 * O taskUid identifica o evento. O payload contém o tipo de lembrete (antecedência).
 */
export async function lembretesCalendarioHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const evento = await getEventosByTaskUid(user.taskUid);
    if (!evento) {
      // Evento não existe mais — retorna 200 para o forge parar de tentar
      return res.json({ ok: true, skipped: "orphan" });
    }

    const antecedencia = (req.body as any)?.antecedencia ?? "lembrete";
    const dataHora = new Date(evento.dataHora);
    const dataFormatada = dataHora.toLocaleString("pt-BR", {
      timeZone: "America/Bahia",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const titulo = `🔔 Lembrete: ${evento.titulo}`;
    const conteudo = [
      `Evento: **${evento.titulo}**`,
      evento.descricao ? `Descrição: ${evento.descricao}` : null,
      `Data/Hora: ${dataFormatada}`,
      `Antecedência: ${antecedencia}`,
    ].filter(Boolean).join("\n");

    await notifyOwner({ title: titulo, content: conteudo });

    return res.json({ ok: true, eventoId: evento.id, antecedencia });
  } catch (error: any) {
    console.error("[LembretesCalendario] Error:", error);
    return res.status(500).json({
      error: error?.message ?? "unknown",
      stack: error?.stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
