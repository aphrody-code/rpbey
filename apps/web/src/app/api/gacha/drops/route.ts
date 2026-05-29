/**
 * GET /api/gacha/drops
 * List all gacha drops with card counts
 */
import { NextResponse } from "next/server";
import { db, schema, desc } from "@/lib/db";
import { serverError } from "../helpers";

export async function GET() {
  try {
    const drops = await db.query.gachaDrops.findMany({
      orderBy: desc(schema.gachaDrops.season),
      with: {
        gachaCards: { columns: { id: true } },
      },
    });

    return NextResponse.json({
      success: true,
      drops: drops.map(({ gachaCards, ...d }) => ({
        ...d,
        cardCount: gachaCards.length,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
