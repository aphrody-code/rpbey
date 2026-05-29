import { getRoute } from "@/server/api/handler";
import { BotCommandsResponseSchema, getBotCommands } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BFF — commandes applicatives du bot Discord (proxy typé de `:3001/api/commands`).
 * Bot injoignable → `commands: []`.
 */
export const GET = getRoute({
  response: BotCommandsResponseSchema,
  async handle() {
    const commands = await getBotCommands();
    return { commands };
  },
});
