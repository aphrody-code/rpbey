/**
 * POST /api/gacha/daily
 * Claim daily BeyCoins reward with streak bonus
 */
import { NextResponse } from "next/server";
import { claimDailyTx } from "@/server/dal/gacha";
import {
  DAILY_BASE_AMOUNT,
  DAILY_MAX_BONUS,
  DAILY_RESET_HOURS,
  DAILY_STREAK_BONUS,
  getApiUser,
  serverError,
  unauthorized,
} from "../helpers";

export async function POST() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const result = await claimDailyTx({
      userId: user.id,
      baseAmount: DAILY_BASE_AMOUNT,
      streakBonus: DAILY_STREAK_BONUS,
      maxBonus: DAILY_MAX_BONUS,
      resetHours: DAILY_RESET_HOURS,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `+${result.amount} BeyCoins ! Série de ${result.streak} jour${result.streak > 1 ? "s" : ""}.`,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_PROFILE")
        return NextResponse.json({ success: false, error: "Profil introuvable" }, { status: 404 });
      if (error.message === "ALREADY_CLAIMED")
        return NextResponse.json(
          { success: false, error: "Déjà récupéré aujourd'hui" },
          { status: 400 },
        );
    }
    return serverError(error);
  }
}
