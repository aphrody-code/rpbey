import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getAnalyticsSummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of the analytics summary for the admin dashboard.
 *
 * Admin-gated. Pushes a fresh `getAnalyticsSummary()` snapshot immediately on
 * connect, then every 10s. The client (useAnalyticsStream) renders live
 * visitors / pageviews / top pages in real time, with SWR polling as fallback.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const push = async () => {
        if (closed) return;
        try {
          const summary = await getAnalyticsSummary();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(summary)}\n\n`));
        } catch {
          /* skip this tick on error; next tick may recover */
        }
      };

      void push();
      const interval = setInterval(() => void push(), 10_000);

      // Keep-alive comment to defeat idle-proxy timeouts.
      const ka = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* ignore */
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(ka);
        try {
          controller.close();
        } catch {
          /* already closed */
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
