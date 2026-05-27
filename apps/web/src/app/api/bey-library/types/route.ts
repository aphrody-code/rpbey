/**
 * GET /api/bey-library/types
 * Returns all bey types with counts
 */

import { NextResponse } from 'next/server';
import { getTypes } from '@/lib/bey-library';

export async function GET() {
  try {
    const types = await getTypes();
    return NextResponse.json({ types });
  } catch (error) {
    console.error('bey-library types error:', error);
    return NextResponse.json({ error: 'Failed to get types' }, { status: 500 });
  }
}
