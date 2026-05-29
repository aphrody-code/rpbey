/**
 * Tournament search + games-catalogue client (P4).
 *
 * Two public entry points on top of the canonical {@link Transport}:
 *
 *   - {@link searchTournaments} — paginated tournament discovery. Hits the JSON
 *     endpoint `GET /tournaments.json?q=&page=&state=&game_id=` first (with the
 *     `X-Requested-With: XMLHttpRequest` + `Accept: application/json` headers
 *     that make Challonge return the AJAX collection rather than HTML), and
 *     falls back to a defensive scrape of the `/tournaments?…` SSR page when the
 *     JSON shape is missing.
 *   - {@link listGames} — the `/games.json` catalogue, read from the on-disk
 *     P3 cache (`data/challonge-games.json`) in priority, else fetched live.
 *     {@link findGame} resolves a stable `game_id` from a human-typed name.
 *
 * Pure parsing is delegated: the games catalogue reuses {@link parseGamesCatalog}
 * / {@link findGameByName} verbatim (no re-implementation). The default transport
 * is a fresh {@link BxcTransport}; callers may inject any {@link Transport}
 * (e.g. a fake in tests) and an optional `onEvent` observability hook.
 *
 * @module clients/search
 */

import type { ChallongeGame } from "../types";
import type { Transport, TransportResponse } from "../transports/transport";
import type { TransportEvent } from "../transports/bxc";
import { BxcTransport } from "../transports/bxc";
import { isRedirectInfo } from "../transports/curl-impersonate-types";
import { findGameByName, parseGamesCatalog } from "../extractors/stores/games-catalog";

const CHALLONGE_BASE = "https://challonge.com";

/** Default on-disk path of the P3 games cache, relative to this module. */
const DEFAULT_GAMES_CACHE = new URL("../../data/challonge-games.json", import.meta.url).pathname;

/**
 * One tournament hit from a search. Defensive: only `name`/`slug`/`url` are
 * guaranteed; the rest are best-effort and may be `null` when the source
 * (JSON collection or SSR card) does not carry them.
 */
export interface SearchResult {
  /** Tournament display name. */
  name: string;
  /** URL-safe slug (last path segment of the tournament URL). */
  slug: string;
  /** Canonical tournament URL. */
  url: string;
  /** Owner / organizer handle, when present. */
  owner?: string | null;
  /** Filtered game name (the `filter.name` clause of the collection). */
  gameName?: string | null;
  /** Banner / cover image URL. */
  bannerUrl?: string | null;
  /** Organizer (org) display name, when present. */
  organizer?: string | null;
}

/** Parameters accepted by {@link searchTournaments}. */
export interface SearchTournamentsParams {
  /** Free-text query (matched against tournament name). */
  q?: string;
  /** Pin results to a single game by stable id (e.g. Beyblade X = 337197). */
  gameId?: number;
  /** Lifecycle filter — e.g. `"all"`, `"upcoming"`, `"in_progress"`, `"complete"`. */
  state?: string;
  /** Tournament type filter — e.g. `"single_elimination"`, `"double_elimination"`. */
  type?: string;
  /** 1-based page index. Default 1. */
  page?: number;
  /** Transport to use. Default: a fresh {@link BxcTransport}. */
  transport?: Transport;
  /** Optional structured observability hook. */
  onEvent?: (e: TransportEvent) => void;
}

/** Shape returned by {@link searchTournaments}. */
export interface SearchTournamentsResult {
  /** 1-based index of the next page, or `null` when this is the last page. */
  nextPage: number | null;
  /** Tournament hits on this page. */
  results: SearchResult[];
}

