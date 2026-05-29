import { getRoute } from "@/server/api/handler";
import { BotLogsQuerySchema, BotLogsResponseSchema, getBotLogs } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BFF — logs du bot Discord (proxy typé de `:3001/api/logs`).
 * `tail` borné (1..2000), `since` = curseur ISO optionnel. Bot injoignable → `logs: []`.
 */
export const GET = getRoute({
  query: BotLogsQuerySchema,
  response: BotLogsResponseSchema,
  async handle({ query }) {
    const logs = await getBotLogs(query.tail, query.since);
    return { logs };
  },
});
