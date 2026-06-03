/**
 * Smoke tests for the rewritten ChallongeReverse (Phase 2A).
 *
 * All tests skip when the Challonge cookie file is absent or when the
 * curl-impersonate FFI lib is unavailable.  They perform live network calls
 * against challonge.com.
 *
 * Run only in environments where:
 *   - ~/bxc/cookies/private/challonge.json exists
 *   - libcurl_impersonate is available (isLibAvailable() === true)
 *
 * The slug used is "B_TS5" (a completed tournament with public visibility).
 */

import { describe, test, expect, beforeAll } from "bun:test";
import os from "node:os";
import { join } from "node:path";
import { ChallongeReverse, ChallongeReverseError, type LogPageResult } from "../src/reverse";
import { isLibAvailable } from "@aphrody/bxc/ffi/curl-impersonate";

// ---------------------------------------------------------------------------
// Skip logic
// ---------------------------------------------------------------------------

const COOKIE_PATH = join(os.homedir(), "bxc/cookies/private/challonge.json");
const SLUG = "B_TS5";
const NET_TIMEOUT = 15_000;

let shouldSkip = false;
let skipReason = "";

function logSkip(reason: string): void {
  shouldSkip = true;
  skipReason = reason;
  console.error(`[reverse-smoke] SKIP: ${reason}`);
}

beforeAll(async () => {
  if (!isLibAvailable()) {
    logSkip("libcurl_impersonate FFI not available");
    return;
  }
  const cookieFile = Bun.file(COOKIE_PATH);
  const exists = await cookieFile.exists();
  if (!exists) {
    logSkip(`Cookie file not found: ${COOKIE_PATH}`);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(): ChallongeReverse {
  return new ChallongeReverse({
    cookiePath: COOKIE_PATH,
    safeRedirects: false,
    cache: false, // disable cache so each test exercises the real fetch path
    timeoutSec: 12,
  });
}

// ---------------------------------------------------------------------------
// getStore smoke
// ---------------------------------------------------------------------------

describe("ChallongeReverse.getStore (smoke)", () => {
  test(
    "getStore returns tournament with required keys and at least one round",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const store = await client.getStore(SLUG);
      expect(typeof store.tournament).toBe("object");
      expect(store.tournament).not.toBeNull();
      const id = store.tournament["id"];
      expect(typeof id === "number" || typeof id === "string").toBe(true);
      expect(store).toHaveProperty("rounds");
      expect(store).toHaveProperty("matches_by_round");
      expect(Array.isArray(store.rounds)).toBe(true);
      const roundKeys = Object.keys(store.matches_by_round);
      expect(roundKeys.length).toBeGreaterThan(0);
    },
    NET_TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// getLog smoke
// ---------------------------------------------------------------------------

describe("ChallongeReverse.getLog (smoke)", () => {
  test(
    "getLog returns an array (may be empty — SSR can return {})",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const entries = await client.getLog(SLUG);
      expect(Array.isArray(entries)).toBe(true);
      // If not empty, entries must have the ScrapedLogEntry shape
      if (entries.length > 0) {
        const first = entries[0];
        expect(typeof first.timestamp).toBe("string");
        expect(typeof first.type).toBe("string");
        expect(typeof first.message).toBe("string");
      }
    },
    NET_TIMEOUT,
  );

  test(
    "getLog with explicit page=1 returns same length as getLog without page",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const [withoutPage, withPage] = await Promise.all([
        client.getLog(SLUG),
        client.getLog(SLUG, 1),
      ]);
      expect(withoutPage.length).toBe(withPage.length);
    },
    NET_TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// getLogPage smoke
// ---------------------------------------------------------------------------

describe("ChallongeReverse.getLogPage (smoke)", () => {
  test(
    "getLogPage returns LogPageResult with required shape",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const result: LogPageResult = await client.getLogPage(SLUG, 1);
      expect(Array.isArray(result.entries)).toBe(true);
      expect(typeof result.currentPage).toBe("number");
      expect(typeof result.totalPages).toBe("number");
      expect(typeof result.totalCount).toBe("number");
      expect(result.currentPage).toBeGreaterThanOrEqual(1);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    },
    NET_TIMEOUT,
  );

  test(
    "getLogPage currentPage is at least 1",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const result = await client.getLogPage(SLUG, 1);
      // Pagination defaults to page 1 when store state is absent (SSR {})
      expect(result.currentPage).toBeGreaterThanOrEqual(1);
    },
    NET_TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// getPage smoke
// ---------------------------------------------------------------------------

describe("ChallongeReverse.getPage (smoke)", () => {
  test(
    "getPage on root returns ReversePage with non-empty body",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const page = await client.getPage(SLUG);
      expect(typeof page.body).toBe("string");
      expect(page.body.length).toBeGreaterThan(1000);
      expect(page.status).toBe(200);
      expect(typeof page.url).toBe("string");
      expect(Array.isArray(page.reactRoots)).toBe(true);
    },
    NET_TIMEOUT,
  );

  test(
    "getPage sub is optional — default empty string works",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      const root = await client.getPage(SLUG);
      expect(root.status).toBe(200);
    },
    NET_TIMEOUT,
  );

  test(
    "getPage on a non-existent slug throws ChallongeReverseError",
    async () => {
      if (shouldSkip) {
        console.log(`SKIPPED: ${skipReason}`);
        return;
      }
      const client = makeClient();
      await expect(client.getPage("__nonexistent_slug_xyz_rpb_test__")).rejects.toBeInstanceOf(
        ChallongeReverseError,
      );
    },
    NET_TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// transport getter — pure unit, no network
// ---------------------------------------------------------------------------

describe("ChallongeReverse.transport (getter)", () => {
  test("transport getter exposes BxcTransport with cacheStats()", () => {
    const client = new ChallongeReverse();
    const stats = client.transport.cacheStats();
    expect(typeof stats.hits).toBe("number");
    expect(typeof stats.misses).toBe("number");
    expect(typeof stats.bytes).toBe("number");
    expect(typeof stats.entries).toBe("number");
  });
});
