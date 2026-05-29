/**
 * POST /api/gacha/pull
 * Single card pull (costs 100 BeyCoins)
 */
import { NextResponse } from "next/server";
import type { CardRarity } from "@/lib/types";
import {
  executeCardPullTx,
  getProfilePityCount,
  pickActiveCardByRarityTx,
} from "@/server/dal/gacha";
import {
  getApiUser,
  PITY_THRESHOLD,
  rollCardRarity,
  SINGLE_PULL_COST,
  serverError,
  unauthorized,
} from "../helpers";

const SR_PLUS: CardRarity[] = ["SUPER_RARE", "LEGENDARY", "SECRET"];

export async function POST() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    // Roll rarity with pity system (la pity courante est lue hors transaction ;
    // la décrémentation/reset effectif est réécrit atomiquement dans le tx).
    const currentPity = (await getProfilePityCount(user.id)) ?? 0;
    let rarity = rollCardRarity();
    let newPity = currentPity + 1;
    if (newPity >= PITY_THRESHOLD && !SR_PLUS.includes(rarity)) {
      rarity = "SUPER_RARE";
      newPity = 0;
    }
    if (SR_PLUS.includes(rarity)) newPity = 0;

    const result = await executeCardPullTx({
      userId: user.id,
      rarities: [rarity],
      cost: SINGLE_PULL_COST,
      type: "GACHA_PULL",
      newPityCount: newPity,
      pickFn: (tx, r) => pickActiveCardByRarityTx(tx, r),
      noteFor: (cards) => `Tirage simple — ${cards[0]?.name ?? "?"} (${cards[0]?.rarity ?? "?"})`,
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
            error: `Solde insuffisant (${SINGLE_PULL_COST} requis)`,
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
