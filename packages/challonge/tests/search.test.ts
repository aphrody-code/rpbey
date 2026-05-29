/**
 * Tests for the search + games client (`clients/search`).
 *
 *   - `listGames` reads the on-disk fixture (`data/challonge-games.json` /
 *     `tests/fixtures/games.json`) — ALWAYS active, zero network. Asserts a
 *     non-trivial catalogue and that `findGame('Beyblade X')` resolves 337197.
 *   - `searchTournaments` runs against a FAKE transport returning a canned
 *     `/tournaments.json` payload — zero network. Asserts collection parsing,
 *     `nextPage`, the HTML fallback, and that the JSON endpoint is preferred.
 *   - One live test (`CHALLONGE_LIVE`-gated) hits the real endpoint.
 */

import { describe, expect, it } from "bun:test";
import { findGame, listGames, searchTournaments } from "../src/clients/search";
import type { Transport, TransportRequest, TransportResponse } from "../src/transports/transport";

// ─── Fake transport ──────────────────────────────────────────────────────────

interface FakeCall {
  url: string;
  opts?: TransportRequest;
}

/**
 * Records every fetch and returns a canned response keyed by URL substring.
 * `routes` maps a URL fragment → `{ status?, body }`; the first matching key
 * wins. Unmatched URLs yield a 404 with an empty body.
 */
function makeFakeTransport(routes: Record<string, { status?: number; body: string }>): {
  transport: Transport;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];
  const transport: Transport = {
    async fetch(url: string, opts?: TransportRequest): Promise<TransportResponse> {
      calls.push({ url, opts });
      for (const [frag, resp] of Object.entries(routes)) {
        if (url.includes(frag)) {
          return {
            status: resp.status ?? 200,
            finalUrl: url,
            headers: {},
            body: resp.body,
            timeSec: 0,
            fromCache: false,
          };
        }
      }
      return {
        status: 404,
        finalUrl: url,
        headers: {},
        body: "",
        timeSec: 0,
        fromCache: false,
      };
    },
  };
  return { transport, calls };
}

const MOCK_COLLECTION = JSON.stringify({
  next_page: 2,
  collection: [
    {
      name: "Beyblade X TS4",
      link: "/B_TS4",
      owner: "rpb",
      filter: { id: 337197, name: "Beyblade X" },
      banner: "https://challonge.com/banners/ts4.png",
      organizer: "RPB",
    },
    {
      name: "World Open",
      link: "https://wbo.challonge.com/world-open",
      owner: null,
      filter: { id: 758, name: "Beyblade" },
    },
    // dropped: no name
    { link: "/no-name" },
  ],
});

// ─── listGames (cache fixture — always active) ───────────────────────────────

const FIXTURE_CACHE = new URL("../data/challonge-games.json", import.meta.url).pathname;

describe("listGames — disk cache (no network)", () => {
  it("reads the P3 games cache and parses >100 games", async () => {
    const games = await listGames({ cachePath: FIXTURE_CACHE });
    expect(games.length).toBeGreaterThan(100);
  });

  it("findGame('Beyblade X') resolves the stable game_id 337197", async () => {
    const games = await listGames({ cachePath: FIXTURE_CACHE });
    const bx = findGame(games, "Beyblade X");
    expect(bx).toBeDefined();
    expect(bx?.id).toBe(337197);
  });

  it("never touches the transport when the cache is present", async () => {
    const { transport, calls } = makeFakeTransport({});
    const games = await listGames({ cachePath: FIXTURE_CACHE, transport });
    expect(games.length).toBeGreaterThan(100);
    expect(calls.length).toBe(0);
  });

  it("falls back to a live /games.json fetch when the cache is absent", async () => {
    const { transport, calls } = makeFakeTransport({
      "/games.json": {
        body: JSON.stringify([{ id: 1, value: "Foo", permalink: "foo" }]),
      },
    });
    const games = await listGames({
      cachePath: "/nonexistent/games.json",
      transport,
    });
    expect(games.length).toBe(1);
    expect(games[0].value).toBe("Foo");
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/games.json");
  });
});

