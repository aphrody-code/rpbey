import { type NextRequest } from "next/server";
import { BOT_API_KEY, getBotApiUrl } from "@/lib/bot-config";

/**
 * Server-Sent Events bridge to the bot's WebSocket.
 *
 * Client opens EventSource("/api/bot/events?topics=logs,bot-events").
 * We open a WS to ws://127.0.0.1:3001/ws?key=..., subscribe to the requested
 * topics, and forward each message as an SSE event.
 */
export async function GET(req: NextRequest) {
  if (!BOT_API_KEY) {
    return new Response("BOT_API_KEY not configured", { status: 500 });
  }

  const topics = (req.nextUrl.searchParams.get("topics") ?? "logs,bot-events,discord-events")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const wsUrl =
    getBotApiUrl().replace(/^http/, "ws") + "/ws?key=" + encodeURIComponent(BOT_API_KEY);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const ws = new WebSocket(wsUrl);
      let closed = false;
      const sseWrite = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      ws.onopen = () => {
        for (const topic of topics) {
          ws.send(JSON.stringify({ action: "subscribe", topic }));
        }
        sseWrite(JSON.stringify({ topic: "sse-ready", topics }));
      };

      ws.onmessage = (e) => {
        sseWrite(typeof e.data === "string" ? e.data : e.data.toString());
      };

      ws.onerror = () => {
        sseWrite(JSON.stringify({ topic: "sse-error" }));
      };

      ws.onclose = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Keep-alive every 25s (some proxies drop idle connections at 30s).
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(ka);
        }
      }, 25_000);

      // Close WS when the client disconnects.
      req.signal.addEventListener("abort", () => {
        clearInterval(ka);
        closed = true;
        try {
          ws.close();
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
