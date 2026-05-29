/**
 * RPB - Parts API
 * GET /api/parts - Liste toutes les pièces avec filtres (legacy ; cf. /api/v1/parts).
 */

import { connection, type NextRequest, NextResponse } from "next/server";
import { listPartsByOffset } from "@/server/dal/parts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const beyType = searchParams.get("beyType");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const take = Math.min(limit, 500);

    const { parts, total } = await listPartsByOffset({
      type: type as never,
      beyType: beyType as never,
      search,
      limit: take,
      offset,
    });

    return NextResponse.json({
      data: parts,
      meta: { total, limit, offset, hasMore: offset + parts.length < total },
    });
  } catch (error) {
    console.error("Error fetching parts:", error);
    return NextResponse.json({ error: "Failed to fetch parts" }, { status: 500 });
  }
}
