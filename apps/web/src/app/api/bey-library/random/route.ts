/**
 * GET /api/bey-library/random?category=blade&type=attack
 * Returns a random part, optionally filtered
 */

import { type NextRequest, NextResponse } from "next/server";
import { type BeyLibraryCategory, getRandomPart } from "@/lib/bey-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  try {
    const part = await getRandomPart({
      category: (sp.get("category") as BeyLibraryCategory) ?? undefined,
      type: sp.get("type") ?? undefined,
    });

    if (!part) {
      return NextResponse.json({ error: "No parts found matching filters" }, { status: 404 });
    }

    return NextResponse.json(part);
  } catch (error) {
    console.error("bey-library random error:", error);
    return NextResponse.json({ error: "Failed to get random part" }, { status: 500 });
  }
}
