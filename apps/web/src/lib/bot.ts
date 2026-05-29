import { z } from "zod";
import { BOT_API_KEY, getBotApiUrl } from "./bot-config";
import { createClient } from "./standard-api";

/**
 * BFF bot — client typé vers l'API Discord du bot (`:3001`, façade systemd `rpb-bot.service`).
 *
 * Cette couche est le SEUL point du dashboard qui parle au bot en HTTP. Elle ne tire
 * jamais `@rpbey/db` (le bot expose ses propres lectures derrière `BOT_API_KEY`), donc
 * elle reste compatible avec l'enforcement global `app/api/v1/`.
 *
 * Les schémas Zod ci-dessous reflètent exactement les réponses de `apps/bot/src/lib/api-server.ts`
 * (`/api/status`, `/api/logs`, `/api/commands`) et servent à la fois à valider la réponse upstream
 * et de contrat pour la surface `/api/v1/bot/*`. Quand la lane `integration` aura câblé un module
 * `packages/api-contract/src/bot.ts`, ces schémas y migreront à l'identique (re-export).
 */

// ─── Schémas (forme du fil — toutes les dates sont des strings ISO) ────────────

export const BotStatusSchema = z.object({
  status: z.enum(["running", "starting", "offline"]),
  uptime: z.number(),
  uptimeFormatted: z.string(),
  guilds: z.number(),
  users: z.number(),
  memberCount: z.number(),
  onlineCount: z.number(),
  ping: z.number(),
  memoryUsage: z.string(),
  runtime: z.string(),
});
export type BotStatus = z.infer<typeof BotStatusSchema>;

export const LogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.string(),
  message: z.string(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export const BotCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
});
export type BotCommand = z.infer<typeof BotCommandSchema>;

/** Query string de `/api/v1/bot/logs` (tail borné + curseur ISO optionnel). */
export const BotLogsQuerySchema = z.object({
  tail: z.coerce.number().int().min(1).max(2000).default(200),
  since: z.string().optional(),
});
export type BotLogsQuery = z.infer<typeof BotLogsQuerySchema>;

// ─── Schémas de réponse de la surface `/api/v1/bot/*` ──────────────────────────

/** Statut nullable : le bot peut être injoignable (`null` → 503 côté route legacy). */
export const BotStatusResponseSchema = z.object({
  status: BotStatusSchema.nullable(),
});
export type BotStatusResponse = z.infer<typeof BotStatusResponseSchema>;

export const BotLogsResponseSchema = z.object({
  logs: z.array(LogEntrySchema),
});
export type BotLogsResponse = z.infer<typeof BotLogsResponseSchema>;

export const BotCommandsResponseSchema = z.object({
  commands: z.array(BotCommandSchema),
});
export type BotCommandsResponse = z.infer<typeof BotCommandsResponseSchema>;

// ─── Client singleton vers le bot (:3001) ─────────────────────────────────────

const botClient = createClient(getBotApiUrl(), {
  "x-api-key": BOT_API_KEY,
});

/**
 * Statut du bot, ou `null` si le bot est injoignable / la réponse est malformée.
 * Validé contre `BotStatusSchema` avant d'être renvoyé.
 */
export async function getBotStatus(): Promise<BotStatus | null> {
  try {
    const raw = await botClient.get<unknown>("/api/status", { revalidate: 10 });
    const parsed = BotStatusSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Derniers logs du bot (`tail` entrées, optionnellement après `since`).
 * Renvoie `[]` si le bot est injoignable ou si la réponse est malformée.
 */
export async function getBotLogs(tail = 200, since?: string): Promise<LogEntry[]> {
  try {
    const params: Record<string, string> = { tail: String(tail) };
    if (since) params.since = since;
    const data = await botClient.get<unknown>("/api/logs", {
      params,
      revalidate: 0,
    });
    const parsed = BotLogsResponseSchema.safeParse(data);
    return parsed.success ? parsed.data.logs : [];
  } catch {
    return [];
  }
}

/**
 * Commandes applicatives enregistrées par le bot.
 * Renvoie `[]` si le bot est injoignable ou si la réponse est malformée.
 */
export async function getBotCommands(): Promise<BotCommand[]> {
  try {
    const data = await botClient.get<unknown>("/api/commands", {
      revalidate: 60,
    });
    const parsed = BotCommandsResponseSchema.safeParse(data);
    return parsed.success ? parsed.data.commands : [];
  } catch {
    return [];
  }
}
