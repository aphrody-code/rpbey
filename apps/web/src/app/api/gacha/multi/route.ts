/**
 * POST /api/gacha/multi
 * Multi pull: 5 cards for 450 BeyCoins (10% discount), guaranteed 1 SR+
 */
import { NextResponse } from "next/server";
import type { CardRarity } from "@/lib/types";
import { executeCardPullTx, pickActiveCardByRarityTx } from "@/server/dal/gacha";
import {
  getApiUser,
  MULTI_PULL_COST,
  MULTI_PULL_COUNT,
  rollCardRarity,
  serverError,
  unauthorized,
} from "../helpers";

const SR_PLUS: CardRarity[] = ["SUPER_RARE", "LEGENDARY", "SECRET"];

export async function POST() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    // Roll all rarities + guarantee at least 1 SR+
    const rarities: CardRarity[] = Array.from({ length: MULTI_PULL_COUNT }, () => rollCardRarity());
    if (!rarities.some((r) => SR_PLUS.includes(r))) {
      rarities[MULTI_PULL_COUNT - 1] = "SUPER_RARE";
    }

    const result = await executeCardPullTx({
      userId: user.id,
      rarities,
      cost: MULTI_PULL_COST,
      type: "MULTI_PULL",
      newPityCount: 0,
      pickFn: (tx, r) => pickActiveCardByRarityTx(tx, r),
      noteFor: (cards) => `Multi-tirage ×${cards.length}`,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_PROFILE")
        return NextResponse.json({ success: false, error: "Profil introuvable" }, { status: 404 });
      if (error.message === "INSUFFICIENT_FUNDS")
        return NextResponse.json(
          {
            success: false,
            error: `Solde insuffisant (${MULTI_PULL_COST} requis)`,
          },
          { status: 400 },
        );
      if (error.message === "NO_CARDS")
        return NextResponse.json(
          { success: false, error: "Aucune carte disponible" },
          { status: 404 },
        );
    }
    return serverError(error);
  }
}
