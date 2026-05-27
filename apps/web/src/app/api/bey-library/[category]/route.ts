/**
 * GET /api/bey-library/:category
 * Returns all parts for a category with optional filters
 *
 * Query params:
 *   type    - Filter by bey type (Attack, Defense, Stamina, Balance)
 *   spin    - Filter by spin direction (Right, Left)
 *   search  - Search by name, code or ID
 *   limit   - Max results (default 500)
 *   offset  - Pagination offset
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  type BeyLibraryCategory,
  CATEGORIES,
  getCategoryParts,
} from '@/lib/bey-library';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;

  if (!CATEGORIES.includes(category as BeyLibraryCategory)) {
    return NextResponse.json(
      {
        error: `Invalid category '${category}'. Valid: ${CATEGORIES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  try {
    const sp = request.nextUrl.searchParams;
    const result = await getCategoryParts(category as BeyLibraryCategory, {
      type: sp.get('type') ?? undefined,
      spin: sp.get('spin') ?? undefined,
      search: sp.get('search') ?? undefined,
      limit: sp.has('limit') ? parseInt(sp.get('limit')!, 10) : undefined,
      offset: sp.has('offset') ? parseInt(sp.get('offset')!, 10) : undefined,
    });

    return NextResponse.json({
      category,
      ...result,
    });
  } catch (error) {
    console.error(`bey-library category error (${category}):`, error);
    return NextResponse.json(
      { error: `Failed to fetch ${category} data` },
      { status: 500 },
    );
  }
}
