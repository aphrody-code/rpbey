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

import {
  type isLibAvailable,
  type ImpersonateProfile,
} from "@aphrody-code/bxc/ffi/curl-impersonate";
import { loadCookieJar, resolveDefaultCookiePath } from "../utils/cookies";
import { LruCache } from "../core/cache";
import {
  ImpersonatedClientEngine,
  type FetchEngine,
  type RawHttpResponse,
} from "../core/fetch-engine";
import type { Transport } from "./transport";
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
  /**
   * Structured observability hook. Called once per request (and on retry /
   * cookie-expiry signals) with a flat event record. Left `undefined` by
   * default — injection is opt-in and never assumed.
   */
  onEvent?: (e: TransportEvent) => void;
  /**
   * Low-level fetch engine. Default = `new ImpersonatedClientEngine(...)`
   * (FFI curl-impersonate, profil `chrome131`) — comportement runtime
   * historique. Surchargeable pour les tests (`NativeFetchEngine`) ou le
   * secours Cloudflare (`CdpEngine`). Injection optionnelle, jamais assumée.
   */
  engine?: FetchEngine;
}

/**
 * Flat observability event emitted by `BxcTransport`. `kind` discriminates the
 * event; the remaining fields are best-effort context. Extra keys are allowed
 * so callers can pipe straight into a JSON logger.
 */
export interface TransportEvent {
  kind: string;
  url?: string;
  status?: number;
  ms?: number;
  fromCache?: boolean;
  [k: string]: unknown;
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

export class BxcTransport implements Transport {
  readonly #defaultProfile: ImpersonateProfile;
  readonly #cacheEnabled: boolean;
  readonly #cache: LruCache<CacheEntry>;
  readonly #timeoutMs: number;
  readonly #followRedirects: boolean;
  readonly #maxRedirects: number;
  readonly #safeRedirects: boolean;
  readonly #extraHeaders: Record<string, string>;
  readonly #cookiePath: string | null;
  readonly #log: (msg: string) => void;
  readonly #onEvent: ((e: TransportEvent) => void) | undefined;
  readonly #engine: FetchEngine;

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
    this.#onEvent = opts.onEvent;

    // Cookie path: explicit > auto-discover
    const explicitPath = opts.cookiePath ?? null;
    this.#cookiePath = explicitPath ?? resolveDefaultCookiePath();

    this.#cache = new LruCache<CacheEntry>({
      maxBytes: opts.cacheBytes ?? CACHE_MAX_BYTES,
      ttlMs: opts.cacheTtlMs ?? CACHE_TTL_MS,
    });

    // Low-level engine: injected override, else the historical FFI default
    // (curl-impersonate, profil chrome131, followRedirects géré ici).
    this.#engine =
      opts.engine ??
      new ImpersonatedClientEngine({
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
    const profile = toFfiProfile(opts?.profile ?? (this.#defaultProfile as CurlImpersonateProfile));
    const cacheEnabled = opts?.cache ?? this.#cacheEnabled;
    const timeoutMs = (opts?.timeoutSec != null ? opts.timeoutSec * 1000 : null) ?? this.#timeoutMs;
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
        this.#onEvent?.({
          kind: "transport.fetch",
          url: upgraded,
          status: hit.status,
          ms: hit.timeSec * 1000,
          fromCache: true,
        });
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
      } catch (err) {
        cookieHeader = "";
        // Jar missing / unreadable / expired — the only cookie signal we can
        // surface deterministically here.
        this.#onEvent?.({
          kind: "cookie.expired",
          url: upgraded,
          path: cookiePath,
          error: err instanceof Error ? err.message : String(err),
        });
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

      let raw: RawHttpResponse;
      try {
        raw = await this.#engine.request(currentUrl, {
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
        [301, 302, 303, 307, 308].includes(raw.status) &&
        raw.headers["location"]
      ) {
        const location = raw.headers["location"] ?? "";
        const next = new URL(location, currentUrl).toString();
        if (!isPermittedRedirect(currentUrl, next)) {
          this.#onEvent?.({
            kind: "transport.redirect",
            url: currentUrl,
            status: raw.status,
            ms: timeSec * 1000,
            redirectUrl: next,
            blocked: true,
          });
          return {
            type: "redirect",
            originalUrl: currentUrl,
            redirectUrl: next,
            statusCode: raw.status,
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

      // The engine already read the body + flattened headers + resolved finalUrl.
      const body = raw.body;
      const finalUrl = raw.finalUrl || currentUrl;
      const headers = raw.headers;

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
      if (cacheEnabled && raw.status >= 200 && raw.status < 400) {
        this.#cache.set(
          cacheKey,
          {
            status: raw.status,
            finalUrl,
            headers,
            body,
            timeSec,
            bytes: bodyBytes,
          },
          { bytes: bodyBytes },
        );
      }

      this.#onEvent?.({
        kind: "transport.fetch",
        url: finalUrl,
        status: raw.status,
        ms: timeSec * 1000,
        fromCache: false,
      });

      return {
        status: raw.status,
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

  /** Release the underlying engine resources (e.g. the CURL handle). */
  close(): void {
    this.#engine.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}
