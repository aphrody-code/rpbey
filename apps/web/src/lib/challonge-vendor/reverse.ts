/**
 * Challonge Reverse — browser-less scraper.
 *
 * Architecture:
 *   curl-impersonate (TLS+H2 fingerprint = real Chrome)
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
 * Limitations:
 *   - Cookie session must remain valid (refresh via storage/cookies/challonge_cookie.json).
 *   - curl-impersonate `chrome131` profile may need bumping every ~6 months
 *     when Cloudflare rotates fingerprint detection.
 */

import { extractReactRoots, getReactRoot, readDataAttrs } from "./extractors/react-props";
import type {
  LogEntriesProps,
  ParticipantsProps,
  ReactRoot,
  StandingsProps,
} from "./extractors/react-props";
import {
  curlImpersonateGet,
  isRedirectInfo,
  type CurlImpersonateOptions,
  type CurlImpersonateResponse,
  type RedirectInfo,
} from "./transports/curl-impersonate";
import type { ScrapedLogEntry, ScrapedStanding } from "./types";

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

export class ChallongeReverse {
  private readonly opts: ChallongeReverseOptions;
  private readonly baseUrl: string;

  constructor(options: ChallongeReverseOptions = {}) {
    this.opts = options;
    this.baseUrl = options.baseUrl ?? "https://challonge.com/fr";
  }

  // ── Generic ─────────────────────────────────────────────────────────────

  async getPage(slug: string, sub: string): Promise<ReversePage> {
    const url = `${this.baseUrl}/${slug.replace(/^\//, "")}${sub}`;
    const r = await curlImpersonateGet(url, this.opts);
    if (isRedirectInfo(r)) {
      throw new ChallongeReverseError(
        `Cross-host redirect blocked: ${r.originalUrl} → ${r.redirectUrl}`,
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

  // ── Specialised endpoints ──────────────────────────────────────────────

  /**
   * Activity log (the page that the API v1 does NOT expose). Returns the
   * structured entries with timestamps + user + action.
   */
  async getLog(slug: string): Promise<ScrapedLogEntry[]> {
    const page = await this.getPage(slug, "/log");
    const root = getReactRoot<LogEntriesProps>(page.body, "LogEntriesController");
    const entries = root?.props?.entries ?? [];
    return entries.map((e) => ({
      timestamp: e.created_at ?? e.timestamp ?? "",
      type: e.type ?? e.action ?? "activity",
      message: e.description ?? e.message ?? "",
      who: e.user?.name,
      raw: e,
    }));
  }

  async getStandings(slug: string): Promise<ScrapedStanding[]> {
    const page = await this.getPage(slug, "/standings");
    const root = getReactRoot<StandingsProps>(page.body, "StandingsController");
    const standings = root?.props?.standings ?? [];
    return standings.map((s) => ({
      rank: s.rank,
      name: (s.display_name ?? s.name ?? "").trim().replace("✅", ""),
      challongeUsername: s.username ?? null,
      challongeProfileUrl: s.username ? `https://challonge.com/users/${s.username}` : null,
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      stats: s,
    }));
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
   *   - `tournament`        (settings, state, owner_ids, …)
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
    const url = `https://challonge.com/${slug.replace(/^\//, "")}.json`;
    const r = await curlImpersonateGet(url, this.opts);
    if (isRedirectInfo(r)) {
      throw new ChallongeReverseError(
        `Cross-host redirect blocked: ${r.originalUrl} → ${r.redirectUrl}`,
        r.statusCode,
        null,
      );
    }
    if (r.status >= 400) {
      throw new ChallongeReverseError(`HTTP ${r.status} on ${url}`, r.status, r.body.slice(0, 400));
    }
    try {
      return JSON.parse(r.body);
    } catch (err) {
      throw new ChallongeReverseError(
        `Invalid JSON on ${url}: ${(err as Error).message}`,
        r.status,
        r.body.slice(0, 400),
      );
    }
  }

  /** Raw fetch with all the React roots — useful for ad-hoc reverse work. */
  async dump(slug: string, sub: string): Promise<ReversePage> {
    return this.getPage(slug, sub);
  }
}

function parseJsonAttr<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

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

// Re-export the helpers so consumers can build their own queries.
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
