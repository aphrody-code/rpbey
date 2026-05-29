/**
 * RPB - Single Part API
 * GET /api/parts/[id] - Get a single part by ID
 */

import { type NextRequest, NextResponse } from "next/server";
import { db, schema, eq, or } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const part = await db.query.parts.findFirst({
      where: or(eq(schema.parts.id, id), eq(schema.parts.externalId, id)),
    });

    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    return NextResponse.json({ data: part });
  } catch (error) {
    console.error("Error fetching part:", error);
    return NextResponse.json({ error: "Failed to fetch part" }, { status: 500 });
  }
}