/** Options accepted by {@link listGames}. */
export interface ListGamesOptions {
  /** Transport to use when the disk cache is absent. Default: {@link BxcTransport}. */
  transport?: Transport;
  /** Override the on-disk cache path. Default: `data/challonge-games.json`. */
  cachePath?: string;
  /** Optional structured observability hook (live fetch only). */
  onEvent?: (e: TransportEvent) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Narrow a transport return to a real response body (never a redirect). */
function bodyOf(res: TransportResponse): { status: number; body: string; finalUrl: string } | null {
  if (isRedirectInfo(res)) return null;
  return { status: res.status, body: res.body, finalUrl: res.finalUrl };
}

/** Build the `/tournaments.json` query string from search params. */
function buildSearchQuery(params: SearchTournamentsParams): string {
  const qs = new URLSearchParams();
  if (params.q != null && params.q.trim() !== "") qs.set("q", params.q.trim());
  if (typeof params.gameId === "number" && Number.isFinite(params.gameId)) {
    qs.set("game_id", String(params.gameId));
  }
  if (params.state != null && params.state.trim() !== "") qs.set("state", params.state.trim());
  if (params.type != null && params.type.trim() !== "") qs.set("type", params.type.trim());
  const page = typeof params.page === "number" && params.page > 0 ? params.page : 1;
  qs.set("page", String(page));
  return qs.toString();
}

/** Last path segment of a URL (locale/query-stripped) → slug, or `""`. */
function slugFromUrl(url: string): string {
  const clean = url.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const m = /\/([A-Za-z0-9_-]+)$/.exec(clean);
  return m?.[1] ?? "";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/**
 * Parse the AJAX `/tournaments.json` collection:
 * `{ next_page, collection: [{ name, link, owner, filter{id,name}, banner, organizer }] }`.
 * Returns `null` when the payload is not the expected JSON shape (caller falls
 * back to the HTML scrape).
 */
function parseSearchCollection(body: string): SearchTournamentsResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const collRaw = Array.isArray(o.collection)
    ? o.collection
    : Array.isArray(o.tournaments)
      ? o.tournaments
      : null;
  if (collRaw === null) return null;

  const results: SearchResult[] = [];
  for (const entry of collRaw) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const name = str(e.name);
    const link = str(e.link) ?? str(e.url) ?? str(e.full_url);
    if (name === null || link === null) continue;

    const url = link.startsWith("http")
      ? link
      : `${CHALLONGE_BASE}${link.startsWith("/") ? "" : "/"}${link}`;
    const slug = slugFromUrl(url);
    if (slug === "") continue;

    const filter =
      e.filter !== null && typeof e.filter === "object"
        ? (e.filter as Record<string, unknown>)
        : null;
    const gameName = (filter ? str(filter.name) : null) ?? str(e.game_name);

    results.push({
      name,
      slug,
      url,
      owner: str(e.owner),
      gameName,
      bannerUrl: str(e.banner) ?? str(e.banner_url),
      organizer: str(e.organizer),
    });
  }

  const np = o.next_page;
  const nextPage =
    typeof np === "number" && Number.isFinite(np) && np > 0
      ? np
      : typeof np === "string" && np.trim() !== "" && Number.isFinite(Number(np)) && Number(np) > 0
        ? Number(np)
        : null;

  return { nextPage, results };
}

// ─── HTML fallback (SSR `/tournaments?…` page) ───────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Defensive scrape of the SSR tournaments listing. Collects anchor cards that
 * point at a flat `challonge.com/[locale/]<slug>` tournament URL and keeps the
 * link text as the name. Best-effort only — no banner/owner enrichment.
 */
