import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getAnalyticsSummary } from "@/lib/analytics";

/**
 * Admin-gated CSV export of the analytics summary snapshot.
 * Returns: pageviews counters, top pages, top referrers, recent events.
 * GET /api/admin/analytics/export
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getAnalyticsSummary();

  const rows: string[] = [];

  // Section 1 — Counters
  rows.push("# Compteurs");
  rows.push("Metrique,Valeur");
  rows.push(`"Visiteurs en direct (5 min)",${summary.liveVisitors}`);
  rows.push(`"Pages vues (aujourd'hui)",${summary.pageviewsToday}`);
  rows.push(`"Pages vues (7 jours)",${summary.pageviews7d}`);
  rows.push(`"Evenements (aujourd'hui)",${summary.eventsToday}`);
  rows.push("");

  // Section 2 — Top pages
  rows.push("# Top pages (7 jours)");
  rows.push("Page,Vues");
  for (const p of summary.topPages) {
    rows.push(`"${p.path.replace(/"/g, '""')}",${p.views}`);
  }
  rows.push("");

  // Section 3 — Top referrers
  rows.push("# Top referrers (7 jours)");
  rows.push("Referrer,Visites");
  for (const r of summary.topReferrers) {
    rows.push(`"${r.referrer.replace(/"/g, '""')}",${r.count}`);
  }
  rows.push("");

  // Section 4 — Recent events
  rows.push("# Evenements recents");
  rows.push("Id,Type,Page,UserId,Date");
  for (const e of summary.recentEvents) {
    const path = e.path ? `"${e.path.replace(/"/g, '""')}"` : "";
    const userId = e.userId ? `"${e.userId}"` : "";
    const date = new Date(e.createdAt).toLocaleString("fr-FR");
    rows.push(`"${e.id}","${e.type}",${path},${userId},"${date}"`);
  }

  const csv = rows.join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rpb-analytics-${today}.csv"`,
    },
  });
}
