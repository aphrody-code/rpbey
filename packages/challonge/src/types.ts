/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ScrapedStanding {
  rank: number;
  name: string;
  challongeUsername?: string | null;
  challongeProfileUrl?: string | null;
  wins: number;
  losses: number;
  stats: any;
}

export interface ScrapedStation {
  stationId: number | string;
  name: string;
  currentMatch?: {
    matchId: number;
    identifier: string;
    round: number;
    player1: string | null;
    player2: string | null;
    scores: string;
    sets?: number[][];
    state: string;
  } | null;
  status: "idle" | "active" | "paused";
}

export interface ScrapedLogEntry {
  timestamp: string;
  type: string;
  message: string;
  /**
   * Optional structured payload — present on synthesized logs (built from
   * match timestamps) and when a real /log entry parses cleanly.
   */
  matchId?: number;
  matchIdentifier?: string;
  who?: string;
  raw?: any;
}

export interface ScrapedParticipant {
  id: number;
  name: string;
  seed: number;
  /** Challonge ordinal_seed if present (skipped seeds for double-elim). */
  ordinalSeed?: number;
  challongeUsername?: string | null;
  challongeProfileUrl?: string | null;
  /** Persistent Challonge user id (stable across tournaments). */
  challongeUserId?: number | null;
  /** Gravatar email hash (md5) — use to build a fallback avatar URL. */
  emailHash?: string | null;
  /** Avatar hosted on Challonge CDN (from portrait_url / attached_participatable_portrait_url). */
  portraitUrl?: string | null;
  finalRank?: number | null;
  /** Already mathematically guaranteed a placement bucket. */
  clinched?: boolean;
  /** Custom-field responses (per-tournament metadata). */
  metadata?: Record<string, unknown> | null;
}

/** Which side of a double-elimination bracket the match belongs to. */
export type BracketSide = "WB" | "LB" | "GF" | "RR" | null;

export interface ScrapedMatch {
  id: number;
  identifier: string;
  /**
   * Challonge round number.
   * Positive → Winners Bracket round (1 = first WB round).
   * Negative → Losers Bracket round (-1 = first LB round).
   * 0 / very large → Grand Final.
   */
  round: number;
  /** Convenience: derived from round + bracket type. */
  bracketSide?: BracketSide;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  loserId: number | null;
  /** Legacy string "3-1-2" (kept for backward compatibility). */
  scores: string;
  /** Canonical 2-D sets: [[p1set1, p2set1], [p1set2, p2set2], …]. */
  sets: Array<[number, number]>;
  state: string;
  /** True when one player forfeited / walked over. */
  forfeited?: boolean | null;
  /** Optional in double-elim grand-final reset matches. */
  optional?: boolean | null;
  startedAt?: string | null;
  underwayAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  attachmentCount?: number | null;
  hasAttachment?: boolean | null;
  /** Suggested order of play in the bracket. */
  suggestedPlayOrder?: number | null;
  /** Round-robin group id, if applicable. */
  groupId?: number | null;
}

export interface ScrapedTournamentMetadata {
  id: number;
  name: string;
  url: string;
  state: string;
  type: string;
  participantsCount: number;
  /** ISO 8601 (started_at). */
  startedAt: string | null;
  /** ISO 8601 (completed_at). */
  completedAt: string | null;
  /** Game played (challonge "game_name"). */
  game?: string | null;
  /** Subdomain (organisation), null for personal accounts. */
  subdomain?: string | null;
}

export interface ScrapedTournament {
  metadata: ScrapedTournamentMetadata;
  participants: ScrapedParticipant[];
  matches: ScrapedMatch[];
  standings: ScrapedStanding[];
  stations: ScrapedStation[];
  log: ScrapedLogEntry[];
  raw: any;
}

// ─── Helper: bracket-side derivation ─────────────────────────────────────────

/**
 * Derive the bracket side from a match's `round` field.
 *
 * Challonge encodes:
 *  - Winners Bracket → positive rounds (1, 2, …, N)
 *  - Losers Bracket  → negative rounds (-1, -2, …, -M)
 *  - Grand Final     → max(positive) + 1, in the same row as the WB final
 *  - Round Robin / Single Elim → only positive rounds
 */
export function bracketSideFromRound(
  round: number,
  tournamentType: string,
  isLastRound = false,
): BracketSide {
  const t = tournamentType?.toLowerCase() ?? "";
  if (t.includes("round robin") || t === "round_robin") return "RR";
  if (t.includes("single") || t === "single_elimination") return "WB";
  // Double elim: rely on sign
  if (round > 0) return isLastRound ? "GF" : "WB";
  if (round < 0) return "LB";
  return null;
}

/** Build a Gravatar avatar URL from an email_hash. */
export function gravatarUrl(emailHash: string | null | undefined, size = 200): string | null {
  if (!emailHash) return null;
  return `https://gravatar.com/avatar/${emailHash}?s=${size}&d=mp`;
}
