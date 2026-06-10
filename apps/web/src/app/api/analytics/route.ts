import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { anonSessionId, clientIpFromHeaders, recordEvent } from "@/lib/analytics";

/**
 * Beacon endpoint for client-side pageviews + lightweight custom events.
 *
 * Called via navigator.sendBeacon() / fetch(keepalive) from AnalyticsTracker.
 * Always returns 204 quickly; persistence is best-effort and never blocks.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      type?: string;
      path?: string;
      referrer?: string;
    } | null;

    const type = body?.type ?? "pageview";
    const path = body?.path ?? null;

    const h = await headers();
    const sessionId = anonSessionId(clientIpFromHeaders(h), h.get("user-agent"));

    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: h });
      userId = session?.user?.id ?? null;
    } catch {
      /* anonymous */
    }

    await recordEvent({
      type,
      path,
      referrer: body?.referrer ?? h.get("referer"),
      sessionId,
      userId,
    });
  } catch {
    /* swallow: a failed beacon must never surface to the user */
  }

  return new NextResponse(null, { status: 204 });
}