function parseSearchHtml(html: string): SearchTournamentsResult {
  const STATIC = new Set([
    "about",
    "contact",
    "partners",
    "pricing",
    "privacy_policy",
    "terms_of_service",
    "organizedplay",
    "tournaments",
    "login",
    "signup",
    "users",
    "sign_in",
    "sign_up",
    "settings",
  ]);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const rawHref = decodeEntities(m[1] ?? "");
    const text = stripTags(m[2] ?? "");
    if (text === "") continue;

    let slug: string | null = null;
    let url: string | null = null;

    const subHost =
      /^https?:\/\/([a-z0-9_-]+)\.challonge\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?([A-Za-z0-9_-]+)\/?$/i.exec(
        rawHref,
      );
    if (subHost && subHost[1] && subHost[1].toLowerCase() !== "www") {
      slug = subHost[2] ?? null;
      url = rawHref;
    } else {
      const flat =
        /^https?:\/\/challonge\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?([A-Za-z0-9_-]+)\/?$/i.exec(
          rawHref,
        );
      if (flat?.[1]) {
        slug = flat[1];
        url = rawHref;
      }
    }

    if (!slug || !url) continue;
    if (STATIC.has(slug.toLowerCase())) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    results.push({
      name: text,
      slug,
      url,
      owner: null,
      gameName: null,
      bannerUrl: null,
      organizer: null,
    });
  }

  // Best-effort next-page detection from a rel="next" link.
  const next =
    /<a\b[^>]*rel=['"]next['"][^>]*href=['"][^'"]*[?&]page=(\d+)[^'"]*['"]/i.exec(html)?.[1] ??
    /<a\b[^>]*href=['"][^'"]*[?&]page=(\d+)[^'"]*['"][^>]*rel=['"]next['"]/i.exec(html)?.[1] ??
    null;
  const nextPage = next != null && Number.isFinite(Number(next)) ? Number(next) : null;

  return { nextPage, results };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search public Challonge tournaments. Prefers the AJAX `/tournaments.json`
 * collection (stable, structured), falling back to a defensive parse of the
 * SSR `/tournaments?…` HTML when the JSON shape is unavailable.
 *
 * @param params  Search filters + optional transport / observability hook.
 * @returns The page's hits and the next-page index (or `null` when last).
 */
export async function searchTournaments(
  params: SearchTournamentsParams = {},
): Promise<SearchTournamentsResult> {
  const transport = params.transport ?? new BxcTransport({ onEvent: params.onEvent });
  const query = buildSearchQuery(params);

  // 1) JSON endpoint (preferred).
  const jsonUrl = `${CHALLONGE_BASE}/tournaments.json?${query}`;
  try {
    const res = await transport.fetch(jsonUrl, {
      extraHeaders: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
    });
    const ok = bodyOf(res);
    if (ok && ok.status >= 200 && ok.status < 300) {
      const collection = parseSearchCollection(ok.body);
      if (collection) return collection;
    }
  } catch {
    // fall through to HTML
  }

  // 2) HTML fallback (SSR page).
  const htmlUrl = `${CHALLONGE_BASE}/tournaments?${query}`;
  try {
    const res = await transport.fetch(htmlUrl, {
      extraHeaders: { Accept: "text/html,application/xhtml+xml" },
    });
    const ok = bodyOf(res);
    if (ok && ok.body) return parseSearchHtml(ok.body);
  } catch {
    // fall through to empty
  }

  return { nextPage: null, results: [] };
}

/**
 * Return the Challonge games catalogue. Reads the on-disk P3 cache
 * (`data/challonge-games.json`) first; when absent, fetches `/games.json` live
 * through the transport. Always parsed via {@link parseGamesCatalog}.
 *
 * @param opts  Transport / cache-path / observability overrides.
 */
export async function listGames(opts: ListGamesOptions = {}): Promise<ChallongeGame[]> {
  const cachePath = opts.cachePath ?? DEFAULT_GAMES_CACHE;

  // 1) Disk cache (zero network).
  try {
    const file = Bun.file(cachePath);
    if (await file.exists()) {
      const games = parseGamesCatalog(await file.text());
      if (games.length > 0) return games;
    }
  } catch {
    // fall through to live fetch
  }

  // 2) Live fetch.
  const transport = opts.transport ?? new BxcTransport({ onEvent: opts.onEvent });
  try {
    const res = await transport.fetch(`${CHALLONGE_BASE}/games.json`, {
      extraHeaders: { Accept: "application/json" },
    });
    const ok = bodyOf(res);
    if (ok && ok.status >= 200 && ok.status < 300) return parseGamesCatalog(ok.body);
  } catch {
    // fall through to empty
  }

  return [];
}

/**
 * Resolve a game by human-typed name against a previously-loaded catalogue.
 * Thin alias over {@link findGameByName} (no re-implementation).
 *
 * @param games  Catalogue from {@link listGames}.
 * @param name   Game name / token to look up.
 */
export function findGame(games: ChallongeGame[], name: string): ChallongeGame | undefined {
  return findGameByName(games, name);
}
