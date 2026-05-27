// Public surface. Backwards compatible — existing consumers (rpb-bot,
// rpb-dashboard, scripts/rpb/*) keep importing { ChallongeScraper, ... }.
export * from "./types";
export { bracketSideFromRound, gravatarUrl } from "./types";
export type { BracketSide } from "./types";
export * from "./scores";
// `ChallongeScraper` (puppeteer-extra) N'EST PLUS ré-exporté par le barrel :
// l'importer directement via "@/lib/challonge-vendor/scraper". Sinon tout import
// du barrel (même pour un helper pur comme normalizeSets/ChallongeApi) évalue
// puppeteer-extra → `TypeError: utils.isObject is not a function` sous le
// bundling Turbopack → 500 sur les pages (ex. /tournaments/stardust).
// `ScrapeOptions` non plus — l'importer via "@/lib/challonge-vendor/scraper".

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
export {
	ChallongeClient,
	type ChallongeClientOptions,
	type FetchOptions,
} from "./client";

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
export {
	startChallongeProxy,
	type ChallongeProxyOptions,
} from "./proxy";
