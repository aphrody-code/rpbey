/**
 * Challonge local HTTP proxy — Cloudflare-bypassed Challonge data over Bun.serve.
 *
 * All structured routes tunnel through `ChallongeReverse`, which itself uses
 * `BxcTransport` (libcurl-impersonate via bun:ffi = real Chrome 131
 * TLS+H2 fingerprint), so external tools never need to touch the
 * impersonation pipeline directly. JSON routes serialise the same projections
 * that `ChallongeReverse` exposes to library consumers; the generic
 * `/:slug/page/:sub` route still returns raw HTML for ad-hoc reverse work.
 *
 * Routes
 *   GET /                         health + route listing (JSON)
 *   GET /:slug/store              JSON `ChallongeReverse.getStore(slug)`
 *   GET /:slug/log                JSON `ChallongeReverse.getLogPage(slug, page)`
 *                                 (forwards `?page=N`, returns LogPageResult)
 *   GET /:slug/standings          JSON `ChallongeReverse.getStandings(slug)`
 *   GET /:slug/participants       JSON `ChallongeReverse.getParticipants(slug)`
 *   GET /:slug/page/:sub          generic raw HTML dump for arbitrary sub-paths
 *
 * Query parameters
 *   ?profile=<id>   curl-impersonate profile override (e.g. chrome131, firefox147)
 *   ?page=<N>       only honoured by /:slug/log (forwarded to ChallongeReverse)
 *
 * Non-standard Bun extension: Bun.serve `routes:` API (radix-tree router).
 * Ref: bun.com/docs/api/http#routing
 */

import { BxcTransport } from "./transports/bxc";
import { ChallongeReverse, ChallongeReverseError } from "./reverse";
import {
	CurlImpersonateError,
	isRedirectInfo,
	type CurlImpersonateProfile,
} from "./transports/curl-impersonate-types";

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ChallongeProxyOptions {
	/** TCP port to listen on. Default 7878. */
	port?: number;
	/** If set, all routes (except `GET /`) require `Authorization: Bearer <token>`. */
	token?: string;
	/** Override cookie jar path passed to BxcTransport. */
	cookiePath?: string;
	/** Default curl-impersonate profile. Default `chrome131`. */
	profile?: CurlImpersonateProfile;
	/** Override the upstream base URL. Default `https://challonge.com/fr`. */
	baseUrl?: string;
	/**
	 * HMR-friendly development mode.
	 * Default: `process.env.NODE_ENV !== "production"`.
	 */
	development?: boolean;
	/** Optional structured logger (defaults to a silent no-op). */
	log?: (msg: string) => void;
}

const PROXY_VERSION = "2.1.0";
const DEFAULT_PORT = 7878;
const DEFAULT_BASE_URL = "https://challonge.com/fr";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Constant-time comparison so timing attacks cannot leak the token length.
 *
 * Implemented in pure TypeScript to avoid pulling in `node:crypto`: the loop
 * always touches every byte of the shorter buffer regardless of mismatch
 * position, so the wall-clock cost is independent of where the first byte
 * differs.
 */
function tokenMatches(provided: string, expected: string): boolean {
	const a = new TextEncoder().encode(provided);
	const b = new TextEncoder().encode(expected);
	// XOR-accumulate across max(a.length, b.length); seed `diff` with the length
	// delta so unequal-length inputs always return false but still loop fully.
	const max = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < max; i++) {
		const av = i < a.length ? a[i]! : 0;
		const bv = i < b.length ? b[i]! : 0;
		diff |= av ^ bv;
	}
	return diff === 0;
}

