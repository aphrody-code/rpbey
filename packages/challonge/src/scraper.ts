/**
 * Challonge HTML scraper — bxc shim (Phase 2C).
 *
 * Replaces the Puppeteer/puppeteer-extra/rebrowser stack with BxcTransport
 * (curl-impersonate Chrome 131 via bun:ffi).  No Chromium is launched.
 *
 * Public API is unchanged:
 *   - ChallongeScraper (class)
 *   - ChallongeScraperOptions (type)
 *   - ScrapeOptions (interface)
 *
 * Legacy Puppeteer-style options (headless, viewport, blockResources,
 * useRebrowser, navigationTimeoutMs) are accepted but silently ignored with
 * a warn log — callers need not change their option objects.
 *
 * New public export:
 *   - dumpChallongeRaw(slug, sub, opts?) — low-level HTML + store dump
 */

import { BxcTransport, type BxcTransportOptions } from "./transports/bxc";
import { CurlImpersonateError, isRedirectInfo } from "./transports/curl-impersonate-types";
import {
  extractChallongeTournament,
  type ChallongeTournamentSnapshot,
} from "@aphrody-code/bxc/scrapers/challonge";
import { resolveDefaultCookiePath } from "./utils/cookies";
import { normalizeSets, setsToLegacyString } from "./scores";
import {
  type ScrapedLogEntry,
  type ScrapedMatch,
  type ScrapedParticipant,
  type ScrapedStanding,
  type ScrapedStation,
  type ScrapedTournament,
} from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ChallongeScraperOptions =
  | string
  | {
      /** Absolute path to the Challonge cookie jar JSON. */
      cookiePath?: string;
      /** Override the User-Agent (accepted but forwarded to BxcTransport). */
      userAgent?: string;
      /**
       * Legacy options — accepted for backwards compatibility but silently ignored.
       * BxcTransport uses curl-impersonate; no browser is launched.
       */
      useRebrowser?: boolean;
      headless?: boolean | "shell" | "new";
      viewport?: { width: number; height: number };
      blockResources?: boolean;
      navigationTimeoutMs?: number;
      /** Logger hook. */
      log?: (msg: string) => void;
    };

