/**
 * GET  /api/gacha/wishlist - Get user's wishlist
 * POST /api/gacha/wishlist - Add/remove card from wishlist
 */
import { type NextRequest, NextResponse } from "next/server";
import {
  addToWishlist,
  getProfileIdByUser,
  getWishlistCards,
  removeFromWishlist,
} from "@/server/dal/gacha";
import { badRequest, getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const profileId = await getProfileIdByUser(user.id);
    if (!profileId) {
      return NextResponse.json({ success: true, cards: [] });
    }

    const cards = await getWishlistCards(profileId);
    return NextResponse.json({ success: true, cards });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { cardId, action } = body as { cardId?: string; action?: string };

    if (!cardId) return badRequest("cardId requis");

    const profileId = await getProfileIdByUser(user.id);
    if (!profileId) {
      return NextResponse.json({ success: false, error: "Profil introuvable" }, { status: 404 });
    }

    if (action === "remove") {
      await removeFromWishlist(profileId, cardId);
      return NextResponse.json({ success: true, action: "removed" });
    }

    await addToWishlist(profileId, cardId);
    return NextResponse.json({ success: true, action: "added" });
  } catch (error) {
    return serverError(error);
  }
}
