import { type NextRequest } from "next/server";
import type { RedisClient } from "bun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint for business events published by the bot.
 *
 * The bot publishes JSON payloads on Redis channels:
 *   rpb:events:tournament — tournament sync/finalize events
 *   rpb:events:ranking    — ranking sync completion events
 *
 * Usage: EventSource("/api/events?channels=tournament,ranking")
 * Default: all channels (tournament + ranking).
 *
 * Each SSE message:
 *   data: {"channel":"tournament","ts":1234567890,"tournamentId":"...","status":"synced"}
 *
 * This endpoint is ADDITIVE — the existing WebSocket→SSE bridge lives at
 * /api/bot/events and is unchanged.
 */

const VALID_CHANNELS = ["tournament", "ranking"] as const;
type ValidChannel = (typeof VALID_CHANNELS)[number];

export async function GET(req: NextRequest) {
  const rawChannels = req.nextUrl.searchParams.get("channels");
  const requestedChannels = rawChannels
    ? rawChannels
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [...VALID_CHANNELS];

  const channels = requestedChannels.filter((c): c is ValidChannel =>
    (VALID_CHANNELS as readonly string[]).includes(c),
  );

  if (channels.length === 0) {
    return new Response("No valid channels requested", { status: 400 });
  }

  const redisChannels = channels.map((c) => `rpb:events:${c}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Each subscription requires its own client — a subscribed client
      // cannot issue regular commands (only SUBSCRIBE/UNSUBSCRIBE/PING).
      // Le builtin `bun` ne peut pas être importé statiquement dans une route
      // Next (le "collect page data" du build échoue à le résoudre) : on passe
      // par le global `Bun` au moment de la requête (le serveur tourne sous Bun).
      const RedisClientCtor = (
        globalThis as unknown as {
          Bun: { RedisClient: new (url: string) => RedisClient };
        }
      ).Bun.RedisClient;
      const subscriber = new RedisClientCtor(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

      let closed = false;

      const sseWrite = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      // Notify client which channels are active.
      sseWrite(JSON.stringify({ topic: "sse-ready", channels }));

      // Subscribe to each channel and forward messages as SSE.
      // Bun RedisClient.subscribe(channel, listener) — listener fires on each
      // message published to that channel.
      for (const redisChannel of redisChannels) {
        subscriber
          .subscribe(redisChannel, (message: string) => {
            sseWrite(message);
          })
          .catch((err: unknown) => {
            if (!closed) {
              sseWrite(
                JSON.stringify({
                  topic: "sse-error",
                  channel: redisChannel,
                  error: String(err),
                }),
              );
            }
          });
      }

      // Keep-alive comment every 25s (prevents proxy drops at 30s idle).
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(ka);
        }
      }, 25_000);

      // Teardown when the client disconnects.
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(ka);
        try {
          subscriber.close();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
