/**
 * Challonge `m.scores` is a 2-D array of integers:
 *   [[p1set1, p2set1], [p1set2, p2set2], …]
 *
 * Older code used `m.scores.join('-')` which produced misleading strings like
 * `"3,1-2,3-3,0"` (sets separated by `-`, players separated by `,`) and then
 * parsed only the first character as a single-set result.  The helpers below
 * work on the canonical 2-D structure and preserve per-set accuracy.
 */

export type SetScore = [number, number];

export function normalizeSets(raw: unknown): SetScore[] {
  if (!Array.isArray(raw)) return [];
  const out: SetScore[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) continue;
    const p1 = Number(entry[0]);
    const p2 = Number(entry[1]);
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) continue;
    out.push([Math.trunc(p1), Math.trunc(p2)]);
  }
  return out;
}

export function setsToLegacyString(sets: SetScore[]): string {
  if (sets.length === 0) return "0-0";
  return sets.map(([a, b]) => `${a}-${b}`).join(",");
}

export interface WinLoss {
  wins: number;
  losses: number;
}

/**
 * Count set wins from the point of view of player1.
 * Useful when you only need the match-level W/L from the match's player1_id/player2_id
 * and the winner_id is set (single-best-of-N series).
 */
export function sumSetWinsForPlayer1(sets: SetScore[]): WinLoss {
  let wins = 0;
  let losses = 0;
  for (const [a, b] of sets) {
    if (a > b) wins++;
    else if (b > a) losses++;
  }
  return { wins, losses };
}

/**
 * Given match sets and the player perspective (as stored in m.player1Id / m.player2Id),
 * return W/L for a specific player ID.
 */
export function sumSetWinsForPlayer(
  sets: SetScore[],
  player1Id: number | null,
  player2Id: number | null,
  targetId: number,
): WinLoss {
  if (targetId === player1Id) return sumSetWinsForPlayer1(sets);
  if (targetId === player2Id) {
    const inverted = sumSetWinsForPlayer1(sets);
    return { wins: inverted.losses, losses: inverted.wins };
  }
  return { wins: 0, losses: 0 };
}

/**
 * A match is considered "complete" if it has at least one set with a non-zero score
 * AND a winner. A walkover (scores all 0-0 but winner set) is complete but should
 * not contribute to set counts.
 */
export function isRealMatch(sets: SetScore[]): boolean {
  return sets.some(([a, b]) => a > 0 || b > 0);
}
