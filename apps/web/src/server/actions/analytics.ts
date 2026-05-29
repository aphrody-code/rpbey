"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  type AnalyticsEventType,
  anonSessionId,
  clientIpFromHeaders,
  recordEvent,
} from "@/lib/analytics";

/**
 * Server action tracker for business events fired from inside other server
 * actions / server components. Resolves the current user + an anonymous session
 * id automatically. Never throws (instrumentation must not break callers).
 */
export async function trackEvent(input: {
  type: AnalyticsEventType;
  path?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const h = await headers();
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: h });
      userId = session?.user?.id ?? null;
    } catch {
      /* unauthenticated is fine */
    }

    const sessionId = anonSessionId(clientIpFromHeaders(h), h.get("user-agent"));

    await recordEvent({
      type: input.type,
      path: input.path ?? null,
      referrer: h.get("referer"),
      sessionId,
      userId,
      meta: input.meta ?? null,
    });
  } catch (error) {
    console.error("[analytics] trackEvent failed:", error);
  }
}
