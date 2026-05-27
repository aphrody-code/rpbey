/**
 * BxcTransport — ImpersonatedClient (bun:ffi libcurl-impersonate) adapter.
 *
 * Replaces the legacy spawn-based curl-impersonate transport with a direct FFI
 * call.  Exposes the same output shape as the legacy transport so callers can
 * migrate without changing their response-handling code.
 *
 * Features:
 *   - LRU cache: 50 MB / 15 min (matches legacy defaults)
 *   - URL validation: max 2000 chars, no embedded creds, public hostname
 *   - http -> https upgrade
 *   - Same-origin redirect policy (safeRedirects: true)
 *   - Cookie jar loading via loadCookieJar (supports Puppeteer + raw formats)
 *   - Configurable profile, timeout, extra headers
 */

import { LRUCache } from "lru-cache";
import {
	ImpersonatedClient,
	type isLibAvailable,
	type ImpersonateProfile,
	type ImpersonatedResponse,
} from "@aphrody-code/bxc/ffi/curl-impersonate";
import { loadCookieJar, resolveDefaultCookiePath } from "../utils/cookies";
import {
	type CurlImpersonateProfile,
	type CurlImpersonateResponse,
	type RedirectInfo,
	CurlImpersonateError,
	validateURL,
	upgradeToHttps,
	isPermittedRedirect,
} from "./curl-impersonate-types";

export { isLibAvailable };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_BYTES = 50 * 1024 * 1024;
const MAX_HTTP_CONTENT_LENGTH = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BxcTransportOptions {
	/** TLS impersonation profile. Default: `"chrome131"`. */
	profile?: CurlImpersonateProfile;
	/** Path to a JSON cookie jar (auto-discovered by default). */
	cookiePath?: string;
	/** Response cache max bytes. Default: 50 MB. */
	cacheBytes?: number;
	/** Response cache TTL in ms. Default: 15 min. */
	cacheTtlMs?: number;
	/** Per-request timeout in ms. Default: 25_000. */
	timeoutMs?: number;
	/** Number of retries on transient failure. Default: 0 (no retry). */
	retries?: number;
	/** Follow redirects. Default: true. */
	followRedirects?: boolean;
	/** Max redirect hops. Default: 10. */
	maxRedirects?: number;
	/**
	 * When true, cross-host redirects return a `RedirectInfo` instead of being
	 * followed. www. toggle is permitted. Default: false.
	 */
	safeRedirects?: boolean;
	/** Extra headers to inject into every request. */
	extraHeaders?: Record<string, string>;
	/** Enable response cache. Default: true. */
	cache?: boolean;
	/** Logger hook. */
	log?: (msg: string) => void;
}

// Per-call override options (subset of BxcTransportOptions)
export interface BxcFetchOptions {
	profile?: CurlImpersonateProfile;
	cookiePath?: string;
	timeoutSec?: number;
	followRedirects?: boolean;
	maxRedirects?: number;
	safeRedirects?: boolean;
	extraHeaders?: Record<string, string>;
	cache?: boolean;
	log?: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Internal cache entry
// ---------------------------------------------------------------------------

interface CacheEntry {
	status: number;
	finalUrl: string;
	headers: Record<string, string>;
	body: string;
	timeSec: number;
	bytes: number;
}

// ---------------------------------------------------------------------------
// Profile mapping
// ---------------------------------------------------------------------------

/**
 * Map legacy CurlImpersonateProfile (may include profiles that never existed
 * in lexiforest builds like "safari153") to an ImpersonateProfile accepted by
 * the FFI layer.  Unknown / legacy profiles fall back to "chrome131".
 */
const VALID_FFI_PROFILES = new Set<string>([
	"chrome99",
	"chrome100",
	"chrome101",
	"chrome104",
	"chrome107",
	"chrome110",
	"chrome116",
	"chrome119",
	"chrome120",
	"chrome123",
	"chrome124",
	"chrome131",
	"chrome133a",
	"chrome136",
	"chrome142",
	"chrome145",
	"chrome146",
	"chrome99_android",
	"chrome131_android",
	"firefox133",
	"firefox135",
	"firefox144",
	"firefox147",
	"safari15_3",
	"safari15_5",
	"safari17_0",
	"safari18_0",
	"safari18_4",
	"safari26_0",
	"safari26_0_1",
	"safari17_2_ios",
	"safari18_0_ios",
	"safari18_4_ios",
	"safari26_0_ios",
	"edge99",
	"edge101",
]);

function toFfiProfile(p: CurlImpersonateProfile): ImpersonateProfile {
	if (VALID_FFI_PROFILES.has(p)) return p as ImpersonateProfile;
	// Legacy profile aliases (old transport used different naming conventions)
	const aliases: Record<string, ImpersonateProfile> = {
		safari153: "safari15_3",
		safari155: "safari15_5",
		safari170: "safari17_0",
		safari172_ios: "safari17_2_ios",
		safari180: "safari18_0",
		safari180_ios: "safari18_0_ios",
		safari184: "safari18_4",
		safari184_ios: "safari18_4_ios",
		safari260: "safari26_0",
		safari260_ios: "safari26_0_ios",
		safari2601: "safari26_0_1",
		tor145: "chrome131", // tor profile not available in FFI build, fall back
	};
	return aliases[p] ?? "chrome131";
}

// ---------------------------------------------------------------------------
// BxcTransport
// ---------------------------------------------------------------------------

export class BxcTransport {
	readonly #defaultProfile: ImpersonateProfile;
	readonly #cacheEnabled: boolean;
	readonly #cache: LRUCache<string, CacheEntry>;
	readonly #timeoutMs: number;
	readonly #followRedirects: boolean;
	readonly #maxRedirects: number;
	readonly #safeRedirects: boolean;
	readonly #extraHeaders: Record<string, string>;
	readonly #cookiePath: string | null;
	readonly #log: (msg: string) => void;
	readonly #client: ImpersonatedClient;

