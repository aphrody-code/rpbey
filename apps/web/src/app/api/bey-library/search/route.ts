/**
 * GET /api/bey-library/search?q=dran&category=blade&type=attack&limit=20
 * Search parts across all or specific categories
 *
 * Query params:
 *   q        - Search query (required, min 2 chars)
 *   category - Filter by category
 *   type     - Filter by bey type
 *   limit    - Max results (default 50)
 */

import { type NextRequest, NextResponse } from "next/server";
import { type BeyLibraryCategory, CATEGORIES, searchParts } from "@/lib/bey-library";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required (min 2 characters)' },
      { status: 400 },
    );
  }

  const category = sp.get("category") as BeyLibraryCategory | null;
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json(
      {
        error: `Invalid category '${category}'. Valid: ${CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await searchParts(q, {
      category: category ?? undefined,
      type: sp.get("type") ?? undefined,
      limit: sp.has("limit") ? parseInt(sp.get("limit")!, 10) : undefined,
    });

    return NextResponse.json({
      query: q,
      ...result,
    });
  } catch (error) {
    console.error("bey-library search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
