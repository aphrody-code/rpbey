import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, desc, eq } from "@/lib/db";

type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "SECRET";

/**
 * Determine a part's rarity based on its physical characteristics.
 * Must stay in sync with the same logic in server/actions/gacha.ts.
 */
function determinePartRarity(part: {
  type: string;
  weight: number | null;
  protrusions: number | null;
  tipType: string | null;
}): Rarity {
  if (part.type === "BLADE" || part.type === "OVER_BLADE") {
    const w = part.weight ?? 0;
    if (w >= 50) return "SECRET";
    if (w >= 42) return "LEGENDARY";
    if (w >= 35) return "EPIC";
    if (w >= 28) return "RARE";
    return "COMMON";
  }

  if (part.type === "RATCHET") {
    const protrusions = part.protrusions ?? 0;
    const w = part.weight ?? 0;
    if (protrusions >= 9 || w >= 30) return "LEGENDARY";
    if (protrusions >= 6 || w >= 25) return "EPIC";
    if (protrusions >= 4 || w >= 20) return "RARE";
    return "COMMON";
  }

  if (part.type === "BIT") {
    const tip = (part.tipType ?? "").toLowerCase();
    const specialTips = ["gear", "trans", "rubber", "metal", "gyro", "accel"];
    const isSpecial = specialTips.some((t) => tip.includes(t));
    const w = part.weight ?? 0;

    if (isSpecial && w >= 12) return "SECRET";
    if (isSpecial) return "EPIC";
    if (w >= 12) return "LEGENDARY";
    if (w >= 9) return "RARE";
    return "COMMON";
  }

  return "COMMON";
}

/**
 * GET /api/game/inventory
 *
 * Returns the authenticated user's collected parts inventory with counts and rarity.
 * Each item includes the part details and how many copies the user owns.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    const inventory = await db.query.partInventory.findMany({
      where: eq(schema.partInventory.userId, session.user.id),
      with: {
        part: {
          columns: {
            id: true,
            name: true,
            type: true,
            imageUrl: true,
            system: true,
            weight: true,
            beyType: true,
            tipType: true,
            protrusions: true,
            externalId: true,
          },
        },
      },
      orderBy: desc(schema.partInventory.obtainedAt),
    });

    const items = inventory.map((item) => ({
      partId: item.partId,
      count: item.count,
      obtainedAt: item.obtainedAt,
      part: {
        id: item.part.id,
        externalId: item.part.externalId,
        name: item.part.name,
        type: item.part.type,
        imageUrl: item.part.imageUrl,
        system: item.part.system,
        weight: item.part.weight,
        beyType: item.part.beyType,
      },
      rarity: determinePartRarity(item.part),
    }));

    // Summary stats
    const totalParts = items.reduce((sum, i) => sum + i.count, 0);
    const uniqueParts = items.length;
    const rarityCounts: Record<string, number> = {};
    for (const item of items) {
      rarityCounts[item.rarity] = (rarityCounts[item.rarity] ?? 0) + item.count;
    }

    return NextResponse.json({
      items,
      stats: {
        totalParts,
        uniqueParts,
        rarityCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching game inventory:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'inventaire" },
      { status: 500 },
    );
  }
}
