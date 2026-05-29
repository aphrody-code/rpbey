/**
 * Unified snapshot → ScrapedTournament mapper (pure, bundlable).
 *
 * Fuses the two historically divergent mappers into a single superset, branched
 * by `opts`:
 *
 *   - **htmlrewriter mode** (default — no `extras`, no `withSvgCoords`):
 *     reproduces `transports/htmlrewriter.ts:snapshotToScrapedTournament` byte
 *     for byte. Uses the snapshot-derived `snap.standings`, full match field set
 *     with `bracketSide` derivation, and `full_url`-based metadata. This is the
 *     path exercised by the htmlrewriter regression golden.
 *
 *   - **scraper mode** (`extras` provided): reproduces
 *     `scraper.ts:mapSnapshotToScrapedTournament` — merges per-page participant
 *     extras + standings, applies the not-yet-complete rank guard, emits the
 *     leaner match shape, and sorts participants by `finalRank`.
 *
 *   - **SVG coords** (`withSvgCoords: true` + `bracketMatches`): additively
 *     stamps `x`/`y` onto each `ScrapedMatch` from the matching bracket SVG node.
 *
 * ZERO bxc / transport imports — input is a plain snapshot object + plain
 * options, output is plain `ScrapedTournament`. Universally bundlable (Next.js).
 *
 * @module mappers/snapshot
 */

import { parseBracketSvg, type BracketMatch } from "../scrapers/bracket-svg";
import { normalizeSets, setsToLegacyString } from "../scores";
import {
  bracketSideFromRound,
  type ScrapedLogEntry,
  type ScrapedMatch,
  type ScrapedParticipant,
  type ScrapedStanding,
  type ScrapedStation,
  type ScrapedTournament,
  type ScrapedTournamentMetadata,
} from "../types";

// ---------------------------------------------------------------------------
// Structural snapshot type
// ---------------------------------------------------------------------------

/**
 * Structural shape of `ChallongeTournamentSnapshot` (from
 * `@aphrody-code/bxc/scrapers/challonge`), re-declared locally so this module
 * carries ZERO bxc import and stays bundlable everywhere.
 *
 * Only the fields read by the two mappers are typed; everything else is left
 * open via index signatures so a real snapshot is structurally assignable.
 */
export interface SnapshotTournament {
  id: number;
  name: string | null;
  state: string;
  tournament_type: string | null;
  full_url?: string | null;
  completed_at?: string | null;
  started_at?: string | null;
  [key: string]: unknown;
}

export interface SnapshotParticipant {
  id: number;
  display_name: string | null;
  seed: number;
  challonge_username?: string | null;
  final_rank?: number | null;
  portrait_url?: string | null;
  attached_participatable_portrait_url?: string | null;
  attached_participant_portrait_url?: string | null;
  [key: string]: unknown;
}

export interface SnapshotMatch {
  id: number;
  identifier: string;
  raw_identifier?: string;
  round: number;
  player1?: { id: number | null } | null;
  player2?: { id: number | null } | null;
  winner_id: number | null;
  loser_id: number | null;
  scores?: unknown;
  games?: unknown;
  state: string;
  forfeited?: boolean | null;
  underway_at?: string | null;
  has_attachment?: boolean | null;
  [key: string]: unknown;
}

export interface SnapshotStanding {
  rank: number;
  display_name: string;
  wins: number;
  losses: number;
  final_round_reached?: unknown;
  seed?: unknown;
  [key: string]: unknown;
}

