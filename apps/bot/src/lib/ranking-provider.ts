/**
 * ranking-provider.ts
 *
 * Shared types and helpers reused by both BTS (bts-ranking.ts) and Stardust
 * (stardust-sync-bts.ts) ranking modules. Extraction avoids duplicating the
 * point-bucket map and the `getPointsConfig` DB query.
 *
 * NOTE: business values (points, thresholds, bucket keys) are UNCHANGED —
 * this is a structural refactor only.
 */

import type { PrismaClientCompat } from "./prisma.js";

// ─── Shared config type ───────────────────────────────────────────────────────

export interface RankingPointsConfig {
  participation: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  top8: number;
  matchWinWinner: number;
  matchWinLoser: number;
}

/** Canonical default config — mirrors the DB default row. */
export const DEFAULT_RANKING_CONFIG: Readonly<RankingPointsConfig> = {
  participation: 500,
  firstPlace: 10000,
  secondPlace: 7000,
  thirdPlace: 5000,
  top8: 500,
  matchWinWinner: 1000,
  matchWinLoser: 500,
};

// ─── Finish-placement bucket map ──────────────────────────────────────────────

/**
 * Maps a `finalRank` (1-based) to the corresponding `RankingPointsConfig`
 * property key. Ranks 4–8 all fall into the "top8" bucket.
 * Used by both BTS and Stardust aggregation loops.
 */
export const FINISH_BUCKET_MAP: ReadonlyMap<number, keyof RankingPointsConfig> = new Map([
  [1, "firstPlace"],
  [2, "secondPlace"],
  [3, "thirdPlace"],
  [4, "top8"],
  [5, "top8"],
  [6, "top8"],
  [7, "top8"],
  [8, "top8"],
]);

// ─── DB helper ────────────────────────────────────────────────────────────────

/**
 * Load ranking points config from the `ranking_system` table via the provided
 * Prisma client. Falls back to `DEFAULT_RANKING_CONFIG` when no row exists.
 *
 * Both bts-ranking.ts and stardust-sync-bts.ts used to inline this exact
 * query; they now delegate to this helper.
 */
export async function loadPointsConfig(
  prismaClient: PrismaClientCompat,
  overrides?: Partial<RankingPointsConfig>,
): Promise<RankingPointsConfig> {
  const row = await prismaClient.rankingSystem.findFirst();
  const base: RankingPointsConfig = row
    ? {
        participation: row.participation,
        firstPlace: row.firstPlace,
        secondPlace: row.secondPlace,
        thirdPlace: row.thirdPlace,
        top8: row.top8,
        matchWinWinner: row.matchWinWinner,
        matchWinLoser: row.matchWinLoser,
      }
    : { ...DEFAULT_RANKING_CONFIG };
  return overrides ? { ...base, ...overrides } : base;
}

// ─── Sort comparator (shared tie-breaking rule) ───────────────────────────────

export interface SortableRankEntry {
  points: number;
  tournamentWins: number;
  wins: number;
}

/**
 * Canonical sort order: points desc, tournamentWins desc, wins desc.
 * Identical in both ranking modules — centralized here.
 */
export function compareRankEntries(a: SortableRankEntry, b: SortableRankEntry): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.tournamentWins !== a.tournamentWins) return b.tournamentWins - a.tournamentWins;
  return b.wins - a.wins;
}
