/**
 * Smoke tests for BxcTransport (Phase 1 — bxc migration).
 *
 * All tests skip gracefully when:
 *   - libcurl-impersonate .so is not available (offline / CI without vendor)
 *   - Challonge cookie jar is absent (private credentials)
 *
 * Network-dependent tests hit challonge.com; they skip if the .so is missing.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import os from "node:os";
import { join } from "node:path";
import { BxcTransport } from "../src/transports/bxc";
import { isLibAvailable } from "@aphrody-code/bxc/ffi/curl-impersonate";
import {
  validateURL,
  upgradeToHttps,
  isPermittedRedirect,
  isRedirectInfo,
  clearCurlCache,
  curlCacheStats,
  curlImpersonateGet,
} from "../src/transports/curl-impersonate";

// ---------------------------------------------------------------------------
// Skip helpers
// ---------------------------------------------------------------------------

const LIB_AVAILABLE = isLibAvailable();
const COOKIE_PATH = join(os.homedir(), "bxc/cookies/private/challonge.json");

async function cookiesAvailable(): Promise<boolean> {
  return Bun.file(COOKIE_PATH).exists();
}

// ---------------------------------------------------------------------------
// Unit tests — no network, no .so required
// ---------------------------------------------------------------------------

describe("validateURL", () => {
  test("accepts a valid https URL", () => {
    expect(validateURL("https://challonge.com/fr/B_TS5/log").ok).toBe(true);
  });

  test("rejects URL with embedded credentials", () => {
    const r = validateURL("https://user:pass@challonge.com/");
    expect(r.ok).toBe(false);
  });

  test("rejects URL that is too long", () => {
    const r = validateURL("https://challonge.com/" + "a".repeat(2000));
    expect(r.ok).toBe(false);
  });

  test("rejects non-http(s) protocol", () => {
    const r = validateURL("ftp://challonge.com/");
    expect(r.ok).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateURL("").ok).toBe(false);
  });
});

describe("upgradeToHttps", () => {
  test("upgrades http:// to https://", () => {
    expect(upgradeToHttps("http://challonge.com/")).toBe("https://challonge.com/");
  });

  test("leaves https:// unchanged", () => {
    expect(upgradeToHttps("https://challonge.com/")).toBe("https://challonge.com/");
  });
});

describe("isPermittedRedirect", () => {
  test("same host is permitted", () => {
    expect(isPermittedRedirect("https://challonge.com/a", "https://challonge.com/b")).toBe(true);
  });

  test("www. toggle is permitted", () => {
    expect(isPermittedRedirect("https://challonge.com/a", "https://www.challonge.com/b")).toBe(
      true,
    );
  });

  test("cross-host is not permitted", () => {
    expect(isPermittedRedirect("https://challonge.com/a", "https://evil.com/b")).toBe(false);
  });

  test("protocol change is not permitted", () => {
    expect(isPermittedRedirect("https://challonge.com/a", "http://challonge.com/b")).toBe(false);
  });
});

describe("isRedirectInfo", () => {
  test("returns true for a redirect object", () => {
    const r = {
      type: "redirect" as const,
      originalUrl: "a",
      redirectUrl: "b",
      statusCode: 301,
    };
    expect(isRedirectInfo(r)).toBe(true);
  });

  test("returns false for a normal response", () => {
    const r = {
      status: 200,
      finalUrl: "https://x.com",
      headers: {},
      body: "",
      timeSec: 0,
    };
    expect(isRedirectInfo(r)).toBe(false);
  });
});

describe("BxcTransport — instantiation (no network)", () => {
  test("can be constructed without options", () => {
    // Constructor must not throw even if .so is absent
    // (the .so is loaded lazily on first fetch)
    expect(() => new BxcTransport()).not.toThrow();
  });

  test("cacheStats returns zero-valued stats on a fresh instance", () => {
    const t = new BxcTransport();
    const s = t.cacheStats();
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(0);
    expect(s.bytes).toBe(0);
    expect(s.entries).toBe(0);
    t.close();
  });

  test("clearCache does not throw on empty cache", () => {
    const t = new BxcTransport();
    expect(() => t.clearCache()).not.toThrow();
    t.close();
  });
});

describe("curlCacheStats (facade back-compat)", () => {
  test("returns { size, entries } shape", () => {
    const s = curlCacheStats();
    expect(typeof s.size).toBe("number");
    expect(typeof s.entries).toBe("number");
  });

  test("clearCurlCache does not throw", () => {
    expect(() => clearCurlCache()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Network smoke test — skipped if .so or cookies absent
// ---------------------------------------------------------------------------

describe("BxcTransport — live fetch (challonge.com)", () => {
  let hasCookies = false;

  beforeAll(async () => {
    hasCookies = await cookiesAvailable();
  });

  test("fetches /log page, status 200, body contains _initialStoreState, time < 5s", async () => {
    if (!LIB_AVAILABLE) {
      console.log("[skip] libcurl-impersonate .so not found");
      return;
    }
    if (!hasCookies) {
      console.log(`[skip] cookie jar not found at ${COOKIE_PATH}`);
      return;
    }

    const transport = new BxcTransport({
      cookiePath: COOKIE_PATH,
      timeoutMs: 10_000,
      cache: false,
    });

    try {
      const res = await transport.fetch("https://challonge.com/fr/B_TS5/log?page=1");

      expect(isRedirectInfo(res)).toBe(false);
      if (isRedirectInfo(res)) return; // type narrowing only

      expect(res.status).toBe(200);
      expect(res.body).toContain("_initialStoreState['LogEntryListStore']");
      expect(res.timeSec).toBeLessThan(5);
      expect(res.body.length).toBeGreaterThan(10_000);
    } finally {
      transport.close();
    }
  });

  test("curlImpersonateGet facade delegates to BxcTransport", async () => {
    if (!LIB_AVAILABLE) {
      console.log("[skip] libcurl-impersonate .so not found");
      return;
    }
    if (!hasCookies) {
      console.log(`[skip] cookie jar not found at ${COOKIE_PATH}`);
      return;
    }

    const res = await curlImpersonateGet("https://challonge.com/fr/B_TS5/log?page=1", {
      cookiePath: COOKIE_PATH,
      cache: false,
      timeoutSec: 10,
    });

    expect(isRedirectInfo(res)).toBe(false);
    if (isRedirectInfo(res)) return;

    expect(res.status).toBe(200);
    expect(res.body).toContain("_initialStoreState['LogEntryListStore']");
  });

  test("cache is populated on second request (hit rate > 0)", async () => {
    if (!LIB_AVAILABLE) {
      console.log("[skip] libcurl-impersonate .so not found");
      return;
    }
    if (!hasCookies) {
      console.log(`[skip] cookie jar not found at ${COOKIE_PATH}`);
      return;
    }

    const transport = new BxcTransport({
      cookiePath: COOKIE_PATH,
      timeoutMs: 10_000,
      cache: true,
    });

    try {
      const url = "https://challonge.com/fr/B_TS5/log?page=1";
      // First request — populates cache
      await transport.fetch(url);
      // Second request — should hit cache
      const r2 = await transport.fetch(url);

      if (!isRedirectInfo(r2)) {
        expect(r2.fromCache).toBe(true);
      }

      const stats = transport.cacheStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
    } finally {
      transport.close();
    }
  });
});
