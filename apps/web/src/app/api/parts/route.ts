/**
 * RPB - Parts API
 * GET /api/parts - Liste toutes les pièces avec filtres
 */

import { connection, type NextRequest, NextResponse } from "next/server";
import { db, schema, and, asc, count, eq, ilike, or, type SQL } from "@/lib/db";

type PartType = (typeof schema.partType.enumValues)[number];
type BeyType = (typeof schema.beyType.enumValues)[number];

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const type = searchParams.get("type") as PartType | null;
    const beyType = searchParams.get("beyType") as BeyType | null;
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // Build where clause
    const conditions: SQL[] = [];

    if (type && schema.partType.enumValues.includes(type)) {
      conditions.push(eq(schema.parts.type, type));
    }

    if (beyType && schema.beyType.enumValues.includes(beyType)) {
      conditions.push(eq(schema.parts.beyType, beyType));
    }

    if (search) {
      const orCond = or(
        ilike(schema.parts.name, `%${search}%`),
        ilike(schema.parts.externalId, `%${search}%`),
      );
      if (orCond) conditions.push(orCond);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const take = Math.min(limit, 500);

    // Fetch parts
    const [parts, totalRows] = await Promise.all([
      db.query.parts.findMany({
        where,
        limit: take,
        offset,
        orderBy: [asc(schema.parts.type), asc(schema.parts.name)],
      }),
      db.select({ value: count() }).from(schema.parts).where(where),
    ]);

    const total = totalRows[0]?.value ?? 0;

    return NextResponse.json({
      data: parts,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + parts.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching parts:", error);
    return NextResponse.json({ error: "Failed to fetch parts" }, { status: 500 });
  }
}
