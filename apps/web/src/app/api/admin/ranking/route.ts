import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { getRankingSystem, insertRankingSystem, updateRankingSystem } from "@/server/dal/rankings";
import { runFullRecalculation } from "@/server/services/rankings";

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await getRankingSystem();
    return NextResponse.json(rules || {});
  } catch (error) {
    console.error("Failed to fetch ranking rules:", error);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { participation, matchWin, firstPlace, secondPlace, thirdPlace, top8 } = body;

    const data = {
      participation,
      matchWin,
      firstPlace,
      secondPlace,
      thirdPlace,
      top8,
    };
    const existing = await getRankingSystem();

    if (existing) {
      await updateRankingSystem(existing.id, data);
    } else {
      await insertRankingSystem(data);
    }

    // Déclenchement du recalcul COMPLET (global_rankings + miroir profils).
    await runFullRecalculation();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
  }
}
