/**
 * RPB - User Stats API
 * Get user statistics and leaderboard
 */

import { connection, type NextRequest, NextResponse } from 'next/server';
import { getLeaderboard, getUserStats } from '@/lib/stats';

// GET - Get stats for a specific user or leaderboard
export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') ?? 'user';
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    if (type === 'leaderboard') {
      const leaderboard = await getLeaderboard(limit);
      return NextResponse.json({ data: leaderboard });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for user stats' },
        { status: 400 },
      );
    }

    const stats = await getUserStats(userId);

    if (!stats) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
