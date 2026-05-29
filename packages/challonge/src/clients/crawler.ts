/**
 * Challonge crawler — polite, frontier-driven orchestration (P4).
 *
 * Drives the full per-tournament scrape as a small, ordered frontier of public
 * Challonge routes and assembles a single canonical {@link ScrapedTournament}:
 *
 *   1. `/{slug}/module`           — source of truth. The embedded
 *      `_initialStoreState['TournamentStore']` is turned into the full match
 *      graph by the canonical `extractChallongeTournament` (bxc), giving real
 *      participant ids, signed round numbers and per-game scores.
 *   2. `/{slug}/log?page=N`       — activity feed, paginated. Page count is read
 *      from `ActivityFeedSettingsStore`; entries via the P3 `storeToLogEntries`.
 *   3. `/{slug}/standings`        — richer standings via the P3 store extractor,
 *      with the HTML-table parser (`parseStandingsTable`) as the fallback.
 *   4. `/{slug}/participants`     — participant extras via the P3
 *      `storeToParticipants` extractor.
 *
 * The four pages are merged by the unified, bxc-free
 * {@link snapshotToScrapedTournament} mapper (scraper / "extras" mode). This
 * module re-uses every P3 extractor verbatim and re-implements NONE of the
 * extraction logic — it only sequences the fetches, applies politeness/retry/
 * dedup/abort, and hands the harvested pieces to the shared mapper.
 *
 * Politeness:
 *   - `await sleep(pacingMs)` between same-host requests (default 4000ms).
 *   - Visited-URL dedup `Set` — a URL is never fetched twice.
 *   - Transient failures (403/429/5xx) retried via `utils/retry`.
 *   - `AbortSignal` honoured at every await boundary (throws `AbortError`).
 *   - Optional `onEvent` mirrors the transport's flat-record convention with
 *     `crawler.page` / `crawler.retry` kinds.
 *
 * Consumed only by `apps/bot` (Bun runtime → bxc:ffi available). The default
 * transport is a {@link BxcTransport}; an injected {@link Transport} is never
 * closed by the crawler (its lifecycle stays with the caller).
 *
 * @module clients/crawler
 */

import {
  extractChallongeTournament,
  type ChallongeTournamentSnapshot,
} from "@aphrody-code/bxc/scrapers/challonge";
import { type ChallongeSnapshotLike, snapshotToScrapedTournament } from "../mappers/snapshot";
import { parseInitialStoreState } from "../extractors/store-state";
import { parseStandingsTable, storeToStandings } from "../extractors/stores/standings";
import { type NormalizedParticipant, storeToParticipants } from "../extractors/stores/participants";
import { storeToLogEntries } from "../extractors/stores/log";
import { parseOrgLanding } from "../extractors/stores/org-landing";
import { BxcTransport } from "../transports/bxc";
import type { Transport } from "../transports/transport";
import { isRedirectInfo } from "../transports/curl-impersonate-types";
import { AbortError, isTransientHttpError, retry, sleep } from "../utils/retry";
import {
  type ScrapedLogEntry,
  type ScrapedOrg,
  type ScrapedStanding,
  type ScrapedStation,
  type ScrapedTournament,
} from "../types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Section identifiers the crawler can fetch, in canonical frontier order. */
export type CrawlSection = "module" | "log" | "standings" | "participants";

/** Flat observability event emitted by the crawler (mirrors `TransportEvent`). */
export interface CrawlEvent {
  /** `'crawler.page'` (a page was fetched) or `'crawler.retry'` (an attempt failed). */
  kind: "crawler.page" | "crawler.retry";
  /** The URL the event concerns. */
  url: string;
  /** Logical section the URL belongs to. */
  section?: CrawlSection | "org";
  /** HTTP status, when known. */
  status?: number;
  /** Retry attempt number (`crawler.retry` only). */
  attempt?: number;
  /** Error message (`crawler.retry` only). */
  error?: string;
  [k: string]: unknown;
}

export interface CrawlOptions {
  /**
   * Transport to use. Defaults to a fresh {@link BxcTransport} (cookie jar
   * auto-discovered, Chrome 131 TLS). An injected transport is reused as-is and
   * NEVER closed by the crawler.
   */
  transport?: Transport;
  /**
   * Sections to crawl, in the order given. Defaults to the full frontier
   * `['module', 'log', 'standings', 'participants']`. `'module'` is always
   * fetched first when present (it is the snapshot source); a `sections` list
   * that omits `'module'` yields a metadata-only snapshot built from whatever
   * auxiliary pages were requested.
   */
  sections?: CrawlSection[];
  /** Delay in ms between same-host requests. Default 4000. */
  pacingMs?: number;
  /** Hard cap on `/log` pages fetched. Default 12. */
  maxLogPages?: number;
  /** Cancel the crawl mid-flight. */
  signal?: AbortSignal;
  /** Structured observability hook. */
  onEvent?: (e: CrawlEvent) => void;
  /** Locale prefix used when building URLs (e.g. `'fr'`). Default `'fr'`. */
  lang?: string;
}