	#cacheHits = 0;
	#cacheMisses = 0;

	constructor(opts: BxcTransportOptions = {}) {
		this.#defaultProfile = toFfiProfile(opts.profile ?? "chrome131");
		this.#cacheEnabled = opts.cache ?? true;
		this.#timeoutMs = opts.timeoutMs ?? 25_000;
		this.#followRedirects = opts.followRedirects ?? true;
		this.#maxRedirects = opts.maxRedirects ?? 10;
		this.#safeRedirects = opts.safeRedirects ?? false;
		this.#extraHeaders = opts.extraHeaders ?? {};
		this.#log = opts.log ?? (() => {});

		// Cookie path: explicit > auto-discover
		const explicitPath = opts.cookiePath ?? null;
		this.#cookiePath = explicitPath ?? resolveDefaultCookiePath();

		this.#cache = new LRUCache<string, CacheEntry>({
			maxSize: opts.cacheBytes ?? CACHE_MAX_BYTES,
			ttl: opts.cacheTtlMs ?? CACHE_TTL_MS,
			sizeCalculation: (e) => Math.max(1, e.bytes),
		});

		this.#client = new ImpersonatedClient({
			profile: this.#defaultProfile,
			timeoutMs: this.#timeoutMs,
			followRedirects: false, // we handle redirects ourselves when safeRedirects is on
			maxRedirects: this.#maxRedirects,
		});
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Fetch a URL using the Chrome TLS fingerprint.
	 *
	 * Returns `CurlImpersonateResponse` on success, or `RedirectInfo` when
	 * `safeRedirects: true` and a cross-host redirect is encountered.
	 */
	async fetch(
		url: string,
		opts?: BxcFetchOptions,
	): Promise<CurlImpersonateResponse | RedirectInfo> {
		// Merge per-call overrides with instance defaults
		const profile = toFfiProfile(
			opts?.profile ?? (this.#defaultProfile as CurlImpersonateProfile),
		);
		const cacheEnabled = opts?.cache ?? this.#cacheEnabled;
		const timeoutMs =
			(opts?.timeoutSec != null ? opts.timeoutSec * 1000 : null) ??
			this.#timeoutMs;
		const followRedirects = opts?.followRedirects ?? this.#followRedirects;
		const maxRedirects = opts?.maxRedirects ?? this.#maxRedirects;
		const safeRedirects = opts?.safeRedirects ?? this.#safeRedirects;
		const extraHeaders = {
			...this.#extraHeaders,
			...(opts?.extraHeaders ?? {}),
		};
		const log = opts?.log ?? this.#log;

		// Validate + upgrade URL
		const v = validateURL(url);
		if (!v.ok) throw new CurlImpersonateError(`Invalid URL: ${v.reason}`);
		const upgraded = upgradeToHttps(url);

		const cacheKey = `${profile}|${upgraded}`;

		// Cache hit
		if (cacheEnabled) {
			const hit = this.#cache.get(cacheKey);
			if (hit) {
				this.#cacheHits++;
				log(`cache hit: ${upgraded}`);
				return {
					status: hit.status,
					finalUrl: hit.finalUrl,
					headers: hit.headers,
					body: hit.body,
					timeSec: hit.timeSec,
					fromCache: true,
				};
			}
			this.#cacheMisses++;
		}

		// Load cookies from jar
		const cookiePath = opts?.cookiePath ?? this.#cookiePath;
		let cookieHeader = "";
		if (cookiePath) {
			try {
				cookieHeader = loadCookieJar(cookiePath).forFetch;
			} catch {
				cookieHeader = "";
			}
		}

		// Build request headers
		const reqHeaders: Record<string, string> = { ...extraHeaders };

		// Manual redirect loop (only iterated >1 when safeRedirects is on)
		let currentUrl = upgraded;
		let hops = 0;
		const tStart = Date.now();

		while (true) {
			log(`${profile} GET ${currentUrl}${hops > 0 ? ` (hop ${hops})` : ""}`);

			let impRes: ImpersonatedResponse;
			try {
				impRes = await this.#client.fetch(currentUrl, {
					profile,
					cookies: cookieHeader || undefined,
					headers: reqHeaders,
					timeoutMs,
					// When safeRedirects is on, disable auto-follow so we can inspect each hop
					followRedirects: safeRedirects ? false : followRedirects,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				throw new CurlImpersonateError(
					`curl-impersonate FFI error for ${currentUrl}: ${msg}`,
					null,
					null,
				);
			}

			const timeSec = (Date.now() - tStart) / 1000;

			// Manual same-origin redirect handling
			if (
				safeRedirects &&
				[301, 302, 303, 307, 308].includes(impRes.status) &&
				impRes.headers.get("location")
			) {
				const location = impRes.headers.get("location")!;
				const next = new URL(location, currentUrl).toString();
				if (!isPermittedRedirect(currentUrl, next)) {
					return {
						type: "redirect",
						originalUrl: currentUrl,
						redirectUrl: next,
						statusCode: impRes.status,
					};
				}
				hops++;
				if (hops > maxRedirects) {
					throw new CurlImpersonateError(
						`Too many redirects (>${maxRedirects}) starting from ${upgraded}`,
					);
				}
				currentUrl = next;
				continue;
			}

			// Convert ImpersonatedResponse (Web Response) to CurlImpersonateResponse
			const body = await impRes.text();
			const finalUrl = impRes.effectiveUrl || currentUrl;

			// Flatten Headers to Record<string, string>
			const headers: Record<string, string> = {};
			impRes.headers.forEach((v, k) => {
				headers[k] = v;
			});

			// Enforce content length cap
			const bodyBytes = new TextEncoder().encode(body).byteLength;
			if (bodyBytes > MAX_HTTP_CONTENT_LENGTH) {
				throw new CurlImpersonateError(
					`Response body exceeds ${MAX_HTTP_CONTENT_LENGTH} bytes for ${currentUrl}`,
					null,
					body.slice(0, 200),
				);
			}

			// Store in cache
			if (cacheEnabled && impRes.status >= 200 && impRes.status < 400) {
				this.#cache.set(cacheKey, {
					status: impRes.status,
					finalUrl,
					headers,
					body,
					timeSec,
					bytes: bodyBytes,
				});
			}

			return {
				status: impRes.status,
				finalUrl,
				headers,
				body,
				timeSec,
				fromCache: false,
			};
		}
	}

	/** Drop every cached response. */
	clearCache(): void {
		this.#cache.clear();
		this.#cacheHits = 0;
		this.#cacheMisses = 0;
	}

	/** Cache stats for diagnostics. */
	cacheStats(): {
		hits: number;
		misses: number;
		bytes: number;
		entries: number;
	} {
		return {
			hits: this.#cacheHits,
			misses: this.#cacheMisses,
			bytes: this.#cache.calculatedSize ?? 0,
			entries: this.#cache.size,
		};
	}

	/** Release the underlying CURL handle. */
	close(): void {
		this.#client.close();
	}

	[Symbol.dispose](): void {
		this.close();
	}
}