export interface ScrapeOptions {
  withStandings?: boolean;
  withStations?: boolean;
  withLog?: boolean;
  withParticipants?: boolean;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// FakePage — mimics Puppeteer.Page for legacy callers
// ---------------------------------------------------------------------------

/**
 * Returned by `openPage(url)`.  Provides `content()`, `evaluate()`,
 * `waitForFunction()`, `waitForSelector()`, and `close()`.
 *
 * `evaluate()` supports only the `() => window._initialStoreState` token
 * (returns the parsed store map).  Any other expression throws a clear error.
 */
export interface FakePage {
  content(): Promise<string>;
  evaluate(fn: unknown): Promise<unknown>;
  waitForFunction(expr: unknown, opts?: { timeout?: number }): Promise<void>;
  waitForSelector(sel: string, opts?: { timeout?: number }): Promise<void>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const QUIET_LOG: (msg: string) => void = () => {};

// Regex to extract all window._initialStoreState['KEY'] = {...}; assignments.
// Non-greedy on the value — works for Challonge's inline JSON (no nested
// unescaped braces in top-level assignments).
const STORE_STATE_RE =
  /window\._initialStoreState\[['"](\w+)['"]\]\s*=\s*(\{[\s\S]*?\});\s*(?:window\._initialStoreState|\s*$|<\/script>)/g;

/** Parse all _initialStoreState key assignments from a Challonge HTML page. */
function parseStoreState(html: string): Record<string, unknown> {
  // Use a line-oriented approach: split on "window._initialStoreState" markers,
  // parse each JSON value individually.
  const result: Record<string, unknown> = {};

  // Match pattern: window._initialStoreState['KEY'] = JSON_VALUE;
  // JSON value ends at the first ";" that is followed by optional whitespace
  // and another window._initialStoreState or </script>
  const keyRe = /window\._initialStoreState\[['"](\w+)['"]\]\s*=\s*/g;
  let m: RegExpExecArray | null;

  while ((m = keyRe.exec(html)) !== null) {
    const key = m[1] ?? "";
    const valueStart = m.index + m[0].length;

    // Detect opener (object or array). Challonge serializes some stores as
    // arrays directly, e.g. _initialStoreState['LogEntryListStore'] = [...].
    let i = valueStart;
    while (i < html.length && /\s/.test(html[i] ?? "")) i++;
    const opener = html[i] ?? "";
    if (opener !== "{" && opener !== "[") {
      keyRe.lastIndex = i;
      continue;
    }
    const closer = opener === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escape = false;
    for (; i < html.length; i++) {
      const ch = html[i] ?? "";
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escape = true;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === opener) {
        depth++;
      } else if (ch === closer) {
        depth--;
        if (depth === 0) {
          i++; // include the closing "}" or "]"
          break;
        }
      }
    }

    const raw = html.slice(valueStart, i).trim();
    try {
      result[key] = JSON.parse(raw);
    } catch {
      // malformed JSON for this key — skip silently
    }

    // Advance keyRe past the value we just consumed
    keyRe.lastIndex = i;
  }

  // Suppress unused variable warning (the const above was for documentation)
  void STORE_STATE_RE;

  return result;
}

interface ResolvedOptions {
  cookiePath: string | null;
  log: (msg: string) => void;
}

function resolveOptions(opts: ChallongeScraperOptions = {}): ResolvedOptions {
  const o = typeof opts === "string" ? { cookiePath: opts } : opts;

  // Warn about legacy options that are no longer meaningful
  const legacyIgnored: Array<keyof typeof o> = [
    "headless",
    "viewport",
    "blockResources",
    "useRebrowser",
    "navigationTimeoutMs",
  ];
  const logFn: (msg: string) => void = o.log ?? QUIET_LOG;
  for (const key of legacyIgnored) {
    if (key in o && o[key as keyof typeof o] !== undefined) {
      logFn(
        `[ChallongeScraper] warn: option "${key}" is ignored in bxc mode (no browser launched)`,
      );
    }
  }

  return {
    cookiePath: o.cookiePath ?? resolveDefaultCookiePath(),
    log: logFn,
  };
}

// ---------------------------------------------------------------------------
// Activity feed (log) parsing helpers
// ---------------------------------------------------------------------------

interface ActivityFeedSettings {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

interface LogEntryRaw {
  created_at?: string;
  timestamp?: string;
  date?: string;
  type?: string;
  action?: string;
  event_type?: string;
  message?: string;
  description?: string;
  text?: string;
  [key: string]: unknown;
}

function storeToLogEntries(store: Record<string, unknown>): ScrapedLogEntry[] {
  // Current Challonge layout (2026): _initialStoreState['LogEntryListStore'] = [...] directly
  const directArray = store["LogEntryListStore"];
  if (Array.isArray(directArray)) {
    const entries = directArray as LogEntryRaw[];
    return entries.map((entry) => ({
      timestamp: entry.created_at ?? entry.timestamp ?? entry.date ?? "",
      type:
        entry.type ??
        entry.action ??
        entry.event_type ??
        (entry as Record<string, unknown>)["key"]?.toString() ??
        "activity",
      message: entry.description ?? entry.message ?? entry.text ?? "",
      raw: entry,
    }));
  }

  // Legacy layout: wrapped in { entries: [...] } or { log: [...] }
  const ls =
    (store["LogEntryListStore"] as Record<string, unknown> | null) ??
    (store["LogStore"] as Record<string, unknown> | null) ??
    (store["ActivityStore"] as Record<string, unknown> | null);

  const rawEntries =
    (ls?.["entries"] as LogEntryRaw[] | null) ??
    (ls?.["log"] as LogEntryRaw[] | null) ??
    ((store["TournamentStore"] as Record<string, unknown> | null)?.["log"] as
      | LogEntryRaw[]
      | null) ??
    ((store["TournamentStore"] as Record<string, unknown> | null)?.["activity_log"] as
      | LogEntryRaw[]
      | null);

  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return [];

  return rawEntries.map((entry) => ({
    timestamp: entry.created_at ?? entry.timestamp ?? entry.date ?? "",
    type: entry.type ?? entry.action ?? entry.event_type ?? "unknown",
    message: entry.message ?? entry.description ?? entry.text ?? JSON.stringify(entry),
    raw: entry,
  }));
}

function activityFeedSettings(store: Record<string, unknown>): ActivityFeedSettings | null {
  const s = store["ActivityFeedSettingsStore"] as Record<string, unknown> | null;
  if (!s) return null;
  // Current Challonge layout (2026): pagination nested under `logEntries` key.
  // Older layout: flat at the root of ActivityFeedSettingsStore.
  const inner =
    s["logEntries"] && typeof s["logEntries"] === "object"
      ? (s["logEntries"] as Record<string, unknown>)
      : s;
  const cur = Number(inner["currentPage"] ?? inner["current_page"] ?? 1);
  const tot = Number(inner["totalPages"] ?? inner["total_pages"] ?? 1);
  const cnt = Number(inner["totalCount"] ?? inner["total_count"] ?? 0);
  return { currentPage: cur, totalPages: tot, totalCount: cnt };
}

// ---------------------------------------------------------------------------
// Snapshot -> ScrapedTournament mapper
// ---------------------------------------------------------------------------

function mapSnapshotToScrapedTournament(
  snap: ChallongeTournamentSnapshot,
  url: string,
  extras: {
    standings: ScrapedStanding[];
    stations: ScrapedStation[];
    log: ScrapedLogEntry[];
    participantsExtra: NormalizedParticipant[];
  },
): ScrapedTournament {
  const t = snap.tournament;
  const participantsMap = new Map<number, NormalizedParticipant>();

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
  for (const p of extras.participantsExtra) {
    if (p.id && p.id > 0) {
      const existing = participantsMap.get(p.id);
      if (existing) {
        // Merge supplemental fields
        existing.challongeUsername ??= p.challongeUsername;
        existing.challongeProfileUrl ??= p.challongeProfileUrl;
        existing.portrait_url ??= p.portrait_url;
      } else {
        participantsMap.set(p.id, p);
      }
    }
  }

  const standingsByName = new Map<string, ScrapedStanding>();
  for (const s of extras.standings) standingsByName.set(s.name, s);

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
    !snap.tournament.completed_at
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
      startedAt: toIso((snap.tournament as unknown as Record<string, unknown>)["started_at"]),
      completedAt: toIso((snap.tournament as unknown as Record<string, unknown>)["completed_at"]),
    },
    participants: participants.sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999)),
    matches: cleanMatches,
    standings: extras.standings,
    stations: extras.stations,
    log: extras.log,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Participant normalization (shared by openPage shim + scrape)
// ---------------------------------------------------------------------------

interface NormalizedParticipant {
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

function normalizeParticipantRaw(p: Record<string, unknown>): NormalizedParticipant {
  const data = (p["participant"] as Record<string, unknown>) ?? p;
  const username =
    (data["username"] as string | null) ?? (data["challonge_username"] as string | null) ?? null;
  return {
    id: (data["id"] as number) ?? 0,
    display_name:
      (data["display_name"] as string) ??
      (data["name"] as string) ??
      (data["username"] as string) ??
      "",
    seed: (data["seed"] as number) ?? 0,
    username,
    challongeUsername: username,
    challongeProfileUrl: username ? `https://challonge.com/users/${username}` : null,
    final_rank: (data["final_rank"] as number | null) ?? null,
    checked_in: Boolean(data["checked_in"]),
    portrait_url:
      (data["portrait_url"] as string | null) ??
      (data["attached_participatable_portrait_url"] as string | null) ??
      (data["attached_participant_portrait_url"] as string | null) ??
      null,
  };
}

/** Extract participants from a /participants page store. */
function storeToParticipants(store: Record<string, unknown>): NormalizedParticipant[] {
  const ts = store["TournamentStore"] as Record<string, unknown> | null;
  const ps = store["ParticipantsStore"] as Record<string, unknown> | null;

  const candidates: unknown[] =
    (ts?.["participants"] as unknown[] | null) ??
    ((ts?.["tournament"] as Record<string, unknown> | null)?.["participants"] as
      | unknown[]
      | null) ??
    (ps?.["participants"] as unknown[] | null) ??
    (Array.isArray(ps) ? ps : null) ??
    [];

  return (candidates as Record<string, unknown>[]).map(normalizeParticipantRaw);
}

/**
 * Parse standings from current Challonge HTML table layout (no _initialStoreState).
 * Each <tr> has rank-tile + display_name strong + match-report trend-boxes (-win/-loss).
 */
function parseStandingsTable(html: string): ScrapedStanding[] {
  const out: ScrapedStanding[] = [];
  const tbodyMatch = /<tbody>([\s\S]+?)<\/tbody>/.exec(html);
  if (!tbodyMatch) return out;
  const tbody = tbodyMatch[1] ?? "";
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tbody)) !== null) {
    const row = m[1] ?? "";
    const rankMatch = /<h5[^>]*class=['"][^'"]*lbl[^'"]*['"][^>]*>\s*(\d+)/.exec(row);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1] ?? "0", 10);
    const nameMatch =
      /<td[^>]*class=['"][^'"]*display_name[^'"]*['"][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/.exec(
        row,
      );
    const rawName = (nameMatch?.[1] ?? "").trim();
    const name = rawName.replace(/[✅✅]/g, "").trim();
    const userMatch =
      /<a[^>]+href=["']https:\/\/challonge\.com\/(?:[a-z]{2}\/)?users\/([^"']+)["'][^>]*>([^<]+)/.exec(
        row,
      );
    const challongeUsername = userMatch?.[1] ?? null;
    let wins = 0;
    let losses = 0;
    for (const t of row.matchAll(/<div[^>]+class=['"][^'"]*trend-box\s+-(\w+)[^'"]*['"][^>]*>/g)) {
      const verdict = t[1] ?? "";
      if (verdict === "win") wins++;
      else if (verdict === "loss") losses++;
    }
    out.push({
      rank,
      name,
      challongeUsername,
      challongeProfileUrl: challongeUsername
        ? `https://challonge.com/users/${challongeUsername}`
        : null,
      wins,
      losses,
      stats: { rank, name, wins, losses, challongeUsername },
    });
  }
  return out;
}

/** Extract standings from a /standings page store. */
function storeToStandings(store: Record<string, unknown>): ScrapedStanding[] {
  const ss = store["StandingsStore"] as Record<string, unknown> | null;
  const ts = store["TournamentStore"] as Record<string, unknown> | null;

  const raw: unknown[] =
    (ss?.["standings"] as unknown[] | null) ?? (ts?.["standings"] as unknown[] | null) ?? [];

  return (raw as Record<string, unknown>[]).map((s, i) => ({
    rank: (s["rank"] as number) ?? (s["final_rank"] as number) ?? i + 1,
    name: ((s["display_name"] as string) ?? (s["name"] as string) ?? "").trim().replace("✅", ""),
    challongeUsername:
      (s["username"] as string | null) ?? (s["challonge_username"] as string | null) ?? null,
    challongeProfileUrl: (s["username"] as string | null)
      ? `https://challonge.com/users/${s["username"] as string}`
      : null,
    wins: (s["wins"] as number) ?? (s["match_wins"] as number) ?? 0,
    losses: (s["losses"] as number) ?? (s["match_losses"] as number) ?? 0,
    stats: s,
  }));
}

// ---------------------------------------------------------------------------
// ChallongeScraper
// ---------------------------------------------------------------------------

export class ChallongeScraper {
  private readonly opts: ResolvedOptions;
  private transport: BxcTransport | null = null;

  constructor(options: ChallongeScraperOptions = {}) {
    this.opts = resolveOptions(options);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * No-op in bxc mode — no browser to boot.
   * Returns immediately. Kept for API compatibility.
   */
  async init(): Promise<void> {
    // Intentionally empty — BxcTransport is created on first use.
  }

  /** Close the underlying BxcTransport (releases curl FFI handle). */
  async close(): Promise<void> {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
  }

  // ── Transport access ─────────────────────────────────────────────────────

  private getTransport(): BxcTransport {
    if (!this.transport) {
      const tOpts: BxcTransportOptions = {
        profile: "chrome131",
        log: this.opts.log,
      };
      if (this.opts.cookiePath) tOpts.cookiePath = this.opts.cookiePath;
      this.transport = new BxcTransport(tOpts);
    }
    return this.transport;
  }

  // ── openPage — legacy/internal shim ─────────────────────────────────────

  /**
   * Returns a FakePage that mimics Puppeteer.Page.
   *
   * Callers that only use `content()`, `evaluate(() => window._initialStoreState)`,
   * `waitForFunction()`, `waitForSelector()`, and `close()` will work unchanged.
   *
   * `evaluate(<arbitrary JS>)` throws `CurlImpersonateError` with a clear message.
   *
   * Visibility is intentionally `public` so cast-to-unknown callers in rpb-bot
   * can call `(scraper as unknown as { openPage(...) }).openPage(url)`.
   */
  async openPage(url: string, _signal?: AbortSignal): Promise<FakePage> {
    this.opts.log(`[ChallongeScraper] openPage: GET ${url}`);
    const transport = this.getTransport();
    const resp = await transport.fetch(url);

    // RedirectInfo shape guard
    if (isRedirectInfo(resp)) {
      throw new CurlImpersonateError(
        `openPage: cross-origin redirect detected for ${url} -> ${resp.redirectUrl}`,
        resp.statusCode,
        null,
      );
    }

    const html: string = resp.body;
    const log = this.opts.log;

    // Parse store lazily (only on evaluate)
    let cachedStore: Record<string, unknown> | null = null;
    const getStore = (): Record<string, unknown> => {
      if (!cachedStore) cachedStore = parseStoreState(html);
      return cachedStore;
    };

    const page: FakePage = {
      async content(): Promise<string> {
        return html;
      },

      async evaluate(fn: unknown): Promise<unknown> {
        // Support the two forms used by callers:
        //   1. Function: () => window._initialStoreState
        //   2. String expression containing "window._initialStoreState"

        const fnStr = typeof fn === "function" ? fn.toString() : typeof fn === "string" ? fn : "";

        const isStoreAccess =
          fnStr.includes("window._initialStoreState") || fnStr.includes("_initialStoreState");

        if (isStoreAccess) {
          return getStore();
        }

        throw new CurlImpersonateError(
          `page.evaluate(<arbitrary JS>) is not supported in bxc mode — use dumpChallongeRaw(slug, sub) instead`,
          null,
          null,
        );
      },

      async waitForFunction(_expr: unknown, _opts?: { timeout?: number }): Promise<void> {
        log(`[ChallongeScraper] waitForFunction is a no-op in bxc mode`);
      },

      async waitForSelector(_sel: string, _opts?: { timeout?: number }): Promise<void> {
        log(`[ChallongeScraper] waitForSelector is a no-op in bxc mode`);
      },

      async close(): Promise<void> {
        // no-op
      },
    };

    return page;
  }

  // ── extractStore (private) ───────────────────────────────────────────────

  /**
   * Fetch the /module page, run extractChallongeTournament, and return
   * the snapshot.
   */
  private async extractStore(
    slug: string,
    _signal?: AbortSignal,
  ): Promise<ChallongeTournamentSnapshot> {
    const url = `https://challonge.com/${slug}/module`;
    this.opts.log(`[ChallongeScraper] extractStore: GET ${url}`);
    const transport = this.getTransport();
    const resp = await transport.fetch(url);
    if (isRedirectInfo(resp)) {
      throw new CurlImpersonateError(
        `extractStore: unexpected redirect for ${url}`,
        resp.statusCode,
        null,
      );
    }
    if (resp.status === 403 || resp.status === 429 || resp.status >= 500) {
      throw new CurlImpersonateError(
        `extractStore: HTTP ${resp.status} for ${url}`,
        resp.status,
        resp.body.slice(0, 200),
      );
    }
    return extractChallongeTournament(resp.body, { url });
  }

  // ── Log fetcher (paginated) ──────────────────────────────────────────────

  private async fetchLog(slug: string, signal?: AbortSignal): Promise<ScrapedLogEntry[]> {
    const baseUrl = `https://challonge.com/${slug}/log`;
    const transport = this.getTransport();
    const allEntries: ScrapedLogEntry[] = [];

    // Fetch first page to determine totalPages
    this.opts.log(`[ChallongeScraper] fetchLog: GET ${baseUrl}?page=1`);
    const firstResp = await transport.fetch(`${baseUrl}?page=1`);
    if (isRedirectInfo(firstResp) || firstResp.status >= 400) return [];

    const firstStore = parseStoreState(firstResp.body);
    const firstEntries = storeToLogEntries(firstStore);
    allEntries.push(...firstEntries);

    const settings = activityFeedSettings(firstStore);
    const totalPages = settings?.totalPages ?? 1;

    // Fetch remaining pages in parallel (up to 12 for safety)
    const remaining = Math.min(totalPages, 12) - 1;
    if (remaining > 0) {
      const pageNums = Array.from({ length: remaining }, (_, i) => i + 2);
      await Promise.all(
        pageNums.map(async (pageNum) => {
          if (signal?.aborted) return;
          const url = `${baseUrl}?page=${pageNum}`;
          this.opts.log(`[ChallongeScraper] fetchLog: GET ${url}`);
          try {
            const resp = await transport.fetch(url);
            if (isRedirectInfo(resp) || resp.status >= 400) return;
            const store = parseStoreState(resp.body);
            const entries = storeToLogEntries(store);
            allEntries.push(...entries);
          } catch (err) {
            this.opts.log(
              `[ChallongeScraper] fetchLog page ${pageNum} error: ${(err as Error).message}`,
            );
          }
        }),
      );
    }

    return allEntries;
  }

  // ── Participants fetcher ─────────────────────────────────────────────────

  private async fetchParticipants(
    slug: string,
    _signal?: AbortSignal,
  ): Promise<NormalizedParticipant[]> {
    const url = `https://challonge.com/${slug}/participants`;
    this.opts.log(`[ChallongeScraper] fetchParticipants: GET ${url}`);
    const transport = this.getTransport();
    const resp = await transport.fetch(url);
    if (isRedirectInfo(resp) || resp.status >= 400) return [];
    const store = parseStoreState(resp.body);
    return storeToParticipants(store);
  }

  // ── Standings fetcher ────────────────────────────────────────────────────

  private async fetchStandings(slug: string, _signal?: AbortSignal): Promise<ScrapedStanding[]> {
    const url = `https://challonge.com/${slug}/standings`;
    this.opts.log(`[ChallongeScraper] fetchStandings: GET ${url}`);
    const transport = this.getTransport();
    const resp = await transport.fetch(url);
    if (isRedirectInfo(resp) || resp.status >= 400) return [];
    const store = parseStoreState(resp.body);
    const fromStore = storeToStandings(store);
    if (fromStore.length > 0) return fromStore;
    // Current Challonge layout: HTML table fallback (rank-tile + display_name + trend-box)
    return parseStandingsTable(resp.body);
  }

  // ── Main scrape ──────────────────────────────────────────────────────────

  async scrape(urlIdOrSlug: string, options: ScrapeOptions = {}): Promise<ScrapedTournament> {
    const {
      withStandings = true,
      withStations = true,
      withLog = true,
      withParticipants = true,
      signal,
    } = options;

    const slug = urlIdOrSlug.replace("https://challonge.com/", "").replace(/^\//, "");
    const baseUrl = `https://challonge.com/${slug}`;
    this.opts.log(`[ChallongeScraper] scrape: ${slug}`);

    // /module is always fetched (provides TournamentStore)
    const snap = await this.extractStore(slug, signal);

    // Parallel fetches for optional sections
    let participantsExtra: NormalizedParticipant[] = [];
    let standings: ScrapedStanding[] = [];
    const stations: ScrapedStation[] = []; // /stations not yet ported — return empty
    let log: ScrapedLogEntry[] = [];

    const tasks: Array<Promise<void>> = [];

    if (withParticipants) {
      tasks.push(
        this.fetchParticipants(slug, signal)
          .then((d) => {
            participantsExtra = d;
          })
          .catch((err) =>
            this.opts.log(`[ChallongeScraper] /participants error: ${(err as Error).message}`),
          ),
      );
    }

    if (withStandings) {
      tasks.push(
        this.fetchStandings(slug, signal)
          .then((d) => {
            standings = d;
          })
          .catch((err) =>
            this.opts.log(`[ChallongeScraper] /standings error: ${(err as Error).message}`),
          ),
      );
    }

    if (withStations) {
      // /stations page is not yet ported — log and skip
      this.opts.log(`[ChallongeScraper] /stations not yet supported in bxc mode, returning []`);
    }

    if (withLog) {
      tasks.push(
        this.fetchLog(slug, signal)
          .then((d) => {
            log = d;
          })
          .catch((err) =>
            this.opts.log(`[ChallongeScraper] /log error: ${(err as Error).message}`),
          ),
      );
    }

    await Promise.all(tasks);

    return mapSnapshotToScrapedTournament(snap, baseUrl, {
      standings,
      stations,
      log,
      participantsExtra,
    });
  }
}

// ---------------------------------------------------------------------------
// dumpChallongeRaw — public low-level dump function
// ---------------------------------------------------------------------------

export interface DumpChallongeRawResult {
  html: string;
  store: Record<string, unknown>;
  parsed: ChallongeTournamentSnapshot | null;
}

/**
 * Low-level HTML + store dump for a Challonge page sub-path.
 *
 * @param slug  Tournament slug (e.g. "B_TS5", "fr/T_SS1")
 * @param sub   Sub-path: "module" | "log" | "standings" | "participants" | ""
 * @param opts  Optional { page, cookiePath }
 *
 * Returns raw HTML, the parsed _initialStoreState map, and — when
 * sub === "module" — a fully parsed ChallongeTournamentSnapshot.
 */
export async function dumpChallongeRaw(
  slug: string,
  sub: "module" | "log" | "standings" | "participants" | "" = "",
  opts?: { page?: number; cookiePath?: string },
): Promise<DumpChallongeRawResult> {
  const transportOpts: BxcTransportOptions = {
    profile: "chrome131",
    cache: false, // raw dumps should not be cached
  };
  if (opts?.cookiePath) transportOpts.cookiePath = opts.cookiePath;

  const transport = new BxcTransport(transportOpts);

  try {
    const cleanSlug = slug.replace("https://challonge.com/", "").replace(/^\//, "");
    let path = sub ? `${cleanSlug}/${sub}` : cleanSlug;
    if (opts?.page && opts.page > 1) path += `?page=${opts.page}`;

    const url = `https://challonge.com/${path}`;
    const resp = await transport.fetch(url);

    if (isRedirectInfo(resp)) {
      throw new CurlImpersonateError(
        `dumpChallongeRaw: unexpected redirect ${url} -> ${resp.redirectUrl}`,
        resp.statusCode,
        null,
      );
    }

    const html = resp.body;
    const store = parseStoreState(html);

    let parsed: ChallongeTournamentSnapshot | null = null;
    if (sub === "module") {
      try {
        parsed = extractChallongeTournament(html, { url });
      } catch {
        // TournamentStore not found — return null parsed
      }
    }

    return { html, store, parsed };
  } finally {
    transport.close();
  }
}
