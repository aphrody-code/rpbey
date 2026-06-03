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
} from "@aphrody/challonge";
import { resolveDefaultCookiePath } from "./utils/cookies";
import { parseInitialStoreState } from "./extractors/store-state";
import { type ChallongeSnapshotLike, snapshotToScrapedTournament } from "./mappers/snapshot";
import {
  parseStandingsTable as parseStandingsTableShared,
  storeToStandings as storeToStandingsShared,
} from "./extractors/stores/standings";
import { storeToLogEntries as storeToLogEntriesShared } from "./extractors/stores/log";
import {
  type NormalizedParticipant,
  storeToParticipants as storeToParticipantsShared,
} from "./extractors/stores/participants";
import type { Transport } from "./transports/transport";
import {
  type ScrapedLogEntry,
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

/**
 * Parse all `_initialStoreState` key assignments from a Challonge HTML page.
 * Thin facade over the shared {@link parseInitialStoreState} walker — kept as a
 * local name so the ~5 call-sites below stay untouched.
 */
function parseStoreState(html: string): Record<string, unknown> {
  return parseInitialStoreState(html);
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

/**
 * Façade over the relocated {@link storeToLogEntriesShared} extractor.
 *
 * Kept as a local name so the `fetchLog` call-sites below stay untouched. The
 * implementation (and the `LogEntryRaw` shape) now lives in
 * `extractors/stores/log.ts` (pure, bundlable, single source of truth); output
 * is identical.
 */
function storeToLogEntries(store: Record<string, unknown>): ScrapedLogEntry[] {
  return storeToLogEntriesShared(store);
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

/**
 * Façade over the unified {@link snapshotToScrapedTournament} mapper.
 *
 * Keeps the historical name/signature so the internal `scrape()` call-site stays
 * untouched. Delegates to the shared rich-mode mapper by passing `extras`
 * (presence of `extras` selects the scraper superset: merged participant extras
 * + standings, rank guard, sorted participants, leaner match shape). Output is
 * byte-for-byte identical to the former inlined implementation.
 */
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
  return snapshotToScrapedTournament(snap as unknown as ChallongeSnapshotLike, {
    url,
    extras: {
      standings: extras.standings,
      stations: extras.stations,
      log: extras.log,
      participants: extras.participantsExtra,
    },
  });
}

// ---------------------------------------------------------------------------
// Participant normalization (shared by openPage shim + scrape)
// ---------------------------------------------------------------------------

/**
 * Façade over the relocated {@link storeToParticipantsShared} extractor.
 *
 * Kept as a local name so the `fetchParticipants` call-site below stays
 * untouched. The implementation (plus `NormalizedParticipant` and
 * `normalizeParticipantRaw`) now lives in `extractors/stores/participants.ts`
 * (pure, bundlable, single source of truth); output is identical.
 */
function storeToParticipants(store: Record<string, unknown>): NormalizedParticipant[] {
  return storeToParticipantsShared(store);
}

/**
 * Façade over the unified {@link parseStandingsTableShared} parser.
 *
 * Kept as a local name so the `fetchStandings` HTML-table fallback below stays
 * untouched. The implementation now lives in `extractors/stores/standings.ts`
 * (single source of truth shared with `reverse.ts`); output is identical.
 */
function parseStandingsTable(html: string): ScrapedStanding[] {
  return parseStandingsTableShared(html);
}

/**
 * Façade over the relocated {@link storeToStandingsShared} extractor.
 *
 * Kept as a local name so the `fetchStandings` call-site below stays untouched.
 * The store-based implementation now lives alongside `parseStandingsTable` in
 * `extractors/stores/standings.ts` (pure, bundlable, single source of truth);
 * output is identical.
 */
function storeToStandings(store: Record<string, unknown>): ScrapedStanding[] {
  return storeToStandingsShared(store);
}

// ---------------------------------------------------------------------------
// ChallongeScraper
// ---------------------------------------------------------------------------

export class ChallongeScraper {
  private readonly opts: ResolvedOptions;
  private transport: Transport | null = null;
  private readonly injectedTransport: Transport | null;

  /**
   * @param options    Scraper options (cookie path, logger, legacy ignored).
   * @param transport  Optional pre-built {@link Transport} to inject. When
   *                   omitted, a {@link BxcTransport} is lazily constructed on
   *                   first use (unchanged default behaviour). Added in M2;
   *                   optional + trailing → no existing call-site breaks.
   */
  constructor(options: ChallongeScraperOptions = {}, transport?: Transport) {
    this.opts = resolveOptions(options);
    this.injectedTransport = transport ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * No-op in bxc mode — no browser to boot.
   * Returns immediately. Kept for API compatibility.
   */
  async init(): Promise<void> {
    // Intentionally empty — BxcTransport is created on first use.
  }

  /** Close the underlying transport (releases curl FFI handle for BxcTransport). */
  async close(): Promise<void> {
    if (this.transport) {
      this.transport.close?.();
      this.transport = null;
    }
  }

  // ── Transport access ─────────────────────────────────────────────────────

  private getTransport(): Transport {
    if (!this.transport) {
      if (this.injectedTransport) {
        this.transport = this.injectedTransport;
      } else {
        const tOpts: BxcTransportOptions = {
          profile: "chrome131",
          log: this.opts.log,
        };
        if (this.opts.cookiePath) tOpts.cookiePath = this.opts.cookiePath;
        this.transport = new BxcTransport(tOpts);
      }
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
 * @param slug       Tournament slug (e.g. "B_TS5", "fr/T_SS1")
 * @param sub        Sub-path: "module" | "log" | "standings" | "participants" | ""
 * @param opts       Optional { page, cookiePath }
 * @param transport  Optional pre-built {@link Transport} to inject. When omitted,
 *                   a {@link BxcTransport} is built internally and closed on exit
 *                   (unchanged default). An injected transport is NOT closed —
 *                   its lifecycle stays owned by the caller. Added in M2;
 *                   optional + trailing → no existing call-site breaks.
 *
 * Returns raw HTML, the parsed _initialStoreState map, and — when
 * sub === "module" — a fully parsed ChallongeTournamentSnapshot.
 */
export async function dumpChallongeRaw(
  slug: string,
  sub: "module" | "log" | "standings" | "participants" | "" = "",
  opts?: { page?: number; cookiePath?: string },
  transport?: Transport,
): Promise<DumpChallongeRawResult> {
  const transportOpts: BxcTransportOptions = {
    profile: "chrome131",
    cache: false, // raw dumps should not be cached
  };
  if (opts?.cookiePath) transportOpts.cookiePath = opts.cookiePath;

  const ownsTransport = !transport;
  const xport: Transport = transport ?? new BxcTransport(transportOpts);

  try {
    const cleanSlug = slug.replace("https://challonge.com/", "").replace(/^\//, "");
    let path = sub ? `${cleanSlug}/${sub}` : cleanSlug;
    if (opts?.page && opts.page > 1) path += `?page=${opts.page}`;

    const url = `https://challonge.com/${path}`;
    const resp = await xport.fetch(url);

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
    if (ownsTransport) xport.close?.();
  }
}