// ─── searchTournaments (fake transport — no network) ─────────────────────────

describe("searchTournaments — JSON collection (fake transport)", () => {
  it("parses the AJAX collection into SearchResult[]", async () => {
    const { transport, calls } = makeFakeTransport({
      "/tournaments.json": { body: MOCK_COLLECTION },
    });
    const { nextPage, results } = await searchTournaments({
      q: "beyblade",
      gameId: 337197,
      page: 1,
      transport,
    });

    expect(nextPage).toBe(2);
    expect(results.length).toBe(2); // the no-name entry is dropped

    expect(results[0]).toEqual({
      name: "Beyblade X TS4",
      slug: "B_TS4",
      url: "https://challonge.com/B_TS4",
      owner: "rpb",
      gameName: "Beyblade X",
      bannerUrl: "https://challonge.com/banners/ts4.png",
      organizer: "RPB",
    });

    // Absolute link kept as-is; slug derived from the last path segment.
    expect(results[1].slug).toBe("world-open");
    expect(results[1].url).toBe("https://wbo.challonge.com/world-open");
    expect(results[1].gameName).toBe("Beyblade");
  });

  it("hits /tournaments.json first with the AJAX headers", async () => {
    const { transport, calls } = makeFakeTransport({
      "/tournaments.json": { body: MOCK_COLLECTION },
    });
    await searchTournaments({
      q: "x",
      gameId: 337197,
      state: "complete",
      page: 3,
      transport,
    });

    expect(calls.length).toBe(1);
    const call = calls[0];
    expect(call.url).toContain("/tournaments.json");
    expect(call.url).toContain("q=x");
    expect(call.url).toContain("game_id=337197");
    expect(call.url).toContain("state=complete");
    expect(call.url).toContain("page=3");
    expect(call.opts?.extraHeaders?.["X-Requested-With"]).toBe("XMLHttpRequest");
    expect(call.opts?.extraHeaders?.Accept).toBe("application/json");
  });

  it("falls back to the SSR HTML page when JSON is not the expected shape", async () => {
    const html =
      `<html><body>` +
      `<a href="https://challonge.com/B_TS4">Beyblade X TS4</a>` +
      `<a href="https://challonge.com/login">Login</a>` +
      `<a rel="next" href="/tournaments?page=2">Next</a>` +
      `</body></html>`;
    const { transport, calls } = makeFakeTransport({
      "/tournaments.json": { body: "<!doctype html><html>not json</html>" },
      "/tournaments?": { body: html },
    });
    const { nextPage, results } = await searchTournaments({
      q: "beyblade",
      transport,
    });

    expect(calls.length).toBe(2); // JSON attempt then HTML fallback
    expect(calls[1].url).toContain("/tournaments?");
    expect(results.length).toBe(1); // login is a static slug, dropped
    expect(results[0].slug).toBe("B_TS4");
    expect(results[0].name).toBe("Beyblade X TS4");
    expect(nextPage).toBe(2);
  });

  it("returns an empty page when both endpoints fail", async () => {
    const { transport } = makeFakeTransport({}); // everything 404s
    const { nextPage, results } = await searchTournaments({
      q: "nothing",
      transport,
    });
    expect(results).toEqual([]);
    expect(nextPage).toBeNull();
  });
});

// ─── Live (opt-in) ───────────────────────────────────────────────────────────

const live = process.env.CHALLONGE_LIVE ? it : it.skip;

describe("searchTournaments — live", () => {
  live("returns real Beyblade X tournaments", async () => {
    const { results } = await searchTournaments({
      q: "beyblade",
      gameId: 337197,
      page: 1,
    });
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0].name.length).toBeGreaterThan(0);
      expect(results[0].slug.length).toBeGreaterThan(0);
      expect(results[0].url).toContain("challonge.com");
    }
  });
});
