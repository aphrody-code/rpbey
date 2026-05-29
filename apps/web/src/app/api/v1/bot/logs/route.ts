import { requireAdmin } from "@/lib/auth-utils";
import { BotLogsQuerySchema, BotLogsResponseSchema, getBotLogs } from "@/lib/bot";
import { jsonErr, jsonOk } from "@/server/api/handler";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BFF — logs du bot Discord (proxy typé de `:3001/api/logs`).
 * GATÉ ADMIN : les logs internes ne doivent pas être lisibles anonymement.
 * `tail` borné (1..2000), `since` = curseur ISO optionnel. Bot injoignable → `logs: []`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await requireAdmin())) {
    return jsonErr({ code: "forbidden", message: "Accès réservé aux administrateurs" }, 403);
  }

  const url = new URL(request.url);
  const parsed = BotLogsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return jsonErr({ code: "bad_request", message: z.prettifyError(parsed.error) }, 422);
  }

  try {
    const logs = await getBotLogs(parsed.data.tail, parsed.data.since);
    return jsonOk(BotLogsResponseSchema.parse({ logs }));
  } catch (e) {
    console.error("[api/v1/bot/logs]", e);
    return jsonErr({ code: "internal", message: "internal error" }, 500);
  }
}
