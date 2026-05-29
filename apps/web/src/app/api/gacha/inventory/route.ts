/**
 * GET /api/gacha/inventory
 * Get user's card collection
 */
import { NextResponse } from "next/server";
import { getCardInventory } from "@/server/dal/gacha";
import { getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const inventory = await getCardInventory(user.id);

    return NextResponse.json({
      success: true,
      cards: inventory,
      total: inventory.length,
    });
  } catch (error) {
    return serverError(error);
  }
}
