/**
 * Unified Challonge client — chooses the best transport per call.
 *
 *   ChallongeClient.fetch(idOrSlug, options)
 *     1. Try the API v1 (fast, no Cloudflare, requires API key + visibility).
 *     2. If `withLog` / `withStations` is requested, AUGMENT with the scraper
 *        (those endpoints are not exposed by the API).
 *     3. If the API fails AND a cookie jar is present, fall back to the scraper.
 *
 * This is the recommended entry point for any new code. The legacy
 * `ChallongeScraper` remains exported for backwards compatibility.
 */

import {
	ChallongeApi,
	ChallongeApiError,
	type ChallongeApiOptions,
} from "./api";
import {
	ChallongeScraper,
	type ChallongeScraperOptions,
	type ScrapeOptions,
} from "./scraper";
import {
	type ScrapedLogEntry,
	type ScrapedStation,
	type ScrapedTournament,
} from "./types";

export interface ChallongeClientOptions {
	api?: ChallongeApiOptions | false;
	scraper?: ChallongeScraperOptions | false;
	/** Default logger used by both transports. */
	log?: (msg: string) => void;
}

export interface FetchOptions extends ScrapeOptions {
	/** Force a specific transport. Default: "auto". */
	transport?: "api" | "scrape" | "auto";
}

const QUIET: (msg: string) => void = () => {};

export class ChallongeClient {
	private apiClient: ChallongeApi | null;
	private scraperOpts: ChallongeScraperOptions | null;
	private cachedScraper: ChallongeScraper | null = null;
	private readonly log: (msg: string) => void;

	constructor(options: ChallongeClientOptions = {}) {
		this.log = options.log ?? QUIET;
		this.apiClient =
			options.api === false
				? null
				: safeNew(
						() =>
							new ChallongeApi(
								(options.api as ChallongeApiOptions | undefined) ?? {},
							),
						this.log,
						"API disabled",
					);
		this.scraperOpts =
			options.scraper === false
				? null
				: ((typeof options.scraper === "object"
						? { log: this.log, ...options.scraper }
						: options.scraper) ?? { log: this.log });
	}

	private getScraper(): ChallongeScraper {
		if (!this.cachedScraper) {
			if (this.scraperOpts === null) {
				throw new Error(
					"Scraper transport disabled. Set options.scraper to enable it, or pass transport: 'api'.",
				);
			}
			this.cachedScraper = new ChallongeScraper(this.scraperOpts);
		}
		return this.cachedScraper;
	}

	async close(): Promise<void> {
		if (this.cachedScraper) {
			await this.cachedScraper.close();
			this.cachedScraper = null;
		}
	}

	/**
	 * Fetch a tournament with the best transport available.
	 *
	 * - For idOrSlug: prefer the numeric ID (e.g. `17779621`) — the API resolves
	 *   it cheaply. Slugs (`"B_TS4"`, `"rpb-..."`) only work if the tournament
	 *   is visible by the configured API token.
	 */
	async fetch(
		idOrSlug: string | number,
		options: FetchOptions = {},
	): Promise<ScrapedTournament> {
		const transport = options.transport ?? "auto";

		// ── Pure API path ────────────────────────────────────────────────────
		if (transport === "api") {
			if (!this.apiClient) throw new Error("API transport disabled.");
			const t = await this.apiClient.get(idOrSlug, {
				includeParticipants: options.withParticipants ?? true,
				includeMatches: true,
				signal: options.signal,
			});
			return this.apiClient.toCanonical(t);
		}

		// ── Pure scrape path ─────────────────────────────────────────────────
		if (transport === "scrape") {
			const scraper = this.getScraper();
			return scraper.scrape(String(idOrSlug), options);
		}

		// ── Auto: API first, augment with scrape for missing pieces ─────────
		let canonical: ScrapedTournament | null = null;
		if (this.apiClient) {
			try {
				const t = await this.apiClient.get(idOrSlug, {
					includeParticipants: options.withParticipants ?? true,
					includeMatches: true,
					signal: options.signal,
				});
				canonical = this.apiClient.toCanonical(t);
				this.log(
					`✓ API: ${canonical.metadata.name} (state=${canonical.metadata.state}, ${canonical.participants.length} parts, ${canonical.matches.length} matches)`,
				);
			} catch (err) {
				if (
					err instanceof ChallongeApiError &&
					(err.status === 401 || err.status === 404)
				) {
					this.log(
						`⚠️  API ${err.status} for "${idOrSlug}", falling back to scraper.`,
					);
				} else {
					this.log(
						`⚠️  API failure (${(err as Error).message}), falling back to scraper.`,
					);
				}
			}
		}

		// Need scraper for /log + /stations (not in API), or as full fallback
		const needScrape =
			!canonical ||
			(options.withLog ?? true) === true ||
			(options.withStations ?? true) === true ||
			(options.withStandings ?? false) === true;

		if (needScrape && this.scraperOpts !== null) {
			try {
				const scraper = this.getScraper();
				const slug =
					canonical?.metadata.url.replace(/^https?:\/\/challonge\.com\//, "") ??
					String(idOrSlug);
				const scrapeResult = await scraper.scrape(slug, {
					...options,
					// If we already have API data, only fetch what's missing
					withParticipants: canonical
						? false
						: (options.withParticipants ?? true),
				});

				if (canonical) {
					return mergeScrapeIntoCanonical(canonical, scrapeResult, options);
				}
				return scrapeResult;
			} catch (err) {
				if (canonical) {
					this.log(`⚠️  Scraper augmentation failed: ${(err as Error).message}`);
					return canonical;
				}
				throw err;
			}
		}

		if (!canonical) {
			throw new Error(
				`Cannot fetch tournament ${idOrSlug}: API and scraper both unavailable.`,
			);
		}
		return canonical;
	}

	/**
	 * Convenience: fetch only the activity log (scraper-only endpoint).
	 */
	async fetchLog(idOrSlug: string): Promise<ScrapedLogEntry[]> {
		const result = await this.fetch(idOrSlug, {
			transport: "scrape",
			withLog: true,
			withStandings: false,
			withStations: false,
			withParticipants: false,
		});
		return result.log;
	}

	/**
	 * Convenience: fetch live stations (scraper-only endpoint).
	 */
	async fetchStations(idOrSlug: string): Promise<ScrapedStation[]> {
		const result = await this.fetch(idOrSlug, {
			transport: "scrape",
			withStations: true,
			withStandings: false,
			withLog: false,
			withParticipants: false,
		});
		return result.stations;
	}
}

function safeNew<T>(
	factory: () => T,
	log: (msg: string) => void,
	hint: string,
): T | null {
	try {
		return factory();
	} catch (err) {
		log(`⚠️  ${hint}: ${(err as Error).message}`);
		return null;
	}
}

/**
 * Merge scraper-only fields (log/stations/standings) into the API canonical
 * result without overwriting the trustworthy parts (participants/matches).
 */
function mergeScrapeIntoCanonical(
	canonical: ScrapedTournament,
	scrape: ScrapedTournament,
	options: FetchOptions,
): ScrapedTournament {
	return {
		...canonical,
		standings:
			options.withStandings === false ? canonical.standings : scrape.standings,
		stations:
			options.withStations === false ? canonical.stations : scrape.stations,
		log: options.withLog === false ? canonical.log : scrape.log,
	};
}
