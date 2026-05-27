/**
 * curl-impersonate transport (facade) — backward-compatible re-export layer.
 *
 * This file is the public API surface used by all callers:
 *   - src/reverse.ts
 *   - src/proxy.ts (type import only)
 *   - src/index.ts
 *   - package.json exports["./curl"]
 *
 * The transport is lazy-loaded: BxcTransport is only instantiated on
 * first call to curlImpersonateGet(), not at module level. This avoids
 * crashing callers that import the module but never use the curl transport
 * (e.g., rpb-bot which primarily uses ChallongeApi/ChallongeScraper).
 *
 * If the bxc FFI is unavailable (no libcurl-impersonate.so), falls back
 * to native fetch with a custom User-Agent header.
 */

import type { BxcTransport, BxcFetchOptions } from "./bxc";
import {
	type CurlImpersonateOptions,
	type CurlImpersonateResponse,
	type RedirectInfo,
	CurlImpersonateError,
	validateURL,
	upgradeToHttps,
	isPermittedRedirect,
	isRedirectInfo,
} from "./curl-impersonate-types";

// Re-export all types + pure helpers so callers keep working with the same
// import path (no breaking changes to import statements anywhere in the pkg).
export {
	type CurlImpersonateProfile,
	type CurlImpersonateOptions,
	type CurlImpersonateResponse,
	type RedirectInfo,
	CurlImpersonateError,
	validateURL,
	upgradeToHttps,
	isPermittedRedirect,
	isRedirectInfo,
} from "./curl-impersonate-types";

export type { BxcTransport };

// ---------------------------------------------------------------------------
// Lazy singleton — instantiated on first use, not at module level
// ---------------------------------------------------------------------------

let _defaultTransport: BxcTransport | null = null;
let _ffiAvailable: boolean | null = null;

async function getTransport(): Promise<BxcTransport | null> {
	if (_ffiAvailable === false) return null;
	if (_defaultTransport) return _defaultTransport;

	try {
		const mod = await import("./bxc");
		const transport = new (mod as any).BxcTransport();
		_defaultTransport = transport;
		_ffiAvailable = true;
		return transport;
	} catch {
		_ffiAvailable = false;
		return null;
	}
}

// ---------------------------------------------------------------------------
// Fallback: native fetch with custom UA (when FFI unavailable)
// ---------------------------------------------------------------------------

const FALLBACK_UA = "rpb-challonge/2 (+https://rpbey.fr)";

async function fallbackFetch(
	url: string,
	options: CurlImpersonateOptions = {},
): Promise<CurlImpersonateResponse> {
	const timeoutMs = (options.timeoutSec ?? 25) * 1000;
	const headers: Record<string, string> = {
		"User-Agent": FALLBACK_UA,
		Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
		...(options.extraHeaders ?? {}),
	};

	const tStart = Date.now();
	const res = await fetch(url, {
		headers,
		redirect: options.followRedirects === false ? "manual" : "follow",
		signal: AbortSignal.timeout(timeoutMs),
	});
	const body = await res.text();
	const timeSec = (Date.now() - tStart) / 1000;

	const resHeaders: Record<string, string> = {};
	res.headers.forEach((v, k) => {
		resHeaders[k] = v;
	});

	return {
		status: res.status,
		finalUrl: res.url || url,
		headers: resHeaders,
		body,
		timeSec,
		fromCache: false,
	};
}

// ---------------------------------------------------------------------------
// Public API — same signatures as legacy
// ---------------------------------------------------------------------------

/**
 * Fetch a URL with browser-grade TLS fingerprint.
 *
 * Drop-in replacement for the previous spawn-based implementation.
 * Delegates to BxcTransport (bun:ffi libcurl-impersonate) when available,
 * falls back to native fetch with a custom User-Agent when the FFI is not
 * installed.
 *
 * @example
 *   const r = await curlImpersonateGet("https://challonge.com/fr/B_TS4/log");
 *   if (r.status === 200) console.log(r.body.length);
 *
 * @example  // with same-origin redirect policy
 *   const r = await curlImpersonateGet(url, { safeRedirects: true });
 *   if ("type" in r && r.type === "redirect") console.warn("cross-host:", r.redirectUrl);
 */
export async function curlImpersonateGet(
	url: string,
	options: CurlImpersonateOptions = {},
): Promise<CurlImpersonateResponse | RedirectInfo> {
	const transport = await getTransport();

	if (!transport) {
		// FFI unavailable — use native fetch fallback
		return fallbackFetch(url, options);
	}

	const fetchOpts: BxcFetchOptions = {
		profile: options.profile,
		cookiePath: options.cookiePath,
		timeoutSec: options.timeoutSec,
		followRedirects: options.followRedirects,
		maxRedirects: options.maxRedirects,
		safeRedirects: options.safeRedirects,
		extraHeaders: options.extraHeaders,
		cache: options.cache,
		log: options.log,
	};
	return transport.fetch(url, fetchOpts);
}

/** Drop every cached response. */
export function clearCurlCache(): void {
	_defaultTransport?.clearCache();
}

/** Cache size for diagnostics. Returns `{ size, entries }` for back-compat. */
export function curlCacheStats(): { size: number; entries: number } {
	if (!_defaultTransport) return { size: 0, entries: 0 };
	const s = _defaultTransport.cacheStats();
	return { size: s.bytes, entries: s.entries };
}

// Export the singleton getter so other internal modules can share the same instance
export { _defaultTransport, getTransport };
