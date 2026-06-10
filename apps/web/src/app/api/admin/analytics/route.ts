import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getAnalyticsSummary } from "@/lib/analytics";

/**
 * Admin-gated JSON snapshot of the analytics summary.
 * Used as the SWR polling fallback when the SSE stream is unavailable.
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await getAnalyticsSummary();
  return NextResponse.json(summary);
}
