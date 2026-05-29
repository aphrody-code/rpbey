/**
 * Challonge REST API v1 client — typed, retried, rate-limit aware.
 *
 * Why this exists alongside the scraper:
 *  - The scraper is bound to a real browser + Cloudflare gates.
 *  - The API v1 (https://api.challonge.com/v1) returns the same data
 *    (tournament, participants, matches, attachments) without bot challenges.
 *  - The API DOES NOT expose `/log`, `/predictions`, `/announcements` →
 *    the scraper remains the only path for those.
 *
 * Auth: HTTP Basic with `api:<API_KEY>` (legacy v1).
 * Rate limit: 600 req / minute / token. We respect `Retry-After` on 429.
 */

import { isTransientHttpError, retry, sleep } from "./utils/retry";
import { normalizeSets, setsToLegacyString, type SetScore } from "./scores";
import {
  bracketSideFromRound,
  type ScrapedMatch,
  type ScrapedParticipant,
  type ScrapedTournament,
  type ScrapedTournamentMetadata,
} from "./types";

// ─── Raw v1 shapes ───────────────────────────────────────────────────────────

export interface ChallongeApiParticipant {
  id: number;
  tournament_id?: number;
  name?: string;
  display_name?: string;
  username?: string | null;
  challonge_username?: string | null;
  challonge_user_id?: number | null;
  email_hash?: string | null;
  seed?: number | null;
  ordinal_seed?: number | null;
  active?: boolean;
  checked_in?: boolean;
  checked_in_at?: string | null;
  final_rank?: number | null;
  portrait_url?: string | null;
  /**
   * Note: Challonge field is `attached_participatable_portrait_url`,
   * NOT `attached_participant_*`. Earlier versions of this lib used the
   * wrong key and silently lost portraits.
   */
  attached_participatable_portrait_url?: string | null;
  /** Legacy / mistyped field — kept for tolerance. */
  attached_participant_portrait_url?: string | null;
  group_id?: number | null;
  group_player_ids?: number[];
  clinch?: string | null;
  metadata?: Record<string, unknown> | null;
  custom_field_response?: Record<string, unknown> | null;
}

export interface ChallongeApiMatch {
  id: number;
  tournament_id?: number;
  identifier?: string;
  /** Positive = WB, negative = LB, > max_wb = GF in double elim. */
  round?: number;
  state: string;
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  loser_id: number | null;
  scores_csv?: string | null;
  scores?: unknown;
  forfeited?: boolean | null;
  optional?: boolean | null;
  has_attachment?: boolean | null;
  attachment_count?: number | null;
  started_at?: string | null;
  underway_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  scheduled_time?: string | null;
  location?: string | null;
  suggested_play_order?: number | null;
  prerequisite_match_ids_csv?: string | null;
  player1_prereq_match_id?: number | null;
  player2_prereq_match_id?: number | null;
  player1_is_prereq_match_loser?: boolean;
  player2_is_prereq_match_loser?: boolean;
  group_id?: number | null;
}

export interface ChallongeApiTournament {
  id: number;
  name: string;
  url: string;
  full_challonge_url?: string;
  state: string;
  tournament_type: string;
  participants_count: number;
  game_name?: string;
  started_at: string | null;
  completed_at: string | null;
  subdomain?: string | null;
  /** When include_participants=1. */
  participants?: Array<{ participant: ChallongeApiParticipant }>;
  /** When include_matches=1. */
  matches?: Array<{ match: ChallongeApiMatch }>;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ChallongeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "ChallongeApiError";
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface ChallongeApiOptions {
  apiKey?: string;
  baseUrl?: string;
  /** User-Agent sent on every request. */
  userAgent?: string;
  /** ms — abort a single request if it stalls. Default 30_000. */
  requestTimeoutMs?: number;
  /** Max retries on 429/5xx. Default 4. */
  maxRetries?: number;
  /** Hook for logging. */
  onRequest?: (info: { method: string; url: string; attempt: number }) => void;
}

export class ChallongeApi {
  readonly apiKey: string;
  readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly onRequest?: ChallongeApiOptions["onRequest"];

  constructor(options: ChallongeApiOptions = {}) {
    const apiKey = options.apiKey ?? process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      throw new Error("ChallongeApi: missing API key (set options.apiKey or CHALLONGE_API_KEY).");
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.challonge.com/v1";
    this.userAgent = options.userAgent ?? "rpb-challonge/2 (+https://rpbey.fr)";
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 4;
    this.onRequest = options.onRequest;
  }

