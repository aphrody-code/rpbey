/**
 * Extractor registry — pure, bundlable (P3).
 *
 * Central, side-effect-free map from a source identifier to its extractor.
 * Two flavors live here:
 *
 *   1. STORE extractors — `(_initialStoreState map) => T`. These wrap the pure
 *      `storeTo*` functions in `extractors/stores/*`. Keyed by the canonical
 *      Challonge store name (e.g. `'LogEntryListStore'`, `'TournamentStore'`,
 *      `'StandingsStore'`).
 *
 *   2. ROUTE extractors — `(html string) => unknown`. These parse a full HTML
 *      page for a given Challonge route (e.g. `/users/:name`, `/:subdomain`,
 *      `/:slug/standings`). The HTML-parsing extractors (user-profile / org /
 *      standings table) are contributed by the integration / other P3 lanes via
 *      {@link registerRouteExtractor}; the table below is the mutable extension
 *      point. `standings` is pre-registered against the shared
 *      {@link parseStandingsTable} (the HTML-table fallback) as a convenience.
 *
 * ZERO bxc / transport / FFI import — only the pure extractors. Universally
 * bundlable (Next.js).
 *
 * @module extractors/registry
 */

import { storeToLogEntries } from "./stores/log";
import { storeToParticipants } from "./stores/participants";
import { parseStandingsTable, storeToStandings } from "./stores/standings";

// ---------------------------------------------------------------------------
// Store extractors (parsed _initialStoreState map -> typed output)
// ---------------------------------------------------------------------------

/** A typed store extractor: pulls `T` out of a parsed `_initialStoreState` map. */
export interface StoreExtractor<T> {
  /** Canonical Challonge store key this extractor reads from. */
  key: string;
  /** Pure extraction function. */
  extract(store: Record<string, unknown>): T;
}

/**
 * Registry of store extractors keyed by the canonical Challonge store name.
 *
 * - `'LogEntryListStore'` → {@link storeToLogEntries}
 * - `'TournamentStore'`   → {@link storeToParticipants} (participants live under
 *                            `TournamentStore.participants` / `ParticipantsStore`)
 * - `'StandingsStore'`    → {@link storeToStandings}
 *
 * Values are the raw extractor functions (return `unknown` for a uniform map);
 * callers that need a typed result should import the concrete `storeTo*`
 * function directly, or use {@link getStoreExtractor} and assert the type.
 */
export const STORE_EXTRACTORS: Record<string, (store: Record<string, unknown>) => unknown> = {
  LogEntryListStore: storeToLogEntries,
  TournamentStore: storeToParticipants,
  StandingsStore: storeToStandings,
};

/**
 * Look up a store extractor by its canonical store key.
 *
 * @param key  Challonge store name (e.g. `'LogEntryListStore'`).
 * @returns The extractor function, or `undefined` when unregistered.
 */
export function getStoreExtractor(
  key: string,
): ((store: Record<string, unknown>) => unknown) | undefined {
  return STORE_EXTRACTORS[key];
}

// ---------------------------------------------------------------------------
// Route extractors (raw HTML -> typed output) — mutable extension point
// ---------------------------------------------------------------------------

/** A route HTML extractor: parses a full page's HTML into a typed result. */
export type RouteExtractor<T = unknown> = (html: string) => T;

/**
 * Registry of route extractors keyed by a route identifier.
 *
 * Pre-seeded with `'standings'` → {@link parseStandingsTable} (the HTML-table
 * fallback). The integration / other P3 lanes register the remaining HTML
 * extractors (`'user-profile'`, `'org'`, …) via {@link registerRouteExtractor}.
 *
 * Mutable on purpose — this is the cross-lane extension point.
 */
export const ROUTE_EXTRACTORS: Record<string, RouteExtractor> = {
  standings: parseStandingsTable,
};

/**
 * Register (or override) a route HTML extractor.
 *
 * @param route      Route identifier (e.g. `'user-profile'`, `'org'`).
 * @param extractor  Pure `(html) => T` parser.
 */
export function registerRouteExtractor<T>(route: string, extractor: RouteExtractor<T>): void {
  ROUTE_EXTRACTORS[route] = extractor as RouteExtractor;
}

/**
 * Look up a route extractor by its route identifier.
 *
 * @param route  Route identifier (e.g. `'standings'`, `'user-profile'`).
 * @returns The extractor function, or `undefined` when unregistered.
 */
export function getRouteExtractor(route: string): RouteExtractor | undefined {
  return ROUTE_EXTRACTORS[route];
}
