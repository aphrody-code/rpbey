/**
 * Challonge local HTTP proxy — Cloudflare-bypassed endpoints over Bun.serve.
 *
 * Every route tunnels through curl-impersonate (TLS+H2 = real Chrome), so
 * external tools (other languages, dashboards, curl) never need to touch the
 * impersonation pipeline directly.
 *
 * Routes
 *   GET /                         health + route listing
 *   GET /:slug                    HTML page for the bracket
 *   GET /:slug/store              bracket JSON store (.json endpoint)
 *   GET /:slug/log                structured log entries
 *   GET /:slug/standings          standings array
 *   GET /:slug/participants       participants + tournament metadata
 *   GET /:slug/page/:sub          generic page dump (raw HTML → ReversePage)
 *
 * Non-standard Bun extension: Bun.serve `routes:` API (radix tree router).
 * Ref: bun/docs/runtime/http/routing.mdx and bun/docs/runtime/http/server.mdx
 */

import { timingSafeEqual } from "node:crypto";

import { ChallongeReverse, ChallongeReverseError, CurlImpersonateError } from "./reverse";
import type { CurlImpersonateProfile } from "./transports/curl-impersonate";

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ChallongeProxyOptions {
  /** TCP port to listen on. Default 7878. */
  port?: number;
  /** If set, all requests must carry `Authorization: Bearer <token>`. */
  token?: string;
  /** Override cookie jar path passed to curl-impersonate. */
  cookiePath?: string;
  /**
   * HMR-friendly development mode.
   * Default: `process.env.NODE_ENV !== "production"`.
   */
  development?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Constant-time comparison so timing attacks cannot leak the token length.
 * Uses `crypto.timingSafeEqual` (Node-compatible, available in Bun).
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison on equal-length buffers to keep timing uniform.
    timingSafeEqual(Buffer.alloc(a.length), Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

function jsonError(status: number, error: string, hint = ""): Response {
  return Response.json(
    { error, status, hint },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/**
 * Pull `?profile=` from the request URL and return it as a
 * `CurlImpersonateProfile` if present, undefined otherwise.
 * No validation — an invalid profile value will fail at the binary level
 * and surface as a 502 CurlImpersonateError.
 */
function profileFromUrl(url: URL): CurlImpersonateProfile | undefined {
  const p = url.searchParams.get("profile");
  return p ? (p as CurlImpersonateProfile) : undefined;
}

/** Authorise the request against an optional static bearer token. */
function authorize(req: Request, token: string | undefined): Response | null {
  if (!token) return null; // no gate configured
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!tokenMatches(bearer, token)) {
    return jsonError(401, "Unauthorized", "Pass Authorization: Bearer <CHALLONGE_PROXY_TOKEN>");
  }
  return null;
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
  const port = opts.port ?? 7878;
  const token = opts.token;
  const cookiePath = opts.cookiePath;
  const development = opts.development ?? process.env.NODE_ENV !== "production";

  function makeReverse(req: Request): ChallongeReverse {
    const url = new URL(req.url);
    const profile = profileFromUrl(url);
    return new ChallongeReverse({
      ...(profile ? { profile } : {}),
      ...(cookiePath ? { cookiePath } : {}),
    });
  }

  const server = Bun.serve({
    port,
    development,

    // ── Routes (radix-tree, Bun.serve routes: API)
    // Keys are path patterns only; method discrimination uses per-handler checks
    // or the nested { GET: handler } object form.
    // Ref: bun/docs/runtime/http/server.mdx §"Per-HTTP method handlers"

    routes: {
      // Health / help — no auth gate, intentionally public.
      // Using a plain handler (all-methods) since health checks come from all clients.
      "/": () =>
        Response.json(
          {
            service: "challonge-proxy",
            version: "1.0.0",
            routes: [
              "GET /",
              "GET /:slug",
              "GET /:slug/store",
              "GET /:slug/log",
              "GET /:slug/standings",
              "GET /:slug/participants",
              "GET /:slug/page/:sub",
            ],
            query_params: {
              profile: "curl-impersonate profile override (e.g. chrome131, firefox147)",
            },
            auth: token
              ? "Authorization: Bearer <token> required on all routes except GET /"
              : "none",
          },
          { headers: { "Cache-Control": "no-store" } },
        ),

      // ── /:slug/store — bracket JSON store (must come before /:slug) ────────
      // Bun's radix router matches more-specific paths first, but explicit
      // ordering here makes intent clear.
      "/:slug/store": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug } = req.params;
          try {
            const reverse = makeReverse(req);
            const store = await reverse.getStore(slug);
            return Response.json(store, {
              headers: { "Cache-Control": "private, max-age=60" },
            });
          } catch (err) {
            return mapError(err);
          }
        },
      },

      // ── /:slug/log ────────────────────────────────────────────────────────
      "/:slug/log": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug } = req.params;
          try {
            const reverse = makeReverse(req);
            const entries = await reverse.getLog(slug);
            return Response.json(entries, {
              headers: { "Cache-Control": "private, max-age=60" },
            });
          } catch (err) {
            return mapError(err);
          }
        },
      },

      // ── /:slug/standings ──────────────────────────────────────────────────
      "/:slug/standings": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug } = req.params;
          try {
            const reverse = makeReverse(req);
            const standings = await reverse.getStandings(slug);
            return Response.json(standings, {
              headers: { "Cache-Control": "private, max-age=60" },
            });
          } catch (err) {
            return mapError(err);
          }
        },
      },

      // ── /:slug/participants ───────────────────────────────────────────────
      "/:slug/participants": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug } = req.params;
          try {
            const reverse = makeReverse(req);
            const participants = await reverse.getParticipants(slug);
            return Response.json(participants, {
              headers: { "Cache-Control": "private, max-age=60" },
            });
          } catch (err) {
            return mapError(err);
          }
        },
      },

      // ── /:slug/page/:sub — generic page dump ──────────────────────────────
      "/:slug/page/:sub": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug, sub } = req.params;
          try {
            const reverse = makeReverse(req);
            const page = await reverse.dump(slug, "/" + sub);
            // Return the structured ReversePage as JSON (callers wanting raw HTML
            // should use /:slug directly or extend this route).
            return Response.json(
              {
                url: page.url,
                status: page.status,
                timeSec: page.timeSec,
                bodyData: page.bodyData,
                reactRoots: page.reactRoots,
                // body omitted by default — can be large; callers that need it
                // should hit /:slug directly or extend this route.
              },
              { headers: { "Cache-Control": "private, max-age=60" } },
            );
          } catch (err) {
            return mapError(err);
          }
        },
      },

      // ── /:slug — raw HTML page (least specific — must come last) ──────────
      "/:slug": {
        GET: async (req) => {
          const denied = authorize(req, token);
          if (denied) return denied;
          const { slug } = req.params;
          try {
            const reverse = makeReverse(req);
            const page = await reverse.dump(slug, "");
            return new Response(page.body, {
              status: page.status,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "private, max-age=60",
                "X-Challonge-Url": page.url,
                "X-Time-Sec": String(page.timeSec),
              },
            });
          } catch (err) {
            return mapError(err);
          }
        },
      },
    },

    // ── Fallback fetch (unmatched routes) ───────────────────────────────────
    fetch(_req) {
      return jsonError(404, "Not found", "See GET / for available routes");
    },

    // ── Global error boundary ───────────────────────────────────────────────
    error(err) {
      console.error("[challonge-proxy] unhandled error:", err);
      return jsonError(500, "Internal server error", String(err));
    },
  });

  return server;
}

// ─── Error mapper ────────────────────────────────────────────────────────────

function mapError(err: unknown): Response {
  if (err instanceof ChallongeReverseError) {
    const status = err.status >= 400 ? err.status : 502;
    return jsonError(
      status,
      err.message,
      err.bodySample ? `upstream sample: ${err.bodySample.slice(0, 200)}` : "ChallongeReverseError",
    );
  }
  if (err instanceof CurlImpersonateError) {
    return jsonError(
      502,
      err.message,
      `CurlImpersonateError${err.bodySample ? ": " + err.bodySample.slice(0, 200) : ""}`,
    );
  }
  console.error("[challonge-proxy] unexpected error:", err);
  return jsonError(500, String(err), "unexpected error — see server logs");
}
