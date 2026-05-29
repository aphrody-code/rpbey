/**
 * Challonge Reverse — browser-less scraper.
 *
 * Architecture:
 *   BxcTransport (FFI libcurl-impersonate, bun:ffi) — TLS+H2 fingerprint = real Chrome
 *     → bypasses Cloudflare 403
 *   HTMLRewriter (Bun native, lol-html)
 *     → extracts data-react-props payloads
 *   typed projections
 *     → LogEntriesController, StandingsController, …
 *
 * Compared to the Puppeteer-based ChallongeScraper:
 *   - 50ms per page vs ~3s
 *   - 0MB browser vs 200MB Chrome
 *   - 0 RAM leak risk vs zombie chrome processes
 *   - Survives Cloudflare ramping up vs Runtime.enable detection
 *
 * Phase 2A: uses BxcTransport directly (per-instance client with LRU
 * cache, same-origin redirect policy, cookie-jar loading) instead of the
 * module-level curlImpersonateGet singleton.  Public API surface is unchanged.
 *
 * Limitations:
 *   - Cookie session must remain valid (refresh via storage/cookies/challonge_cookie.json).
 *   - curl-impersonate chrome131 profile may need bumping every ~6 months
 *     when Cloudflare rotates fingerprint detection.
 */

import { extractReactRoots, getReactRoot, readDataAttrs } from "./extractors/react-props";
import {
  type LogEntriesProps,
  type ChallongeRawLogEntry,
  type ReactRoot,
  type StandingsProps,
} from "./extractors/react-props";
import { BxcTransport, type BxcTransportOptions, type BxcFetchOptions } from "./transports/bxc";
import { isRedirectInfo, type CurlImpersonateOptions } from "./transports/curl-impersonate-types";
import { type ScrapedLogEntry, type ScrapedStanding } from "./types";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ChallongeReverseOptions extends CurlImpersonateOptions {
  /** Default base URL. Default `https://challonge.com/fr`. */
  baseUrl?: string;
}

export interface ReversePage {
  url: string;
  status: number;
  body: string;
  reactRoots: ReactRoot[];
  /** Top-level dataset on `<body>` (`data-tournament-id` etc.). */
  bodyData: Record<string, string>;
  timeSec: number;
}

/**
 * Paginated log response. Returned by `getLogPage()` when caller needs
 * pagination metadata. `getLog()` (backward-compat) still returns
 * `ScrapedLogEntry[]` directly.
 */
