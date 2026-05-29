/**
 * RPB - User Matches API
 * Get match history for a specific user
 */

import { type NextRequest, NextResponse } from "next/server";
import { getUserMatchesLegacy } from "@/server/dal/users";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const { matches, total } = await getUserMatchesLegacy(userId, {
      limit,
      offset,
    });

    return NextResponse.json({
      data: matches,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error("Error fetching user matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
