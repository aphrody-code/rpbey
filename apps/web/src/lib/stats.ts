/**
 * RPB - User Stats Service
 * Computes and caches user statistics from tournament data
 */

import { db, schema, and, eq, or, gt, asc, desc, count, inArray } from "@/lib/db";
import { type LeaderboardEntry, type UserStats } from "@/lib/stats-types";

export { type LeaderboardEntry, type UserStats };

const K_FACTOR = 32; // ELO K-factor for rating changes
const STARTING_ELO = 1000;

/**
 * Calculate new ELO ratings after a match
 */
function calculateEloChange(
  winnerElo: number,
  loserElo: number,
): { winnerNew: number; loserNew: number } {
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + 10 ** ((winnerElo - loserElo) / 400));

  const winnerNew = Math.round(winnerElo + K_FACTOR * (1 - expectedWinner));
  const loserNew = Math.round(loserElo + K_FACTOR * (0 - expectedLoser));

  return { winnerNew, loserNew: Math.max(loserNew, 100) };
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    with: {
      profiles: true,
      decks: {
        with: {
          deckItems: {
            with: {
              beyblade: true,
              part_bladeId: true,
              part_ratchetId: true,
              part_bitId: true,
            },
          },
        },
      },
    },
  });

  if (!userRow) return null;

  const user = {
    ...userRow,
    profile: userRow.profiles[0] ?? null,
    decks: userRow.decks.map((d) => ({
      ...d,
      items: d.deckItems.map((it) => ({
        ...it,
        bey: it.beyblade,
        blade: it.part_bladeId,
        ratchet: it.part_ratchetId,
        bit: it.part_bitId,
      })),
    })),
  };

  // Get all matches involving this user
  const matchRows = await db.query.tournamentMatches.findMany({
    where: and(
      or(
        eq(schema.tournamentMatches.player1Id, userId),
        eq(schema.tournamentMatches.player2Id, userId),
      ),
      eq(schema.tournamentMatches.state, "complete"),
    ),
    with: {
      tournament: true,
      user_player1Id: { with: { profiles: true } },
      user_player2Id: { with: { profiles: true } },
    },
    orderBy: asc(schema.tournamentMatches.createdAt),
  });

  const matches = matchRows.map((m) => ({
    ...m,
    player1: m.user_player1Id
      ? { ...m.user_player1Id, profile: m.user_player1Id.profiles[0] ?? null }
      : null,
    player2: m.user_player2Id
      ? { ...m.user_player2Id, profile: m.user_player2Id.profiles[0] ?? null }
      : null,
  }));

  // Get tournament participations
  const participations = await db.query.tournamentParticipants.findMany({
    where: eq(schema.tournamentParticipants.userId, userId),
    with: {
      tournament: {
        with: {
          tournamentParticipants: {
            orderBy: asc(schema.tournamentParticipants.finalPlacement),
          },
        },
      },
    },
  });

  // Calculate basic stats
  const wins = matches.filter((m) => m.winnerId === userId).length;
  const losses = matches.length - wins;

  // Calculate current streak
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  const recentForm: ("W" | "L")[] = [];

  for (const match of matches.slice(-10).reverse()) {
    const won = match.winnerId === userId;
    recentForm.push(won ? "W" : "L");
  }

  for (const match of [...matches].reverse()) {
    const won = match.winnerId === userId;
    if (won) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      if (currentStreak === 0) currentStreak = tempStreak;
      tempStreak = 0;
    }
  }
  if (currentStreak === 0) currentStreak = tempStreak;

  // Use Official Stats from Profile
  const tournamentWins = user.profile?.tournamentWins || 0;
  const points = user.profile?.rankingPoints || 0;

  // Calculate ELO based on match history
  // totalWins/Losses here are dynamic from the complete matches in DB
  const eloChange = wins * 15 - losses * 15;
  const elo = STARTING_ELO + eloChange;

  // Get rank based on POINTS (Efficient Count Query)
  const [rankRow] = await db
    .select({ value: count() })
    .from(schema.profiles)
    .where(gt(schema.profiles.rankingPoints, points));
  const rank = (rankRow?.value ?? 0) + 1;

  // Analyze most used parts from active decks
  const bladeUsage: Record<string, { name: string; count: number }> = {};
  const ratchetUsage: Record<string, { name: string; count: number }> = {};
  const bitUsage: Record<string, { name: string; count: number }> = {};

  for (const deck of user.decks) {
    for (const item of deck.items) {
      // Check for direct parts (custom build)
      if (item.bladeId && item.blade) {
        if (!bladeUsage[item.bladeId])
          bladeUsage[item.bladeId] = { name: item.blade.name, count: 0 };
        const entry = bladeUsage[item.bladeId];
        if (entry) entry.count++;
      }
      if (item.ratchetId && item.ratchet) {
        if (!ratchetUsage[item.ratchetId])
          ratchetUsage[item.ratchetId] = { name: item.ratchet.name, count: 0 };
        const entry = ratchetUsage[item.ratchetId];
        if (entry) entry.count++;
      }
      if (item.bitId && item.bit) {
        if (!bitUsage[item.bitId]) bitUsage[item.bitId] = { name: item.bit.name, count: 0 };
        const entry = bitUsage[item.bitId];
        if (entry) entry.count++;
      }
    }
  }

  const mostUsedBlades = Object.entries(bladeUsage)
    .map(([partId, { name, count }]) => ({ partId, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const mostUsedRatchets = Object.entries(ratchetUsage)
    .map(([partId, { name, count }]) => ({ partId, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const mostUsedBits = Object.entries(bitUsage)
    .map(([partId, { name, count }]) => ({ partId, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Calculate rivalries
  const opponentStats: Record<string, { name: string; wins: number; losses: number }> = {};

  for (const match of matches) {
    const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
    if (!opponentId) continue;

    const opponent = match.player1Id === userId ? match.player2 : match.player1;
    const opponentName = opponent?.profile?.bladerName ?? opponent?.name ?? "Unknown";

    if (!opponentStats[opponentId]) {
      opponentStats[opponentId] = { name: opponentName, wins: 0, losses: 0 };
    }

    if (match.winnerId === userId) {
      opponentStats[opponentId].wins++;
    } else {
      opponentStats[opponentId].losses++;
    }
  }

  const rivalries = Object.entries(opponentStats)
    .map(([opponentId, { name, wins, losses }]) => ({
      opponentId,
      opponentName: name,
      wins,
      losses,
    }))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
    .slice(0, 5);

  return {
    userId,
    bladerName: user.profile?.bladerName ?? user.name ?? "Unknown",
    challongeUsername: user.profile?.challongeUsername ?? null,
    totalMatches: wins + losses,
    wins: wins,
    losses: losses,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    tournamentsPlayed: participations.length,
    tournamentsWon: tournamentWins,
    currentStreak,
    bestStreak,
    recentForm,
    rank,
    elo,
    points, // Return points
    mostUsedBlades,
    mostUsedRatchets,
    mostUsedBits,
    rivalries,
  };
}

/**
 * Get global leaderboard
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const profiles = await db.query.profiles.findMany({
    orderBy: [desc(schema.profiles.rankingPoints), desc(schema.profiles.wins)],
    limit,
    with: {
      user: true,
    },
    where: gt(schema.profiles.rankingPoints, 0),
  });

  // Compute per-user tournament participation counts (Prisma _count.tournaments)
  const userIds = profiles.map((p) => p.userId);
  const tournamentCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const rows = await db
      .select({
        userId: schema.tournamentParticipants.userId,
        value: count(),
      })
      .from(schema.tournamentParticipants)
      .where(inArray(schema.tournamentParticipants.userId, userIds))
      .groupBy(schema.tournamentParticipants.userId);
    for (const r of rows) {
      if (r.userId) tournamentCounts.set(r.userId, r.value);
    }
  }

  return profiles.map((profile, index) => ({
    userId: profile.userId,
    bladerName: profile.bladerName ?? profile.user.name ?? "Unknown",
    elo: 1000 + (profile.wins * 15 - profile.losses * 15), // Approximate ELO if not stored
    points: profile.rankingPoints,
    wins: profile.wins,
    losses: profile.losses,
    winRate:
      profile.wins + profile.losses > 0
        ? (profile.wins / (profile.wins + profile.losses)) * 100
        : 0,
    rank: index + 1,
    tournamentsPlayed: tournamentCounts.get(profile.userId) ?? 0,
    tournamentWins: profile.tournamentWins,
  }));
}

/**
 * Get head-to-head stats between two users
 */
export async function getHeadToHead(
  userId1: string,
  userId2: string,
): Promise<{
  user1Wins: number;
  user2Wins: number;
  matches: Awaited<ReturnType<typeof getH2HMatches>>;
}> {
  const matches = await getH2HMatches(userId1, userId2);

  const user1Wins = matches.filter((m) => m.winnerId === userId1).length;
  const user2Wins = matches.filter((m) => m.winnerId === userId2).length;

  return { user1Wins, user2Wins, matches };
}

async function getH2HMatches(userId1: string, userId2: string) {
  return db.query.tournamentMatches.findMany({
    where: and(
      or(
        and(
          eq(schema.tournamentMatches.player1Id, userId1),
          eq(schema.tournamentMatches.player2Id, userId2),
        ),
        and(
          eq(schema.tournamentMatches.player1Id, userId2),
          eq(schema.tournamentMatches.player2Id, userId1),
        ),
      ),
      eq(schema.tournamentMatches.state, "complete"),
    ),
    with: {
      tournament: true,
      user_player1Id: { with: { profiles: true } },
      user_player2Id: { with: { profiles: true } },
    },
    orderBy: desc(schema.tournamentMatches.createdAt),
  });
}

export { calculateEloChange, STARTING_ELO };