// ---------------------------------------------------------------------------
// Defaults / constants
// ---------------------------------------------------------------------------

const DEFAULT_PACING_MS = 4000;
const DEFAULT_MAX_LOG_PAGES = 12;
const DEFAULT_LANG = "fr";
const DEFAULT_SECTIONS: CrawlSection[] = ["module", "log", "standings", "participants"];

const RETRY_OPTS = {
  attempts: 4,
  baseDelayMs: 800,
  maxDelayMs: 15_000,
  shouldRetry: (err: unknown) => isTransientHttpError(err),
} as const;

/** Thrown for a non-transient HTTP status so `retry`'s predicate can classify it. */
class CrawlHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CrawlHttpError";
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** Strip a full Challonge URL / leading slash / locale prefix down to a bare slug. */
function normalizeSlug(input: string): string {
  let s = input.replace(/^https?:\/\/(?:[a-z0-9_-]+\.)?challonge\.com\//i, "").replace(/^\/+/, "");
  // Drop a trailing sub-path (module/log/standings/participants) if a full path was passed.
  s = s.replace(/\/(module|log|standings|participants)(?:\?.*)?$/i, "");
  return s.replace(/\/+$/, "");
}

/** Build `https://challonge.com/[lang/]<slug>[/sub]`, never double-prefixing the locale. */
function pageUrl(slug: string, sub: CrawlSection | "", lang: string): string {
  const hasLocale = /^[a-z]{2}(?:[-_][A-Za-z]{2})?\//.test(slug);
  const prefix = lang && !hasLocale ? `${lang}/` : "";
  const base = `https://challonge.com/${prefix}${slug}`;
  return sub === "" || sub === "module" ? `${base}/module` : `${base}/${sub}`;
}

// ---------------------------------------------------------------------------
// Frontier state (per crawl)
// ---------------------------------------------------------------------------

class Frontier {
  readonly #transport: Transport;
  readonly #pacingMs: number;
  readonly #signal: AbortSignal | undefined;
  readonly #onEvent: ((e: CrawlEvent) => void) | undefined;
  readonly #visited = new Set<string>();
  #didFetch = false;

  constructor(opts: {
    transport: Transport;
    pacingMs: number;
    signal?: AbortSignal;
    onEvent?: (e: CrawlEvent) => void;
  }) {
    this.#transport = opts.transport;
    this.#pacingMs = opts.pacingMs;
    this.#signal = opts.signal;
    this.#onEvent = opts.onEvent;
  }

  /**
   * Politely fetch `url` once. Returns the response body, or `null` when the URL
   * was already visited, the response was a cross-host redirect, or a non-2xx
   * non-transient status was returned. Transient statuses (403/429/5xx) are
   * retried; abort is honoured throughout.
   */
  async get(url: string, section: CrawlSection | "org"): Promise<string | null> {
    if (this.#signal?.aborted) throw new AbortError();
    if (this.#visited.has(url)) return null;
    this.#visited.add(url);

    // Pace between same-host requests (skipped before the very first fetch).
    if (this.#didFetch) await sleep(this.#pacingMs, this.#signal);
    this.#didFetch = true;

    const body = await retry(async (attempt) => {
      if (this.#signal?.aborted) throw new AbortError();
      const resp = await this.#transport.fetch(url);
      if (isRedirectInfo(resp)) {
        // Cross-host redirect — treat as a soft miss, do not retry.
        throw new CrawlHttpError(`redirect ${url} -> ${resp.redirectUrl}`, resp.statusCode);
      }
      if (resp.status === 403 || resp.status === 429 || resp.status >= 500) {
        this.#onEvent?.({
          kind: "crawler.retry",
          url,
          section,
          status: resp.status,
          attempt,
        });
        throw new CrawlHttpError(`HTTP ${resp.status} for ${url}`, resp.status);
      }
      if (resp.status >= 400) {
        // 4xx (other than 403/429) — permanent miss, no retry.
        throw new CrawlHttpError(`HTTP ${resp.status} for ${url}`, resp.status);
      }
      this.#onEvent?.({
        kind: "crawler.page",
        url,
        section,
        status: resp.status,
      });
      return resp.body;
    }, RETRY_OPTS).catch((err: unknown) => {
      if (err instanceof AbortError) throw err;
      // Soft-fail an auxiliary/permanent miss: the caller decides what is fatal.
      return null;
    });

    return body;
  }

  visitedCount(): number {
    return this.#visited.size;
  }
}

// ---------------------------------------------------------------------------
// Section fetchers (pure orchestration — extraction delegated to P3)
// ---------------------------------------------------------------------------

/** Activity-feed pagination, read from `ActivityFeedSettingsStore` (both layouts). */
function activityFeedTotalPages(store: Record<string, unknown>): number {
  const s = store["ActivityFeedSettingsStore"] as Record<string, unknown> | null;
  if (!s) return 1;
  const inner =
    s["logEntries"] && typeof s["logEntries"] === "object"
      ? (s["logEntries"] as Record<string, unknown>)
      : s;
  const tot = Number(inner["totalPages"] ?? inner["total_pages"] ?? 1);
  return Number.isFinite(tot) && tot > 0 ? tot : 1;
}

/** Crawl the paginated `/log` feed, harvesting entries via `storeToLogEntries`. */
async function crawlLog(
  frontier: Frontier,
  slug: string,
  lang: string,
  maxLogPages: number,
): Promise<ScrapedLogEntry[]> {
  const base = pageUrl(slug, "log", lang);
  const first = await frontier.get(`${base}?page=1`, "log");
  if (first == null) return [];

  const firstStore = parseInitialStoreState(first);
  const entries: ScrapedLogEntry[] = [...storeToLogEntries(firstStore)];

  const totalPages = Math.min(activityFeedTotalPages(firstStore), maxLogPages);
  // Pages are crawled sequentially to keep the per-host pacing honest.
  for (let page = 2; page <= totalPages; page++) {
    const body = await frontier.get(`${base}?page=${page}`, "log");
    if (body == null) continue;
    entries.push(...storeToLogEntries(parseInitialStoreState(body)));
  }
  return entries;
}

/** Crawl `/standings`, preferring the store extractor, HTML-table as fallback. */
async function crawlStandings(
  frontier: Frontier,
  slug: string,
  lang: string,
): Promise<ScrapedStanding[]> {
  const body = await frontier.get(pageUrl(slug, "standings", lang), "standings");
  if (body == null) return [];
  const fromStore = storeToStandings(parseInitialStoreState(body));
  if (fromStore.length > 0) return fromStore;
  return parseStandingsTable(body);
}

/** Crawl `/participants`, harvesting extras via `storeToParticipants`. */
async function crawlParticipants(
  frontier: Frontier,
  slug: string,
  lang: string,
): Promise<NormalizedParticipant[]> {
  const body = await frontier.get(pageUrl(slug, "participants", lang), "participants");
  if (body == null) return [];
  return storeToParticipants(parseInitialStoreState(body));
}

// ---------------------------------------------------------------------------
// Public: crawlTournament
// ---------------------------------------------------------------------------

/**
 * Crawl a single Challonge tournament into a canonical {@link ScrapedTournament}.
 *
 * Orchestrates the frontier `/module` → `/log` → `/standings` → `/participants`
 * (subset/order controlled by {@link CrawlOptions.sections}), assembling the
 * result via the shared {@link snapshotToScrapedTournament} mapper. Re-uses the
 * P3 extractors verbatim — no extraction logic is re-implemented here.
 *
 * @param slug  Tournament slug, full URL, or locale-prefixed slug (normalised).
 * @param opts  See {@link CrawlOptions}.
 * @returns The assembled tournament (participants + matches populated from the
 *          `/module` snapshot; standings/log merged from the auxiliary pages).
 */
export async function crawlTournament(
  slug: string,
  opts: CrawlOptions = {},
): Promise<ScrapedTournament> {
  const cleanSlug = normalizeSlug(slug);
  const lang = opts.lang ?? DEFAULT_LANG;
  const pacingMs = opts.pacingMs ?? DEFAULT_PACING_MS;
  const maxLogPages = opts.maxLogPages ?? DEFAULT_MAX_LOG_PAGES;
  const sections = opts.sections ?? DEFAULT_SECTIONS;

  const ownsTransport = !opts.transport;
  const transport: Transport = opts.transport ?? new BxcTransport({ profile: "chrome131" });

  const frontier = new Frontier({
    transport,
    pacingMs,
    signal: opts.signal,
    onEvent: opts.onEvent,
  });

  try {
    const want = new Set(sections);
    const moduleUrl = pageUrl(cleanSlug, "module", lang);
    const canonicalUrl = `https://challonge.com/${
      /^[a-z]{2}(?:[-_][A-Za-z]{2})?\//.test(cleanSlug) ? cleanSlug : `${lang}/${cleanSlug}`
    }`;

    // 1) /module — snapshot source (always first when requested).
    let snapshot: ChallongeTournamentSnapshot | null = null;
    if (want.has("module")) {
      const moduleHtml = await frontier.get(moduleUrl, "module");
      if (moduleHtml != null) {
        try {
          snapshot = extractChallongeTournament(moduleHtml, { url: moduleUrl });
        } catch {
          snapshot = null;
        }
      }
    }

    // 2-4) Auxiliary sections (sequential — pacing is enforced by the frontier).
    let log: ScrapedLogEntry[] = [];
    let standings: ScrapedStanding[] = [];
    let participantsExtra: NormalizedParticipant[] = [];
    const stations: ScrapedStation[] = []; // /stations not yet crawled — empty.

    for (const section of sections) {
      if (opts.signal?.aborted) throw new AbortError();
      if (section === "log") log = await crawlLog(frontier, cleanSlug, lang, maxLogPages);
      else if (section === "standings") standings = await crawlStandings(frontier, cleanSlug, lang);
      else if (section === "participants")
        participantsExtra = await crawlParticipants(frontier, cleanSlug, lang);
    }

    // Assemble. When the module snapshot is missing (private / cookie wall), fall
    // back to a minimal snapshot so the auxiliary harvest is still surfaced.
    const snap: ChallongeSnapshotLike = (snapshot as unknown as ChallongeSnapshotLike) ?? {
      tournament: {
        id: 0,
        name: null,
        state: "unknown",
        tournament_type: null,
        full_url: canonicalUrl,
      },
      participants: [],
      matches: [],
      standings: [],
    };

    return snapshotToScrapedTournament(snap, {
      url: canonicalUrl,
      slug: cleanSlug,
      extras: {
        standings,
        stations,
        log,
        participants: participantsExtra.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          seed: p.seed,
          username: p.username,
          challongeUsername: p.challongeUsername,
          challongeProfileUrl: p.challongeProfileUrl,
          final_rank: p.final_rank,
          checked_in: p.checked_in,
          portrait_url: p.portrait_url,
        })),
      },
    });
  } finally {
    if (ownsTransport) transport.close?.();
  }
}

