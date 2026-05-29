/**
 * RPB - Single Part API
 * GET /api/parts/[id] - Get a single part by id or externalId (legacy ; cf. /api/v1/parts/[id]).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPartByIdOrExternalId } from "@/server/dal/parts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const part = await getPartByIdOrExternalId(id);
    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }
    return NextResponse.json({ data: part });
  } catch (error) {
    console.error("Error fetching part:", error);
    return NextResponse.json({ error: "Failed to fetch part" }, { status: 500 });
  }
}
