/**
 * Tests pour core/fetch-engine.ts et core/cache.ts (M5).
 *
 * Aucun réseau réel : `NativeFetchEngine` est piloté avec un `fetch` stubé. Le
 * chemin FFI (`ImpersonatedClientEngine`) n'est PAS testé ici — il dépend du
 * .so libcurl-impersonate, couvert par les smoke tests opt-in. Le chemin CDP
 * (`CdpEngine`) n'est pas exercé (il lancerait un vrai navigateur).
 */

import { describe, test, expect } from "bun:test";
import { NativeFetchEngine, type FetchEngineRequest } from "../src/core/fetch-engine";
import { LruCache, type Cache } from "../src/core/cache";

// ---------------------------------------------------------------------------
// NativeFetchEngine — fetch stubé, zéro réseau
// ---------------------------------------------------------------------------

/** Construit un `fetch` stub qui capte la dernière requête et renvoie `resp`. */
function stubFetch(resp: {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
  url?: string;
}): { fn: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const body = resp.body ?? "";
    // `Response.url` is read-only on a real Response, so we return a structural
    // stand-in (status / headers / url / text()) — all `NativeFetchEngine` reads.
    return {
      status: resp.status ?? 200,
      headers: new Headers(resp.headers ?? {}),
      url: resp.url ?? String(input),
      async text() {
        return body;
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("NativeFetchEngine", () => {
  test("request() returns status / body / finalUrl from the stub", async () => {
    const { fn } = stubFetch({
      status: 200,
      body: "<html>ok</html>",
      headers: { "content-type": "text/html" },
      url: "https://example.com/final",
    });
    const engine = new NativeFetchEngine({ fetchImpl: fn });

    const res = await engine.request("https://example.com/");
    expect(res.status).toBe(200);
    expect(res.body).toBe("<html>ok</html>");
    expect(res.finalUrl).toBe("https://example.com/final");
    expect(res.headers["content-type"]).toBe("text/html");
    engine.close();
  });

  test("request() forwards headers and cookies into the fetch init", async () => {
    const { fn, calls } = stubFetch({ status: 204, body: "" });
    const engine = new NativeFetchEngine({ fetchImpl: fn });

    const opts: FetchEngineRequest = {
      headers: { "x-test": "1" },
      cookies: "a=1; b=2",
    };
    await engine.request("https://example.com/", opts);

    const sent = new Headers(calls[0]!.init!.headers);
    expect(sent.get("x-test")).toBe("1");
    expect(sent.get("cookie")).toBe("a=1; b=2");
    engine.close();
  });

  test("request() defaults redirect to manual, opt-in to follow", async () => {
    const { fn, calls } = stubFetch({ status: 200, body: "" });
    const engine = new NativeFetchEngine({ fetchImpl: fn });

    await engine.request("https://example.com/");
    expect(calls[0]!.init!.redirect).toBe("manual");

    await engine.request("https://example.com/", { followRedirects: true });
    expect(calls[1]!.init!.redirect).toBe("follow");
    engine.close();
  });

  test("request() propagates a non-2xx status", async () => {
    const { fn } = stubFetch({ status: 403, body: "blocked" });
    const engine = new NativeFetchEngine({ fetchImpl: fn });
    const res = await engine.request("https://example.com/");
    expect(res.status).toBe(403);
    expect(res.body).toBe("blocked");
    engine.close();
  });

  test("implements the FetchEngine contract (close is a no-op, safe to call)", () => {
    const engine = new NativeFetchEngine({ fetchImpl: stubFetch({}).fn });
    expect(() => engine.close()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// LruCache
// ---------------------------------------------------------------------------

describe("LruCache", () => {
  test("set / get / has round-trips a value", () => {
    const c: Cache<{ v: number }> = new LruCache<{ v: number }>();
    expect(c.has("k")).toBe(false);
    c.set("k", { v: 42 });
    expect(c.has("k")).toBe(true);
    expect(c.get("k")).toEqual({ v: 42 });
  });

  test("get returns undefined for a missing key", () => {
    const c = new LruCache<{ v: number }>();
    expect(c.get("nope")).toBeUndefined();
  });

  test("clear empties the cache", () => {
    const c = new LruCache<{ v: number }>();
    c.set("a", { v: 1 });
    c.set("b", { v: 2 });
    expect(c.size).toBe(2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.has("a")).toBe(false);
  });

  test("evicts by byte size when maxBytes is exceeded", () => {
    // maxBytes = 100. Each entry weighs 60 bytes → only the most recent fits.
    const c = new LruCache<{ tag: string }>({ maxBytes: 100 });
    c.set("a", { tag: "a" }, { bytes: 60 });
    c.set("b", { tag: "b" }, { bytes: 60 });
    // "a" must have been evicted to make room for "b".
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.calculatedSize).toBeLessThanOrEqual(100);
  });

  test("evicts by TTL once an entry expires", async () => {
    const c = new LruCache<{ v: number }>({ ttlMs: 1_000_000 });
    // Per-entry TTL override: 20 ms.
    c.set("short", { v: 1 }, { ttlMs: 20 });
    expect(c.get("short")).toEqual({ v: 1 });
    await Bun.sleep(40);
    expect(c.get("short")).toBeUndefined();
    expect(c.has("short")).toBe(false);
  });

  test("calculatedSize reflects the weight of stored entries", () => {
    const c = new LruCache<{ v: number }>({ maxBytes: 10_000 });
    c.set("a", { v: 1 }, { bytes: 30 });
    c.set("b", { v: 2 }, { bytes: 70 });
    expect(c.calculatedSize).toBe(100);
    expect(c.size).toBe(2);
  });
});