export interface ChallongeSnapshotLike {
  tournament: SnapshotTournament;
  participants: SnapshotParticipant[];
  matches: SnapshotMatch[];
  standings: SnapshotStanding[];
  matches_by_round?: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Extras shapes (scraper mode)
// ---------------------------------------------------------------------------

/**
 * Supplemental participant fields merged in scraper mode (sourced from the
 * `/participants` page). Mirrors the internal `NormalizedParticipant` shape;
 * all fields beyond `id` are optional so callers can pass partial records.
 */
export interface SnapshotParticipantExtra {
  id: number;
  display_name?: string;
  seed?: number;
  username?: string | null;
  challongeUsername?: string | null;
  challongeProfileUrl?: string | null;
  final_rank?: number | null;
  checked_in?: boolean;
  portrait_url?: string | null;
}

export interface SnapshotMapperExtras {
  /** Participants harvested from the `/participants` page. */
  participants?: SnapshotParticipantExtra[];
  /** Standings harvested from the `/standings` page (richer than snapshot-derived). */
  standings?: ScrapedStanding[];
  /** Stations harvested from the `/stations` page. */
  stations?: ScrapedStation[];
  /** Activity-feed entries harvested from the `/log` page. */
  log?: ScrapedLogEntry[];
}

export interface SnapshotMapperOptions {
  /** Canonical tournament URL. When omitted, derived from `slug` / `full_url`. */
  url?: string;
  /** Tournament slug — used to derive the URL when `url` is absent. */
  slug?: string;
  /** Bracket SVG nodes — required when `withSvgCoords` is true. */
  bracketMatches?: BracketMatch[];
  /** Extras from auxiliary pages — presence selects the rich scraper mode. */
  extras?: SnapshotMapperExtras;
  /** Stamp `x`/`y` onto each match from the matching bracket SVG node. */
  withSvgCoords?: boolean;
}

// ---------------------------------------------------------------------------
// Internal: rich scraper mode (was scraper.ts:mapSnapshotToScrapedTournament)
// ---------------------------------------------------------------------------

interface RichParticipant {
  id: number;
  display_name: string;
  seed: number;
  username: string | null;
  challongeUsername: string | null;
  challongeProfileUrl: string | null;
  final_rank: number | null;
  checked_in: boolean;
  portrait_url: string | null;
}

function toRichParticipant(p: SnapshotParticipantExtra): RichParticipant {
  const username = p.username ?? p.challongeUsername ?? null;
  return {
    id: p.id ?? 0,
    display_name: p.display_name ?? "",
    seed: p.seed ?? 0,
    username,
    challongeUsername: p.challongeUsername ?? username,
    challongeProfileUrl:
      p.challongeProfileUrl ?? (username ? `https://challonge.com/users/${username}` : null),
    final_rank: p.final_rank ?? null,
    checked_in: Boolean(p.checked_in),
    portrait_url: p.portrait_url ?? null,
  };
}

function mapRich(
  snap: ChallongeSnapshotLike,
  url: string,
  extras: SnapshotMapperExtras,
): ScrapedTournament {
  const t = snap.tournament;
  const standings = extras.standings ?? [];
  const stations = extras.stations ?? [];
  const log = extras.log ?? [];
  const participantsExtra = (extras.participants ?? []).map(toRichParticipant);

  const participantsMap = new Map<number, RichParticipant>();

  // Seed from snapshot participants (come from TournamentStore players)
  for (const p of snap.participants) {
    participantsMap.set(p.id, {
      id: p.id,
      display_name: p.display_name ?? "",
      seed: p.seed ?? 0,
      username: p.challonge_username ?? null,
      challongeUsername: p.challonge_username ?? null,
      challongeProfileUrl: p.challonge_username
        ? `https://challonge.com/users/${p.challonge_username}`
        : null,
      final_rank: p.final_rank ?? null,
      checked_in: false,
      portrait_url:
        p.portrait_url ??
        p.attached_participatable_portrait_url ??
        p.attached_participant_portrait_url ??
        null,
    });
  }

  // Merge extras from /participants page
  for (const p of participantsExtra) {
    if (p.id && p.id > 0) {
      const existing = participantsMap.get(p.id);
      if (existing) {
        existing.challongeUsername ??= p.challongeUsername;
        existing.challongeProfileUrl ??= p.challongeProfileUrl;
        existing.portrait_url ??= p.portrait_url;
      } else {
        participantsMap.set(p.id, p);
      }
    }
  }

  const standingsByName = new Map<string, ScrapedStanding>();
  for (const s of standings) standingsByName.set(s.name, s);

  const participants: ScrapedParticipant[] = Array.from(participantsMap.values()).map((p) => {
    const name = (p.display_name || "").trim().replace("✅", "");
    const std = standingsByName.get(name);
    return {
      id: p.id,
      name,
      seed: p.seed ?? 0,
      challongeUsername: std?.challongeUsername ?? p.challongeUsername ?? p.username ?? undefined,
      challongeProfileUrl:
        std?.challongeProfileUrl ??
        p.challongeProfileUrl ??
        (p.username ? `https://challonge.com/users/${p.username}` : undefined),
      portraitUrl: p.portrait_url ?? undefined,
      finalRank: std ? std.rank : (p.final_rank ?? undefined),
    };
  });

  // Sanity guard: strip ranks when tournament not yet complete
  const ranksSet = new Set(participants.map((p) => p.finalRank).filter((r) => r != null));
  if (
    ranksSet.size <= 2 &&
    participants.length > 8 &&
    (t.state === "pending" || t.state === "underway") &&
    !t.completed_at
  ) {
    for (const p of participants) p.finalRank = undefined;
  }

  const cleanMatches: ScrapedMatch[] = snap.matches.map((m) => {
    const sets = normalizeSets(m.scores);
    return {
      id: m.id,
      identifier: String(m.raw_identifier ?? m.identifier),
      round: m.round,
      player1Id: m.player1?.id ?? null,
      player2Id: m.player2?.id ?? null,
      winnerId: m.winner_id ?? null,
      loserId: m.loser_id ?? null,
      scores: setsToLegacyString(sets),
      sets,
      state: m.state,
    };
  });

  const toIso = (v: unknown): string | null => {
    if (typeof v !== "string" || v.length === 0) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const raw: Record<string, unknown> = {
    tournament: t,
    matches_by_round: snap.matches_by_round,
    participants: snap.participants,
  };

  return {
    metadata: {
      id: t.id ?? 0,
      name: t.name ?? "Tournoi Importé",
      url,
      state: t.state ?? "unknown",
      type: t.tournament_type ?? "unknown",
      participantsCount: participants.length,
      startedAt: toIso((t as unknown as Record<string, unknown>)["started_at"]),
      completedAt: toIso((t as unknown as Record<string, unknown>)["completed_at"]),
    },
    participants: participants.sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999)),
    matches: cleanMatches,
    standings,
    stations,
    log,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Internal: htmlrewriter mode (was htmlrewriter.ts:snapshotToScrapedTournament)
// ---------------------------------------------------------------------------

function mapHtmlRewriter(
  snap: ChallongeSnapshotLike,
  slug: string,
  url: string,
): ScrapedTournament {
  const t = snap.tournament;
  const tournamentType = t.tournament_type ?? "single elimination";

  // Derive the maximum positive (winners-bracket) round for GF detection.
  const maxPositiveRound = snap.matches.reduce(
    (acc, m) => (m.round > 0 && m.round > acc ? m.round : acc),
    0,
  );

  const participants: ScrapedParticipant[] = snap.participants.map((p) => ({
    id: p.id,
    name: p.display_name ?? "",
    seed: p.seed,
    challongeUsername: null,
    challongeProfileUrl: null,
    challongeUserId: null,
    emailHash: null,
    portraitUrl: p.portrait_url ?? null,
    finalRank: null,
    clinched: false,
    metadata: null,
  }));

  const matches: ScrapedMatch[] = snap.matches.map((m) => {
    // `m.games` is number[][] — each inner array is [p1Score, p2Score].
    const sets = normalizeSets(m.games);
    const round = m.round;
    return {
      id: m.id,
      identifier: m.raw_identifier ?? m.identifier,
      round,
      bracketSide: bracketSideFromRound(round, tournamentType, round === maxPositiveRound),
      player1Id: m.player1?.id ?? null,
      player2Id: m.player2?.id ?? null,
      winnerId: m.winner_id,
      loserId: m.loser_id,
      scores: setsToLegacyString(sets),
      sets,
      state: m.state,
      forfeited: m.forfeited ?? null,
      optional: null,
      startedAt: null,
      underwayAt: m.underway_at ?? null,
      completedAt: null,
      createdAt: null,
      updatedAt: null,
      attachmentCount: null,
      hasAttachment: m.has_attachment ?? null,
      suggestedPlayOrder: null,
      groupId: null,
    };
  });

  const standings: ScrapedStanding[] = snap.standings.map((s) => ({
    rank: s.rank,
    name: s.display_name,
    challongeUsername: null,
    challongeProfileUrl: null,
    wins: s.wins,
    losses: s.losses,
    stats: {
      finalRoundReached: s.final_round_reached,
      seed: s.seed,
    },
  }));

  const canonicalUrl = t.full_url ?? url;

  const metadata: ScrapedTournamentMetadata = {
    id: t.id,
    name: t.name ?? slug,
    url: canonicalUrl,
    state: t.state,
    type: tournamentType,
    participantsCount: snap.participants.length,
    startedAt: null,
    completedAt: null,
    game: null,
    subdomain: null,
  };

  return {
    metadata,
    participants,
    matches,
    standings,
    stations: [],
    log: [],
    raw: snap,
  };
}

// ---------------------------------------------------------------------------
// Public: unified mapper
// ---------------------------------------------------------------------------

/**
 * Map a Challonge tournament snapshot to the canonical {@link ScrapedTournament}.
 *
 * Behaviour is a superset selected by `opts`:
 *  - no `opts.extras` → htmlrewriter mode (snapshot-derived standings,
 *    `bracketSide` on every match, `full_url` metadata).
 *  - `opts.extras` present → scraper mode (merged participant extras + standings,
 *    rank guard, sorted participants).
 *  - `opts.withSvgCoords` + `opts.bracketMatches` → additively stamps `x`/`y`
 *    onto each match.
 *
 * @param snap  A `ChallongeTournamentSnapshot`-shaped object (structurally typed).
 * @param opts  Optional behaviour switches (see {@link SnapshotMapperOptions}).
 * @returns A fully-populated {@link ScrapedTournament}.
 */
export function snapshotToScrapedTournament(
  snap: ChallongeSnapshotLike,
  opts: SnapshotMapperOptions = {},
): ScrapedTournament {
  const slug = opts.slug ?? snap.tournament.full_url ?? String(snap.tournament.id ?? "");
  const url = opts.url ?? snap.tournament.full_url ?? `https://challonge.com/${slug}`;

  const result = opts.extras ? mapRich(snap, url, opts.extras) : mapHtmlRewriter(snap, slug, url);

  if (opts.withSvgCoords && opts.bracketMatches && opts.bracketMatches.length > 0) {
    const coordsById = new Map<number, { x: number; y: number }>();
    for (const bm of opts.bracketMatches) coordsById.set(bm.matchId, { x: bm.x, y: bm.y });
    for (const m of result.matches) {
      const c = coordsById.get(m.id);
      if (c) {
        m.x = c.x;
        m.y = c.y;
      }
    }
  }

  return result;
}

export type { BracketMatch };
export { parseBracketSvg };