  private get authHeader(): string {
    return "Basic " + btoa(`api:${this.apiKey}`);
  }

  private async request<T>(
    method: string,
    path: string,
    init: {
      query?: Record<string, string | number | undefined>;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    return retry(
      async (attempt) => {
        this.onRequest?.({ method, url: url.toString(), attempt });
        const ctl = new AbortController();
        const timeout = setTimeout(() => ctl.abort(), this.requestTimeoutMs);
        const externalAbort = () => ctl.abort();
        init.signal?.addEventListener("abort", externalAbort, { once: true });

        try {
          const resp = await fetch(url.toString(), {
            method,
            headers: {
              Authorization: this.authHeader,
              "User-Agent": this.userAgent,
              Accept: "application/json",
            },
            signal: ctl.signal,
          });

          if (resp.status === 429) {
            const ra = Number(resp.headers.get("retry-after") ?? 0);
            if (ra > 0) await sleep(ra * 1000, init.signal);
            const body = await resp.text().catch(() => "");
            throw new ChallongeApiError("Rate limited", 429, body);
          }
          if (!resp.ok) {
            const body = await resp.text().catch(() => "");
            const err = new ChallongeApiError(
              `HTTP ${resp.status} ${resp.statusText} on ${method} ${url.pathname}`,
              resp.status,
              body,
            );
            throw err;
          }
          return (await resp.json()) as T;
        } finally {
          clearTimeout(timeout);
          init.signal?.removeEventListener("abort", externalAbort);
        }
      },
      {
        attempts: this.maxRetries,
        baseDelayMs: 600,
        maxDelayMs: 20_000,
        shouldRetry: (err) => isTransientHttpError(err),
        signal: init.signal,
      },
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Get a tournament by id, slug, or `subdomain-slug`.
   * @example get("17779621") // by id (preferred)
   * @example get("B_TS4")    // by url slug (only if visible to your token)
   * @example get("rpb-foo")  // subdomain-prefixed
   */
  async get(
    idOrSlug: string | number,
    opts: {
      includeParticipants?: boolean;
      includeMatches?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<ChallongeApiTournament> {
    const { includeParticipants = true, includeMatches = true, signal } = opts;
    const json = await this.request<{ tournament: ChallongeApiTournament }>(
      "GET",
      `/tournaments/${idOrSlug}.json`,
      {
        query: {
          include_participants: includeParticipants ? 1 : 0,
          include_matches: includeMatches ? 1 : 0,
        },
        signal,
      },
    );
    return json.tournament;
  }

  /** List tournaments visible to the API key. */
  async list(
    opts: {
      state?: "all" | "pending" | "in_progress" | "ended";
      type?: string;
      subdomain?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<ChallongeApiTournament[]> {
    const arr = await this.request<Array<{ tournament: ChallongeApiTournament }>>(
      "GET",
      `/tournaments.json`,
      {
        query: { state: opts.state, type: opts.type, subdomain: opts.subdomain },
        signal: opts.signal,
      },
    );
    return arr.map((x) => x.tournament);
  }

  /**
   * Convert API v1 response to the canonical ScrapedTournament shape so
   * downstream consumers (`bts.ts`, `recalculateRankings`) can stay agnostic
   * about which transport was used.
   *
   * @param opts.synthesizeLog Build `log[]` from match timestamps (the API
   *   doesn't expose `/log`, but `started_at`/`completed_at` give us a
   *   semantically equivalent timeline).
   */
  toCanonical(
    t: ChallongeApiTournament,
    opts: { synthesizeLog?: boolean } = {},
  ): ScrapedTournament {
    const partsRaw = (t.participants ?? []).map((p) => p.participant);
    const matchesRaw = (t.matches ?? []).map((m) => m.match);

    const maxPositiveRound = matchesRaw.reduce(
      (acc, m) => (m.round != null && m.round > acc ? m.round : acc),
      0,
    );

    const participants: ScrapedParticipant[] = partsRaw
      .map((p) => ({
        id: p.id,
        name: (p.display_name ?? p.name ?? "").trim().replace("✅", ""),
        seed: p.seed ?? 0,
        ordinalSeed: p.ordinal_seed ?? undefined,
        challongeUsername: p.username ?? p.challonge_username ?? null,
        challongeProfileUrl: p.username ? `https://challonge.com/users/${p.username}` : null,
        challongeUserId: p.challonge_user_id ?? null,
        emailHash: p.email_hash ?? null,
        portraitUrl:
          p.portrait_url ??
          // Correct field name. The legacy `attached_participant_*` typo is
          // tolerated for forward-compat.
          p.attached_participatable_portrait_url ??
          p.attached_participant_portrait_url ??
          null,
        finalRank: p.final_rank ?? null,
        clinched: !!p.clinch,
        metadata: (p.custom_field_response ?? p.metadata ?? null) as Record<string, unknown> | null,
      }))
      .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999));

    const byId = new Map<number, ScrapedParticipant>();
    for (const p of participants) byId.set(p.id, p);

    const matches: ScrapedMatch[] = matchesRaw.map((m) => {
      const sets = parseScores(m);
      const round = m.round ?? 0;
      return {
        id: m.id,
        identifier: m.identifier ?? "",
        round,
        bracketSide: bracketSideFromRound(round, t.tournament_type, round === maxPositiveRound),
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        winnerId: m.winner_id,
        loserId: m.loser_id,
        scores: setsToLegacyString(sets),
        sets,
        state: m.state,
        forfeited: m.forfeited ?? null,
        optional: m.optional ?? null,
        startedAt: m.started_at ?? null,
        underwayAt: m.underway_at ?? null,
        completedAt: m.completed_at ?? null,
        createdAt: m.created_at ?? null,
        updatedAt: m.updated_at ?? null,
        attachmentCount: m.attachment_count ?? null,
        hasAttachment: m.has_attachment ?? null,
        suggestedPlayOrder: m.suggested_play_order ?? null,
        groupId: m.group_id ?? null,
      };
    });

    const metadata: ScrapedTournamentMetadata = {
      id: t.id,
      name: t.name,
      url: t.full_challonge_url ?? `https://challonge.com/${t.url}`,
      state: t.state,
      type: t.tournament_type,
      participantsCount: t.participants_count,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      game: t.game_name ?? null,
      subdomain: t.subdomain ?? null,
    };

    const log = opts.synthesizeLog ? synthesizeLogFromMatches(matches, byId) : [];

    return {
      metadata,
      participants,
      matches,
      standings: [],
      stations: [],
      log,
      raw: t,
    };
  }
}

/**
 * Build a chronologically-sorted activity log from match timestamps.
 *
 * Each completed match emits two entries: "match started" and "match completed",
 * each with the player names + score. The result is sorted oldest → newest, so
 * downstream consumers can render a UI timeline equivalent to Challonge's `/log`
 * page WITHOUT going through the Cloudflare-protected scraper.
 */
export function synthesizeLogFromMatches(
  matches: ScrapedMatch[],
  participants: Map<number, ScrapedParticipant>,
) {
  const out: Array<{
    timestamp: string;
    type: string;
    message: string;
    matchId: number;
    matchIdentifier: string;
    who?: string;
  }> = [];

  const nameOf = (id: number | null): string => {
    if (id == null) return "?";
    return participants.get(id)?.name ?? `#${id}`;
  };

  for (const m of matches) {
    const p1 = nameOf(m.player1Id);
    const p2 = nameOf(m.player2Id);
    if (m.startedAt) {
      out.push({
        timestamp: m.startedAt,
        type: "match_started",
        matchId: m.id,
        matchIdentifier: m.identifier,
        message: `Match ${m.identifier} (R${m.round}): ${p1} vs ${p2} démarré`,
      });
    }
    if (m.completedAt && m.winnerId != null) {
      const winner = nameOf(m.winnerId);
      const loser = winner === p1 ? p2 : p1;
      out.push({
        timestamp: m.completedAt,
        type: "match_completed",
        matchId: m.id,
        matchIdentifier: m.identifier,
        who: winner,
        message: `Match ${m.identifier} (R${m.round}): ${winner} bat ${loser} ${m.scores || "—"}${m.forfeited ? " (forfait)" : ""}`,
      });
    }
  }

  out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return out;
}

/**
 * Parses Challonge scores from either `scores_csv` ("3-1,2-3") or the legacy
 * 2-D array form. Returns canonical SetScore[].
 */
function parseScores(m: ChallongeApiMatch): SetScore[] {
  if (typeof m.scores_csv === "string" && m.scores_csv.length > 0) {
    const out: SetScore[] = [];
    for (const part of m.scores_csv.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // "3-1" → [3,1]. Negative scores like "-1" exist for forfeits.
      const match = trimmed.match(/^(-?\d+)-(-?\d+)$/);
      if (!match) continue;
      out.push([Number(match[1]), Number(match[2])]);
    }
    if (out.length > 0) return out;
  }
  return normalizeSets(m.scores);
}
