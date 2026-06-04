/**
 * Smoke test for the Challonge proxy (bun:test).
 *
 * Always-on:
 *   - `GET /` returns JSON with the routes catalogue.
 *   - Unknown routes return JSON 404.
 *
 * Network-gated (skipped when CHALLONGE_COOKIE_PATH cookies are absent):
 *   - `GET /:slug/store` returns JSON with `tournament` + `matches_by_round`.
 *   - Response carries `Content-Type: application/json` and status 200.
 *
 * Network skips log a clear reason — they never fail silently.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

import { startChallongeProxy } from "../src/proxy";
import { resolveDefaultCookiePath } from "../src/utils/cookies";
import { isLibAvailable } from "@aphrody/bxc/ffi/curl-impersonate";

const SLUG = "B_TS5";

const cookiePath = resolveDefaultCookiePath();
const haveCookies = !!cookiePath && existsSync(cookiePath) && isLibAvailable();

if (!haveCookies) {
  const reason =
    !cookiePath || !existsSync(cookiePath)
      ? `no cookie jar at ${cookiePath ?? "<unset>"}`
      : "libcurl-impersonate FFI not available";
  console.log(`[proxy-smoke] skipping network tests — ${reason}`);
}

let server: ReturnType<typeof startChallongeProxy>;
let baseUrl = "";

beforeAll(() => {
  // Bun.serve `port: 0` binds to a random ephemeral port — works with any caller.
  server = startChallongeProxy({ port: 0, development: false, gracefulShutdown: false });
  baseUrl = server.url.href.replace(/\/+$/, "");
});

afterAll(() => {
  server?.stop(true);
});

describe("Challonge proxy — always-on routes", () => {
  test("GET / returns JSON route listing", async () => {
    const res = await fetch(`${baseUrl}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as {
      name: string;
      version: string;
      routes: string[];
    };
    expect(body.name).toBe("challonge-proxy");
    expect(Array.isArray(body.routes)).toBe(true);
    // The 5 structured routes plus /
    expect(body.routes.length).toBeGreaterThanOrEqual(6);
    expect(body.routes).toContain("GET /:slug/store");
    expect(body.routes).toContain("GET /:slug/log");
    expect(body.routes).toContain("GET /:slug/standings");
    expect(body.routes).toContain("GET /:slug/participants");
  });

  test("Unknown route returns JSON 404", async () => {
    const res = await fetch(`${baseUrl}/__nope__`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error: string; status: number };
    expect(body.status).toBe(404);
  });
});

describe.skipIf(!haveCookies)("Challonge proxy — network-gated routes", () => {
  test("GET /:slug/store returns JSON TournamentStore", async () => {
    const res = await fetch(`${baseUrl}/${SLUG}/store`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status !== 200) {
      console.error("FAILED RESP:", await res.text());
    }
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(typeof data.tournament).toBe("object");
    expect(typeof data.matches_by_round).toBe("object");
  }, 70_000);
});