export interface LogPageResult {
  entries: ScrapedLogEntry[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// ChallongeReverse
// ---------------------------------------------------------------------------

export class ChallongeReverse {
  readonly #transport: BxcTransport;
  readonly #baseUrl: string;
  readonly #fetchDefaults: BxcFetchOptions;

  constructor(options: ChallongeReverseOptions = {}) {
    this.#baseUrl = options.baseUrl ?? "https://challonge.com/fr";

    // Build BxcTransportOptions from the CurlImpersonateOptions surface.
    const transportOpts: BxcTransportOptions = {
      profile: options.profile,
      cookiePath: options.cookiePath,
      timeoutMs: options.timeoutSec != null ? options.timeoutSec * 1000 : undefined,
      followRedirects: options.followRedirects,
      maxRedirects: options.maxRedirects,
      safeRedirects: options.safeRedirects,
      extraHeaders: options.extraHeaders,
      cache: options.cache,
      log: options.log,
    };

    this.#transport = new BxcTransport(transportOpts);

    // Per-call overrides stay empty at the instance level — all config lives in
    // the transport constructor, keeping the fetch() calls lean.
    this.#fetchDefaults = {};
  }

  // ── Generic ──────────────────────────────────────────────────────────────

  /**
   * Fetch a Challonge page and return its body + parsed React roots.
   *
   * @param slug  Tournament slug (e.g. "B_TS5" or "fr/B_TS5").
   * @param sub   Optional sub-path (e.g. "/log", "/standings"). Default "".
   */
  async getPage(slug: string, sub = ""): Promise<ReversePage> {
    const url = `${this.#baseUrl}/${slug.replace(/^\//, "")}${sub}`;
    const r = await this.#transport.fetch(url, this.#fetchDefaults);

    if (isRedirectInfo(r)) {
      throw new ChallongeReverseError(
        `Cross-host redirect blocked: ${r.originalUrl} to ${r.redirectUrl}`,
        r.statusCode,
        null,
      );
    }
    if (r.status >= 400) {
      throw new ChallongeReverseError(`HTTP ${r.status} on ${url}`, r.status, r.body.slice(0, 400));
    }

    return {
      url: r.finalUrl,
      status: r.status,
      body: r.body,
      reactRoots: extractReactRoots(r.body),
      bodyData: readDataAttrs(r.body, "body"),
      timeSec: r.timeSec,
    };
  }

  // ── Specialised endpoints ────────────────────────────────────────────────

  /**
   * Activity log — the endpoint that the Challonge API v1 does NOT expose.
   *
   * Fetches `/<slug>/log` (or `/<slug>/log?page=N` when `page` is provided)
   * and returns the structured entries.  For pagination metadata use
   * `getLogPage()` instead.
   *
   * @param slug Tournament slug.
   * @param page 1-based page number. Defaults to 1 (first page).
   */
  async getLog(slug: string, page?: number): Promise<ScrapedLogEntry[]> {
    const result = await this.getLogPage(slug, page ?? 1);
    return result.entries;
  }

  /**
   * Activity log with full pagination metadata.
   *
   * Extracts `_initialStoreState['LogEntryListStore']` + `ActivityFeedSettingsStore`
   * from the HTML via HTMLRewriter / data-react-props.
   *
   * @param slug Tournament slug.
   * @param page 1-based page number. Defaults to 1.
   */
  async getLogPage(slug: string, page = 1): Promise<LogPageResult> {
    const sub = page > 1 ? `/log?page=${page}` : "/log";
    const pageData = await this.getPage(slug, sub);

    // Primary source: LogEntriesController data-react-props (SSR)
    const entriesRoot = getReactRoot<LogEntriesProps>(pageData.body, "LogEntriesController");
    let rawEntries: ChallongeRawLogEntry[] = entriesRoot?.props?.entries ?? [];

    // Fallback for current Challonge layout: data-react-props is "{}" empty,
    // the entries live in window._initialStoreState['LogEntryListStore'] as
    // a JSON array inside a <script> tag.
    const storeState = extractInitialStoreState(pageData.body);
    if (rawEntries.length === 0 && storeState) {
      const logStore = storeState["LogEntryListStore"];
      if (Array.isArray(logStore)) {
        rawEntries = logStore as ChallongeRawLogEntry[];
      }
    }

    const entries: ScrapedLogEntry[] = rawEntries.map((e) => ({
      timestamp: e.created_at ?? e.timestamp ?? "",
      type: e.type ?? e.action ?? e.key ?? "activity",
      message: e.description ?? e.message ?? "",
      who: e.user?.name ?? e.owner?.username,
      raw: e,
    }));

    // Pagination: extract from ActivityFeedSettingsStore inline script or
    // from LogEntriesController pagination sub-key (Challonge 2024+).
    let currentPage = page;
    let totalPages = 1;
    let totalCount = entries.length;

    if (storeState) {
      const feedSettings = storeState["ActivityFeedSettingsStore"];
      if (isRecord(feedSettings)) {
        const inner = isRecord(feedSettings["logEntries"])
          ? (feedSettings["logEntries"] as Record<string, unknown>)
          : feedSettings;
        currentPage = toInt(inner["currentPage"]) ?? currentPage;
        totalPages = toInt(inner["totalPages"]) ?? totalPages;
        totalCount = toInt(inner["totalCount"]) ?? totalCount;
      }

      // Fallback: some older pages put pagination in LogEntryListStore wrapper
      const logStore = storeState["LogEntryListStore"];
      if (isRecord(logStore) && totalPages === 1) {
        currentPage = toInt(logStore["currentPage"]) ?? currentPage;
        totalPages = toInt(logStore["totalPages"]) ?? totalPages;
        totalCount = toInt(logStore["totalCount"]) ?? totalCount;
      }
    }

    // If SSR props have their own pagination key (observed in some BTS fixtures)
    const propsPagination = entriesRoot?.props?.pagination;
    if (propsPagination && totalPages === 1) {
      totalCount = propsPagination.total ?? totalCount;
      const perPage = propsPagination.per_page ?? 25;
      totalPages = Math.ceil(totalCount / perPage) || 1;
      currentPage = propsPagination.page ?? currentPage;
    }

    return { entries, currentPage, totalPages, totalCount };
  }

  async getStandings(slug: string): Promise<ScrapedStanding[]> {
    const page = await this.getPage(slug, "/standings");

    // Try React root first (older Challonge layouts).
    const root = getReactRoot<StandingsProps>(page.body, "StandingsController");
    const propsStandings = root?.props?.standings ?? [];
    if (propsStandings.length > 0) {
      return propsStandings.map((s) => ({
        rank: s.rank,
        name: (s.display_name ?? s.name ?? "").trim().replace("✅", ""),
        challongeUsername: s.username ?? null,
        challongeProfileUrl: s.username ? `https://challonge.com/users/${s.username}` : null,
        wins: s.wins ?? 0,
        losses: s.losses ?? 0,
        stats: s,
      }));
    }

    // Current Challonge layout: HTML table with rank-tile + display_name + match-report trend-boxes.
    return parseStandingsTable(page.body);
  }

  /**
   * Participants page — Challonge mounts the data on
   * `<div id="participant-management" data-tournament="..." data-rankings="...">`
   * (NOT in a `data-react-props` like other pages).
   */
  async getParticipants(slug: string): Promise<{
    tournament: Record<string, unknown> | null;
    rankings: Array<Record<string, unknown>>;
    raw: Record<string, string>;
  }> {
    const page = await this.getPage(slug, "/participants");
    const raw = readDataAttrs(page.body, "#participant-management");
    return {
      tournament: parseJsonAttr<Record<string, unknown>>(raw.tournament),
      rankings: parseJsonAttr<Array<Record<string, unknown>>>(raw.rankings) ?? [],
      raw,
    };
  }

  /**
   * Public store dump (`https://challonge.com/<slug>.json`) — same payload as
   * `window._initialStoreState.TournamentStore`. Contains:
   *   - `tournament`        (settings, state, owner_ids, ...)
   *   - `matches_by_round`  (every match, keyed by round number)
   *   - `rounds`            (round metadata)
   *   - `third_place_match`, `consolation_matches`, `groups`
   *
   * This is the most complete browser-less view of the bracket.
   */
  async getStore(slug: string): Promise<{
    requested_plotter?: string;
    tournament: Record<string, unknown>;
    rounds: Array<Record<string, unknown>>;
    matches_by_round: Record<string, Array<Record<string, unknown>>>;
    third_place_match?: Record<string, unknown> | null;
    consolation_matches?: Array<Record<string, unknown>>;
    groups?: Array<Record<string, unknown>>;
  }> {
    // Use the public JSON endpoint — same payload as _initialStoreState.TournamentStore
    // but served without requiring a cookie session.
    const url = `https://challonge.com/${slug.replace(/^\//, "")}.json`;
    const r = await this.#transport.fetch(url, this.#fetchDefaults);

    if (isRedirectInfo(r)) {
      throw new ChallongeReverseError(
        `Cross-host redirect blocked: ${r.originalUrl} to ${r.redirectUrl}`,
        r.statusCode,
        null,
      );
    }
    if (r.status >= 400) {
      throw new ChallongeReverseError(`HTTP ${r.status} on ${url}`, r.status, r.body.slice(0, 400));
    }
    try {
      return JSON.parse(r.body) as {
        requested_plotter?: string;
        tournament: Record<string, unknown>;
        rounds: Array<Record<string, unknown>>;
        matches_by_round: Record<string, Array<Record<string, unknown>>>;
        third_place_match?: Record<string, unknown> | null;
        consolation_matches?: Array<Record<string, unknown>>;
        groups?: Array<Record<string, unknown>>;
      };
    } catch (err) {
      throw new ChallongeReverseError(
        `Invalid JSON on ${url}: ${(err as Error).message}`,
        r.status,
        r.body.slice(0, 400),
      );
    }
  }

  /** Raw fetch with all the React roots — useful for ad-hoc reverse work. */
  async dump(slug: string, sub = ""): Promise<ReversePage> {
    return this.getPage(slug, sub);
  }

  /** Expose the underlying transport for callers that need direct access. */
  get transport(): BxcTransport {
    return this.#transport;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseJsonAttr<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Extract `window._initialStoreState` from an inline `<script>` tag.
 *
 * Challonge embeds it as:
 *   `window._initialStoreState = {...};`
 * or:
 *   `window._initialStoreState=JSON.parse('...');`
 *
 * Returns null when not found or when the JSON cannot be parsed.
 */
function extractInitialStoreState(html: string): Record<string, unknown> | null {
  // Pattern: window._initialStoreState = { ... }; (object literal — old layout)
  const literalMatch = /window\._initialStoreState\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (literalMatch) {
    try {
      return JSON.parse(literalMatch[1]) as Record<string, unknown>;
    } catch {
      // Fall through to next pattern
    }
  }

  // Pattern: window._initialStoreState = JSON.parse('...');
  const parseMatch =
    /window\._initialStoreState\s*=\s*JSON\.parse\s*\(\s*(['"`])([\s\S]*?)\1\s*\)/.exec(html);
  if (parseMatch) {
    try {
      const raw = parseMatch[2]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Store not available — not fatal
    }
  }

  // Pattern: window._initialStoreState['KEY'] = JSON_VALUE; (current 2026 layout)
  // Multiple keyed assignments. Brace-counting parser to handle nested objects.
  const keyRe = /window\._initialStoreState\[\s*['"]([\w]+)['"]\s*\]\s*=\s*/g;
  const result: Record<string, unknown> = {};
  let m: RegExpExecArray | null;
  let foundAny = false;
  while ((m = keyRe.exec(html)) !== null) {
    const key = m[1] ?? "";
    const valueStart = m.index + m[0].length;
    // Detect array vs object start
    let i = valueStart;
    while (i < html.length && /\s/.test(html[i] ?? "")) i++;
    const opener = html[i] ?? "";
    if (opener !== "{" && opener !== "[") continue;
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
      if (ch === opener) depth++;
      else if (ch === closer) {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const raw = html.slice(valueStart, i).trim();
    try {
      result[key] = JSON.parse(raw);
      foundAny = true;
    } catch {
      // malformed JSON for this key — skip
    }
    keyRe.lastIndex = i;
  }
  return foundAny ? result : null;
}

/**
 * Parse standings from current Challonge HTML table layout.
 *
 * Each rank row :
 *   <tr>
 *     <td class='rank'><div class='rank-tile -centered -sm'><h5 class='lbl'>1</h5></div></td>
 *     <td class='white text-center display_name'><strong>Berserk91X</strong></td>
 *     <td class='text-center'><a href="https://challonge.com/fr/users/berserk91">berserk91</a></td>
 *     <td>...trend-box -win/-loss...<a class="match-report" data-match-id="..." data-match-state="complete">...</a>...</td>
 *   </tr>
 */
function parseStandingsTable(html: string): ScrapedStanding[] {
  const out: ScrapedStanding[] = [];
  // Capture each <tr>..</tr> within the standings <tbody>.
  // Avoid HTMLRewriter for nested-text aggregation simplicity.
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
    const trendBoxes = [
      ...row.matchAll(/<div[^>]+class=['"][^'"]*trend-box\s+-(\w+)[^'"]*['"][^>]*>/g),
    ];
    let wins = 0;
    let losses = 0;
    for (const t of trendBoxes) {
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ChallongeReverseError extends Error {
  constructor(
    message: string,
    public status: number,
    public bodySample: string | null,
  ) {
    super(message);
    this.name = "ChallongeReverseError";
  }
}

// ---------------------------------------------------------------------------
// Re-exports (backward compat — consumers import these from "./reverse")
// ---------------------------------------------------------------------------

// curlImpersonateGet / clearCurlCache / curlCacheStats come from the facade
// which itself delegates to BxcTransport.  We keep re-exporting them so
// that any code that does:
//   import { type curlImpersonateGet } from "@rose-griffon/challonge/reverse"
// continues to compile without changes.
export {
  curlImpersonateGet,
  isRedirectInfo,
  validateURL,
  upgradeToHttps,
  isPermittedRedirect,
  clearCurlCache,
  curlCacheStats,
  CurlImpersonateError,
  type CurlImpersonateResponse,
  type CurlImpersonateOptions,
  type RedirectInfo,
} from "./transports/curl-impersonate";
export {
  extractReactRoots,
  getReactRoot,
  readDataAttrs,
  type ReactRoot,
  type LogEntriesProps,
  type StandingsProps,
  type ParticipantsProps,
} from "./extractors/react-props";