function jsonError(status: number, error: string, hint = ""): Response {
	return Response.json(
		{ error, status, hint },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

/**
 * Pull `?profile=` from the request URL and return it as a
 * `CurlImpersonateProfile` if present, undefined otherwise. No validation —
 * an unknown profile is normalised by `BxcTransport` (falls back to
 * `chrome131`).
 */
function profileFromUrl(url: URL): CurlImpersonateProfile | undefined {
	const p = url.searchParams.get("profile");
	return p ? (p as CurlImpersonateProfile) : undefined;
}

/** Parse a positive 1-based page number out of `?page=`. */
function pageFromUrl(url: URL): number {
	const raw = url.searchParams.get("page");
	if (!raw) return 1;
	const n = parseInt(raw, 10);
	return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Authorise the request against an optional static bearer token. */
function authorize(req: Request, token: string | undefined): Response | null {
	if (!token) return null; // no gate configured
	const auth = req.headers.get("authorization") ?? "";
	const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
	if (!tokenMatches(bearer, token)) {
		return jsonError(
			401,
			"Unauthorized",
			"Pass Authorization: Bearer <CHALLONGE_PROXY_TOKEN>",
		);
	}
	return null;
}

/** Strip a leading slash so we can safely interpolate into a URL path. */
function trimLeadingSlash(s: string): string {
	return s.replace(/^\/+/, "");
}

/** Standard JSON response with sensible cache headers. */
function jsonOk(payload: unknown): Response {
	return Response.json(payload, {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "private, max-age=60",
		},
	});
}

// ─── Route factory ──────────────────────────────────────────────────────────

/**
 * Build and start a `Bun.serve` instance for the Challonge proxy.
 *
 * @example
 *   const server = startChallongeProxy({ port: 7878 });
 *   console.log(server.url.href);
 *   server.stop();
 */
export function startChallongeProxy(
	opts: ChallongeProxyOptions = {},
): ReturnType<typeof Bun.serve> {
	const port = opts.port ?? DEFAULT_PORT;
	const token = opts.token;
	const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
	const development = opts.development ?? process.env.NODE_ENV !== "production";
	const log = opts.log ?? (() => {});

	// Single ChallongeReverse shared across requests — preserves LRU cache + cookie jar.
	const reverse = new ChallongeReverse({
		baseUrl,
		...(opts.profile ? { profile: opts.profile } : {}),
		...(opts.cookiePath ? { cookiePath: opts.cookiePath } : {}),
		log,
	});

	// Per-call profile overrides bypass the shared reverse client and use a
	// throwaway BxcTransport sized for one-off raw HTML dumps via /page/:sub.
	const htmlTransport = new BxcTransport({
		...(opts.profile ? { profile: opts.profile } : {}),
		...(opts.cookiePath ? { cookiePath: opts.cookiePath } : {}),
		log,
	});

	/** Build the upstream URL `${baseUrl}/${slug}${sub}` for raw HTML dumps. */
	function upstreamUrl(slug: string, sub: string, reqUrl: URL): string {
		const cleanSlug = trimLeadingSlash(slug);
		const cleanSub = sub.startsWith("/") || sub === "" ? sub : `/${sub}`;
		const url = new URL(`${baseUrl}/${cleanSlug}${cleanSub}`);
		const page = reqUrl.searchParams.get("page");
		if (page) url.searchParams.set("page", page);
		return url.toString();
	}

	/**
	 * Generic raw HTML dump — only used by `/:slug/page/:sub`. The structured
	 * routes below all go through `ChallongeReverse` instead.
	 */
	async function fetchAsHtml(
		req: Request,
		slug: string,
		sub: string,
	): Promise<Response> {
		const denied = authorize(req, token);
		if (denied) return denied;

		const reqUrl = new URL(req.url);
		const profile = profileFromUrl(reqUrl);
		const upstream = upstreamUrl(slug, sub, reqUrl);

		try {
			const r = await htmlTransport.fetch(upstream, profile ? { profile } : {});
			if (isRedirectInfo(r)) {
				return jsonError(
					502,
					`Cross-host redirect blocked: ${r.originalUrl} -> ${r.redirectUrl}`,
					"BxcTransport refused to follow a cross-origin redirect",
				);
			}
			if (r.status >= 400) {
				return jsonError(
					r.status,
					`Upstream returned ${r.status} for ${upstream}`,
					`body sample: ${r.body.slice(0, 200)}`,
				);
			}
			return new Response(r.body, {
				status: r.status,
				headers: {
					"Content-Type": "text/html; charset=utf-8",
					"Cache-Control": "private, max-age=60",
					"X-Challonge-Url": r.finalUrl,
					"X-Time-Sec": r.timeSec.toFixed(3),
					"X-From-Cache": String(Boolean(r.fromCache)),
				},
			});
		} catch (err) {
			return mapError(err);
		}
	}

	/**
	 * Wrap a `ChallongeReverse` call into a JSON response, normalising the
	 * common error shapes (`ChallongeReverseError`, `CurlImpersonateError`).
	 */
	async function jsonRoute<T>(
		req: Request,
		fn: () => Promise<T>,
	): Promise<Response> {
		const denied = authorize(req, token);
		if (denied) return denied;
		try {
			const data = await fn();
			return jsonOk(data);
		} catch (err) {
			return mapError(err);
		}
	}

	const server = Bun.serve({
		port,
		development,

		// ── Routes (radix-tree, Bun.serve routes API) ────────────────────────
		// Keys are path patterns; method discrimination uses the nested
		// `{ GET: handler }` form. Bun matches more-specific paths first, but
		// explicit ordering here keeps intent clear.
		routes: {
			// Health / help — no auth gate, intentionally public.
			"/": () =>
				Response.json(
					{
						name: "challonge-proxy",
						version: PROXY_VERSION,
						routes: [
							"GET /",
							"GET /:slug/store",
							"GET /:slug/log",
							"GET /:slug/standings",
							"GET /:slug/participants",
							"GET /:slug/page/:sub",
						],
						query_params: {
							profile:
								"curl-impersonate profile override (e.g. chrome131, firefox147)",
							page: "1-based page number, only honoured by /:slug/log",
						},
						auth: token
							? "Authorization: Bearer <token> required on all routes except GET /"
							: "none",
					},
					{ headers: { "Cache-Control": "no-store" } },
				),

			// ── /:slug/store — JSON dump of ChallongeReverse.getStore(slug) ─────
			"/:slug/store": {
				GET: (req) => jsonRoute(req, () => reverse.getStore(req.params.slug)),
			},

			// ── /:slug/log — JSON LogPageResult (forwards ?page=N) ──────────────
			"/:slug/log": {
				GET: (req) => {
					const page = pageFromUrl(new URL(req.url));
					return jsonRoute(req, () =>
						reverse.getLogPage(req.params.slug, page),
					);
				},
			},

			// ── /:slug/standings — JSON ScrapedStanding[] ───────────────────────
			"/:slug/standings": {
				GET: (req) =>
					jsonRoute(req, () => reverse.getStandings(req.params.slug)),
			},

			// ── /:slug/participants — JSON tournament/rankings/raw ──────────────
			"/:slug/participants": {
				GET: (req) =>
					jsonRoute(req, () => reverse.getParticipants(req.params.slug)),
			},

			// ── /:slug/page/:sub — generic raw HTML dump ────────────────────────
			"/:slug/page/:sub": {
				GET: (req) =>
					fetchAsHtml(
						req,
						req.params.slug,
						`/${trimLeadingSlash(req.params.sub)}`,
					),
			},
		},

		// ── Fallback fetch (unmatched routes) ───────────────────────────────────
		fetch(_req) {
			return jsonError(404, "Not found", "See GET / for available routes");
		},

		// ── Global error boundary ───────────────────────────────────────────────
		error(err) {
			log(`[challonge-proxy] unhandled error: ${err}`);
			return jsonError(500, "Internal server error", String(err));
		},
	});

	return server;
}

// ─── Error mapper ────────────────────────────────────────────────────────────

function mapError(err: unknown): Response {
	if (err instanceof ChallongeReverseError) {
		const status = err.status >= 400 && err.status < 600 ? err.status : 502;
		return jsonError(
			status,
			err.message,
			err.bodySample ? `body sample: ${err.bodySample.slice(0, 200)}` : "",
		);
	}
	if (err instanceof CurlImpersonateError) {
		return jsonError(
			502,
			err.message,
			`CurlImpersonateError${err.bodySample ? ": " + err.bodySample.slice(0, 200) : ""}`,
		);
	}
	return jsonError(500, String(err), "unexpected error");
}
