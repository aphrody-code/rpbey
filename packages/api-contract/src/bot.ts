import { z } from "zod";

/**
 * Bot Discord — surface PUBLIQUE (proxy server-to-server `BOT_API_KEY`, sans session).
 *
 * Reflet exact des réponses de `apps/bot/src/lib/api-server.ts` (`/api/status`,
 * `/api/logs`, `/api/commands`), exposées par le dashboard sous `/api/v1/bot/*`.
 * Aucune table `@rpbey/db` : le domaine est db-free par nature (HTTP vers `:3001`).
 *
 * Source de vérité partagée avec `apps/web/src/lib/bot.ts` (qui re-exporte ces
 * schémas une fois ce module câblé). Toutes les dates sont des strings ISO.
 */

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

/** Statut nullable : le bot peut être injoignable (`null`). */
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