// ---------------------------------------------------------------------------
// Public: crawlOrg
// ---------------------------------------------------------------------------

export interface CrawlOrgOptions {
  /** Transport to use (default = fresh {@link BxcTransport}, never closed if injected). */
  transport?: Transport;
  /** Cancel the crawl mid-flight. */
  signal?: AbortSignal;
  /** Structured observability hook. */
  onEvent?: (e: CrawlEvent) => void;
  /** Locale prefix for the landing URL (e.g. `'fr'`). Default `'fr'`. */
  lang?: string;
}

/**
 * Crawl an organisation landing page into a {@link ScrapedOrg}, enumerating the
 * org's public tournaments. Delegates parsing to the P3 {@link parseOrgLanding}.
 *
 * @param subdomain  Org subdomain (`'rpb'`), bare slug, or full landing URL.
 * @param opts       See {@link CrawlOrgOptions}.
 */
export async function crawlOrg(subdomain: string, opts: CrawlOrgOptions = {}): Promise<ScrapedOrg> {
  const lang = opts.lang ?? DEFAULT_LANG;
  const ownsTransport = !opts.transport;
  const transport: Transport = opts.transport ?? new BxcTransport({ profile: "chrome131" });

  // Resolve the landing URL from a full URL, a `<sub>.challonge.com` host, or a sub.
  const sub = subdomain
    .replace(/^https?:\/\//i, "")
    .replace(/\.challonge\.com.*$/i, "")
    .replace(/^challonge\.com\/+/i, "")
    .replace(/\/.*$/, "")
    .replace(/^\/+|\/+$/g, "");
  const url = /^https?:\/\//i.test(subdomain) ? subdomain : `https://${sub}.challonge.com/${lang}`;

  const frontier = new Frontier({
    transport,
    pacingMs: 0, // single fetch — no inter-request pacing needed.
    signal: opts.signal,
    onEvent: opts.onEvent,
  });

  try {
    const html = await frontier.get(url, "org");
    if (html == null) {
      return {
        subdomain: sub,
        name: null,
        description: null,
        logoUrl: null,
        url,
        tournaments: [],
      };
    }
    return parseOrgLanding(html, sub ? { subdomain: sub } : undefined);
  } finally {
    if (ownsTransport) transport.close?.();
  }
}
