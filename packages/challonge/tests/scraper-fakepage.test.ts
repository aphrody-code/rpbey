/**
 * Tests for the bxc shim: ChallongeScraper + FakePage + dumpChallongeRaw.
 *
 * All network-dependent tests skip when libcurl-impersonate is unavailable.
 * Offline unit tests run unconditionally.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ChallongeScraper, dumpChallongeRaw, type FakePage } from "../src/scraper.ts";
import { CurlImpersonateError } from "../src/transports/curl-impersonate-types.ts";
import { isLibAvailable } from "@aphrody/bxc/ffi/curl-impersonate";

// ---------------------------------------------------------------------------
// Skip helper
// ---------------------------------------------------------------------------

const LIB_OK = isLibAvailable();

function skipIfNoLib(name: string, fn: () => void | Promise<void>) {
  if (!LIB_OK) {
    test.skip(`${name} [SKIP: libcurl-impersonate not available]`, () => {});
    return;
  }
  test(name, fn);
}

// ---------------------------------------------------------------------------
// Minimal HTML fixture that mimics a Challonge /module page
// ---------------------------------------------------------------------------

const FAKE_HTML = `<!DOCTYPE html><html><head><title>Fake Tournament - Challonge</title>
<meta property="og:title" content="Fake Tournament - Challonge">
<meta property="og:url" content="https://challonge.com/fake_slug/module">
</head><body>
<script>
window._initialStoreState['TournamentStore'] = {"tournament":{"id":42,"name":"Fake Tournament","state":"complete","tournament_type":"double_elimination","started_at":"2026-01-01T00:00:00.000Z","completed_at":"2026-01-02T00:00:00.000Z"},"matches_by_round":{},"third_place_match":null,"consolation_matches":[],"groups":[],"requested_plotter":"bracket"};
window._initialStoreState['CurrentUserStore'] = {"locale":"fr","is_superadmin":false};
window._initialStoreState['LogEntryListStore'] = {"entries":[{"created_at":"2026-01-01T10:00:00Z","type":"match","message":"Test log entry"}]};
window._initialStoreState['ActivityFeedSettingsStore'] = {"currentPage":1,"totalPages":2,"totalCount":10};
</script>
</body></html>`;

const FAKE_HTML_NO_STORE = `<!DOCTYPE html><html><head><title>Challonge Error</title></head><body><p>Error 403</p></body></html>`;

// ---------------------------------------------------------------------------
// Unit tests — offline, no .so required
// ---------------------------------------------------------------------------

describe("ChallongeScraper — constructor + lifecycle", () => {
  test("does not spawn Chromium on construction", () => {
    const logs: string[] = [];
    const scraper = new ChallongeScraper({ log: (m) => logs.push(m) });
    // No browser-related log expected
    expect(logs.filter((l) => l.toLowerCase().includes("browser"))).toHaveLength(0);
    // Transport should be null until first use
    expect((scraper as unknown as Record<string, unknown>)["transport"]).toBeNull();
  });

  test("init() returns under 10ms", async () => {
    const scraper = new ChallongeScraper({ log: () => {} });
    const start = Date.now();
    await scraper.init();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  test("close() does not throw when transport was never opened", async () => {
    const scraper = new ChallongeScraper({ log: () => {} });
    await expect(scraper.close()).resolves.toBeUndefined();
  });

  test("legacy options trigger warn logs, not errors", () => {
    const logs: string[] = [];
    const scraper = new ChallongeScraper({
      headless: true,
      viewport: { width: 1920, height: 1080 },
      blockResources: false,
      useRebrowser: false,
      navigationTimeoutMs: 30_000,
      log: (m) => logs.push(m),
    });
    void scraper; // suppress unused warning
    const warns = logs.filter((l) => l.includes("ignored in bxc mode"));
    expect(warns.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// FakePage unit tests — uses mock transport, no network
// ---------------------------------------------------------------------------

describe("FakePage — offline mock", () => {
  let scraper: ChallongeScraper;
  let page: FakePage;

  // Patch transport.fetch before each test to return FAKE_HTML
  beforeEach(async () => {
    scraper = new ChallongeScraper({ log: () => {} });

    // Trigger transport creation
    const t = (scraper as unknown as { getTransport: () => unknown }).getTransport();
    // Mock fetch
    (t as unknown as { fetch: unknown }).fetch = mock(async () => ({
      status: 200,
      finalUrl: "https://challonge.com/fake_slug/module",
      headers: {},
      body: FAKE_HTML,
      timeSec: 0.1,
      fromCache: false,
    }));

    page = await scraper.openPage("https://challonge.com/fake_slug/module");
  });

  test("content() returns HTML string", async () => {
    const html = await page.content();
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("Fake Tournament");
  });

  test("evaluate(() => window._initialStoreState) returns Record<string, unknown>", async () => {
    const result = await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["_initialStoreState"],
    );
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    const store = result as Record<string, unknown>;
    expect(store).toHaveProperty("TournamentStore");
    const ts = store["TournamentStore"] as Record<string, unknown>;
    expect((ts["tournament"] as Record<string, unknown>)["id"]).toBe(42);
  });

  test("evaluate(string with _initialStoreState) returns store", async () => {
    const result = await page.evaluate("window._initialStoreState");
    expect(typeof result).toBe("object");
    const store = result as Record<string, unknown>;
    expect(store).toHaveProperty("LogEntryListStore");
  });

  test("evaluate(() => document.title) throws with clear message", async () => {
    await expect(
      page.evaluate(() => (document as unknown as Record<string, unknown>)["title"]),
    ).rejects.toThrow("page.evaluate(<arbitrary JS>) is not supported in bxc mode");
  });

  test("evaluate(arbitrary expression string) throws CurlImpersonateError", async () => {
    await expect(page.evaluate("document.querySelectorAll('tr')")).rejects.toBeInstanceOf(
      CurlImpersonateError,
    );
  });

  test("waitForFunction resolves immediately (no-op)", async () => {
    const start = Date.now();
    await page.waitForFunction("!!document.querySelector('main')", {
      timeout: 10_000,
    });
    expect(Date.now() - start).toBeLessThan(50);
  });

  test("waitForSelector resolves immediately (no-op)", async () => {
    const start = Date.now();
    await page.waitForSelector("[class*='bracket']", { timeout: 15_000 });
    expect(Date.now() - start).toBeLessThan(50);
  });

  test("close() resolves immediately (no-op)", async () => {
    await expect(page.close()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseStoreState unit test — uses the HTML fixture
// ---------------------------------------------------------------------------

describe("parseStoreState — offline", () => {
  test("extracts all store keys from FAKE_HTML via openPage.evaluate", async () => {
    const scraper = new ChallongeScraper({ log: () => {} });
    const t = (scraper as unknown as { getTransport: () => unknown }).getTransport();
    (t as unknown as { fetch: unknown }).fetch = mock(async () => ({
      status: 200,
      finalUrl: "https://challonge.com/fake_slug/module",
      headers: {},
      body: FAKE_HTML,
      timeSec: 0.1,
      fromCache: false,
    }));

    const p = await scraper.openPage("https://challonge.com/fake_slug");
    const store = (await p.evaluate("window._initialStoreState")) as Record<string, unknown>;

    expect(Object.keys(store)).toContain("TournamentStore");
    expect(Object.keys(store)).toContain("CurrentUserStore");
    expect(Object.keys(store)).toContain("LogEntryListStore");
    expect(Object.keys(store)).toContain("ActivityFeedSettingsStore");
  });

  test("returns empty object for HTML without store assignments", async () => {
    const scraper = new ChallongeScraper({ log: () => {} });
    const t = (scraper as unknown as { getTransport: () => unknown }).getTransport();
    (t as unknown as { fetch: unknown }).fetch = mock(async () => ({
      status: 200,
      finalUrl: "https://challonge.com/fake_slug",
      headers: {},
      body: FAKE_HTML_NO_STORE,
      timeSec: 0.1,
      fromCache: false,
    }));

    const p = await scraper.openPage("https://challonge.com/fake_slug");
    const store = (await p.evaluate("window._initialStoreState")) as Record<string, unknown>;

    expect(Object.keys(store)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Network tests — skip when FFI unavailable
// ---------------------------------------------------------------------------

describe("ChallongeScraper — network (skipped when FFI unavailable)", () => {
  skipIfNoLib("openPage(url).content() returns non-empty HTML", async () => {
    const scraper = new ChallongeScraper({ log: () => {} });
    try {
      const page = await scraper.openPage("https://challonge.com/fr/B_TS5/module");
      const html = await page.content();
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(1000);
    } finally {
      await scraper.close();
    }
  });

  skipIfNoLib(
    "openPage(url).evaluate(() => window._initialStoreState) returns non-null store",
    async () => {
      const scraper = new ChallongeScraper({ log: () => {} });
      try {
        const page = await scraper.openPage("https://challonge.com/fr/B_TS5/module");
        const store = (await page.evaluate(
          () => (window as unknown as Record<string, unknown>)["_initialStoreState"],
        )) as Record<string, unknown>;
        expect(typeof store).toBe("object");
        expect(store).not.toBeNull();
      } finally {
        await scraper.close();
      }
    },
  );
});

describe("dumpChallongeRaw — network (skipped when FFI unavailable)", () => {
  skipIfNoLib("returns html, store, and parsed snapshot for /module", async () => {
    const result = await dumpChallongeRaw("fr/B_TS5", "module");
    expect(typeof result.html).toBe("string");
    expect(result.html.length).toBeGreaterThan(1000);
    expect(typeof result.store).toBe("object");
    // parsed may be null if TournamentStore is absent (cookie wall)
    // but the function itself must not throw
    expect(result.parsed === null || typeof result.parsed === "object").toBe(true);
  });

  skipIfNoLib("returns empty parsed for non-module sub", async () => {
    const result = await dumpChallongeRaw("fr/B_TS5", "log", { page: 1 });
    expect(typeof result.html).toBe("string");
    expect(result.parsed).toBeNull();
  });
});
