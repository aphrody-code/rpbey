/**
 * GET /api/bey-library/:category/:id
 * Returns full detail for a specific part (specs, variants, images)
 */

import { type NextRequest, NextResponse } from "next/server";
import { type BeyLibraryCategory, CATEGORIES, getPartDetail } from "@/lib/bey-library";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ category: string; id: string }> },
) {
  const { category, id } = await params;

  if (!CATEGORIES.includes(category as BeyLibraryCategory)) {
    return NextResponse.json(
      {
        error: `Invalid category '${category}'. Valid: ${CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const detail = await getPartDetail(category as BeyLibraryCategory, id);

    if (!detail) {
      return NextResponse.json(
        { error: `Part '${id}' not found in category '${category}'` },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error(`bey-library detail error (${category}/${id}):`, error);
    return NextResponse.json({ error: `Failed to fetch part ${id}` }, { status: 500 });
  }
}
