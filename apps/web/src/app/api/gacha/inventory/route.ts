/**
 * GET /api/gacha/inventory
 * Get user's card collection
 */
import { NextResponse } from "next/server";
import { db, schema, desc, eq } from "@/lib/db";
import { getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const inventoryRows = await db.query.cardInventory.findMany({
      where: eq(schema.cardInventory.userId, user.id),
      with: { gachaCard: true },
      orderBy: desc(schema.cardInventory.obtainedAt),
    });
    const inventory = inventoryRows.map((i) => ({ ...i, card: i.gachaCard }));

    return NextResponse.json({
      success: true,
      cards: inventory,
      total: inventory.length,
    });
  } catch (error) {
    return serverError(error);
  }
}
