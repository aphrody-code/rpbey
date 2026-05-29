/**
 * POST /api/gacha/daily
 * Claim daily BeyCoins reward with streak bonus
 */
import { NextResponse } from "next/server";
import { db, schema, eq, sql } from "@/lib/db";
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

    const result = await db.transaction(async (tx) => {
      const profile = await tx.query.profiles.findFirst({
        where: eq(schema.profiles.userId, user.id),
        columns: { currency: true, lastDaily: true, dailyStreak: true },
      });

      if (!profile) throw new Error("NO_PROFILE");

      const now = new Date();

      // Check if already claimed today
      if (profile.lastDaily) {
        const lastDate = new Date(profile.lastDaily);
        const isSameDay =
          lastDate.getUTCFullYear() === now.getUTCFullYear() &&
          lastDate.getUTCMonth() === now.getUTCMonth() &&
          lastDate.getUTCDate() === now.getUTCDate();
        if (isSameDay) throw new Error("ALREADY_CLAIMED");
      }

      // Calculate streak
      let newStreak = 1;
      if (profile.lastDaily) {
        const hoursSince =
          (now.getTime() - new Date(profile.lastDaily).getTime()) / (1000 * 60 * 60);
        if (hoursSince < DAILY_RESET_HOURS) {
          newStreak = profile.dailyStreak + 1;
        }
      }

      // Calculate reward
      const streakBonus = Math.min((newStreak - 1) * DAILY_STREAK_BONUS, DAILY_MAX_BONUS);
      const totalAmount = DAILY_BASE_AMOUNT + streakBonus;

      // Update profile
      const [updatedProfile] = await tx
        .update(schema.profiles)
        .set({
          currency: sql`${schema.profiles.currency} + ${totalAmount}`,
          lastDaily: now.toISOString(),
          dailyStreak: newStreak,
        })
        .where(eq(schema.profiles.userId, user.id))
        .returning();

      // Log
      await tx.insert(schema.currencyTransactions).values({
        userId: user.id,
        amount: totalAmount,
        type: "DAILY_CLAIM",
        note: `Récompense quotidienne (série: ${newStreak} jours)`,
      });

      return {
        amount: totalAmount,
        streak: newStreak,
        newBalance: updatedProfile!.currency,
      };
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
