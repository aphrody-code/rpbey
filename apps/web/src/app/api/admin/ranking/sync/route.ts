import { NextResponse } from "next/server";
import { syncSatrRanking } from "@/server/actions/satr";
import { syncStardustRanking } from "@/server/actions/stardust";
import { syncWbRanking } from "@/server/actions/wb";

/**
 * Sync endpoint for the 3 tournament rankings (WB / SATR / Stardust).
 *
 * Auth:
 *   Authorization: Bearer <RANKING_SYNC_TOKEN>     (env var)
 *
 * Query params:
 *   ?only=wb|satr|stardust           → sync only that one
 *   ?skip=wb,satr                    → sync everything except listed
 *
 * Response:
 *   { results: [{name, success, count?, error?}], ok: boolean }
 */

type SyncResult = {
  name: "wb" | "satr" | "stardust";
  success: boolean;
  count?: number;
  tournamentCount?: number;
  error?: string;
};

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = process.env.RANKING_SYNC_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "RANKING_SYNC_TOKEN non configuré côté serveur" },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const skip = (url.searchParams.get("skip") ?? "").split(",").filter(Boolean);

  const all: Array<{
    name: "wb" | "satr" | "stardust";
    fn: () => Promise<{
      success: boolean;
      error?: unknown;
      count?: number;
      tournamentCount?: number;
    }>;
  }> = [
    { name: "wb", fn: () => syncWbRanking() },
    { name: "satr", fn: () => syncSatrRanking() },
    { name: "stardust", fn: () => syncStardustRanking() },
  ];

  const targets = all.filter((t) => (!only || t.name === only) && !skip.includes(t.name));

  const results: SyncResult[] = [];
  for (const t of targets) {
    try {
      const r = await t.fn();
      results.push({
        name: t.name,
        success: r.success,
        count: "count" in r ? r.count : undefined,
        tournamentCount: "tournamentCount" in r ? r.tournamentCount : undefined,
        error: r.success ? undefined : typeof r.error === "string" ? r.error : String(r.error),
      });
    } catch (e) {
      results.push({ name: t.name, success: false, error: String(e) });
    }
  }

  const ok = results.every((r) => r.success);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}

export async function GET() {
  return NextResponse.json(
    {
      usage:
        "POST /api/admin/ranking/sync [?only=wb|satr|stardust] [?skip=...] with Authorization: Bearer <RANKING_SYNC_TOKEN>",
    },
    { status: 200 },
  );
}
