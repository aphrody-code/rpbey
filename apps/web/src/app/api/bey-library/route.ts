/**
 * GET /api/bey-library
 * Returns database overview: categories, types, stats
 */

import { NextResponse } from 'next/server';
import { getStats } from '@/lib/bey-library';

export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json({
      source: 'bey-library.vercel.app',
      ...stats,
    });
  } catch (error) {
    console.error('bey-library API error:', error);
    return NextResponse.json(
      { error: 'Failed to load bey-library data' },
      { status: 500 },
    );
  }
}
