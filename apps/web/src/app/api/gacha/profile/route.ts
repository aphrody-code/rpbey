/**
 * GET /api/gacha/profile
 * Get user's TCG profile (currency, streak, stats)
 */
import { NextResponse } from "next/server";
import { getGachaProfile } from "@/server/dal/gacha";
import { getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const profile = await getGachaProfile(user.id);

    if (!profile) {
      return NextResponse.json({ success: false, error: "Profil introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        user: {
          id: user.id,
          name: user.name,
          image: user.image,
          discordTag: (user as Record<string, unknown>).discordTag,
        },
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
