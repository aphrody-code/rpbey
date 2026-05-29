// Public surface. Backwards compatible — existing consumers (rpb-bot,
// rpb-dashboard, scripts/rpb/*) keep importing { ChallongeScraper, ... }.
export * from "./types";
export { bracketSideFromRound, gravatarUrl } from "./types";
export type { BracketSide } from "./types";
export * from "./scores";
export {
  ChallongeScraper,
  dumpChallongeRaw,
  type ChallongeScraperOptions,
  type ScrapeOptions,
  type FakePage,
  type DumpChallongeRawResult,
} from "./scraper";

// New surface (v2): use these for any new code.
export {
  ChallongeApi,
  ChallongeApiError,
  synthesizeLogFromMatches,
  type ChallongeApiOptions,
  type ChallongeApiTournament,
  type ChallongeApiParticipant,
  type ChallongeApiMatch,
} from "./api";
export { ChallongeClient, type ChallongeClientOptions, type FetchOptions } from "./client";

// Reverse engineering surface (browser-less Cloudflare bypass).
export {
  ChallongeReverse,
  ChallongeReverseError,
  type ChallongeReverseOptions,
  type ReversePage,
  curlImpersonateGet,
  isRedirectInfo,
  validateURL,
  upgradeToHttps,
  isPermittedRedirect,
  clearCurlCache,
  curlCacheStats,
  CurlImpersonateError,
  extractReactRoots,
  getReactRoot,
  readDataAttrs,
  type CurlImpersonateOptions,
  type CurlImpersonateResponse,
  type RedirectInfo,
  type ReactRoot,
  type LogEntriesProps,
  type StandingsProps,
  type ParticipantsProps,
} from "./reverse";
export type { CurlImpersonateProfile } from "./transports/curl-impersonate";

// HTMLRewriter transport — zero-dep extraction depuis page publique /module.
// Round-robin uniquement (double-elim → utiliser ChallongeApi v1 ou /{slug}.json).
export {
  fetchAndParseModule,
  parseModuleToScrapedTournament,
  fetchAndParseAsScrapedTournament,
  fetchPublicTournamentJson,
  type HtmlRewriterModuleData,
  type FetchAndParseOptions,
} from "./transports/htmlrewriter";

// Cookie helpers (used by scripts that need to validate/refresh cookies).
export {
  loadCookieJar,
  resolveDefaultCookiePath,
  isSessionCookieValid,
  hasCfClearance,
  type RawCookie,
  type PuppeteerCookie,
} from "./utils/cookies";

export { retry, sleep, isTransientHttpError, AbortError } from "./utils/retry";

// Local HTTP proxy — Cloudflare-bypassed Challonge access over Bun.serve.
export { startChallongeProxy, type ChallongeProxyOptions } from "./proxy";

// Observability — JSON-structured event logger (opt-in via RPB_CHALLONGE_OBSERVE=1).
export {
  recordEvent,
  withObserve,
  setObservabilityEnabled,
  isObservabilityEnabled,
  type ObservabilityEvent,
} from "./observability";

// Shadow-mode — dual-backend comparison for migration rollout.
export {
  BACKEND,
  withShadowMode,
  deepDiff,
  type ScraperBackend,
  type DiffEntry,
} from "./shadow-mode";

// Unified pure mappers/extractors (P2 — zero bxc, universally bundlable).
export {
  snapshotToScrapedTournament,
  type ChallongeSnapshotLike,
  type SnapshotMapperOptions,
  type SnapshotMapperExtras,
  type SnapshotParticipantExtra,
  type SnapshotTournament,
  type SnapshotParticipant,
  type SnapshotMatch,
  type SnapshotStanding,
} from "./mappers/snapshot";
export { parseStandingsTable } from "./extractors/stores/standings";

// Extractor registry + store/route extractors (P3 — pure, bundlable).
export {
  STORE_EXTRACTORS,
  getStoreExtractor,
  ROUTE_EXTRACTORS,
  registerRouteExtractor,
  getRouteExtractor,
  type StoreExtractor,
  type RouteExtractor,
} from "./extractors/registry";
export { storeToLogEntries, type LogEntryRaw } from "./extractors/stores/log";
export {
  storeToParticipants,
  normalizeParticipantRaw,
  type NormalizedParticipant,
} from "./extractors/stores/participants";
export { storeToStandings } from "./extractors/stores/standings";
export { parseUserProfile } from "./extractors/stores/user-profile";
export { parseOrgLanding } from "./extractors/stores/org-landing";
export { parseGamesCatalog, findGameByName } from "./extractors/stores/games-catalog";

// Pluggable HTTP fetch engine (P4 M5) — FFI / native fetch / CDP backends.
export {
  ImpersonatedClientEngine,
  NativeFetchEngine,
  CdpEngine,
  type FetchEngine,
  type RawHttpResponse,
  type FetchEngineRequest,
  type ImpersonatedClientEngineOptions,
  type NativeFetchEngineOptions,
  type CdpEngineOptions,
} from "./core/fetch-engine";

// Pluggable cache (P4) — LRU with byte + TTL eviction.
export {
  LruCache,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_CACHE_MAX_BYTES,
  type Cache,
  type CacheSetOptions,
  type LruCacheOptions,
} from "./core/cache";

// High-level clients (P4) — multi-page crawler + tournament search.
export {
  crawlTournament,
  crawlOrg,
  type CrawlSection,
  type CrawlEvent,
  type CrawlOptions,
  type CrawlOrgOptions,
} from "./clients/crawler";
export {
  searchTournaments,
  listGames,
  findGame,
  type SearchResult,
  type SearchTournamentsParams,
  type SearchTournamentsResult,
  type ListGamesOptions,
} from "./clients/search";
