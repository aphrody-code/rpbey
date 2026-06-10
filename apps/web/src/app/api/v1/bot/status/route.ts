import { getRoute } from "@/server/api/handler";
import { BotStatusResponseSchema, getBotStatus } from "@/lib/bot";

/**
 * BFF — statut du bot Discord (proxy typé de `:3001/api/status`).
 * `status: null` si le bot est injoignable (l'enveloppe reste `{ ok: true }`).
 */
export const GET = getRoute({
  response: BotStatusResponseSchema,
  async handle() {
    const status = await getBotStatus();
    return { status };
  },
});
