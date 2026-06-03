/**
 * Crawler unit tests — fully offline via an injected FAKE {@link Transport}.
 *
 * A `FakeTransport` implements the `Transport` interface and routes each URL to
 * a local fixture (`bts4_module.html`, `bts4_standings.html`, …). It returns the
 * exact `CurlImpersonateResponse` shape `BxcTransport` produces, so the crawler
 * runs its real frontier (module → log → standings → participants) with ZERO
 * network. `pacingMs: 0` disables the inter-request delay so the suite is fast.
 *
 * Assertions verify that `crawlTournament` assembles a coherent
 * `ScrapedTournament` from the fake (participants + matches non-empty, standings
 * merged from `/standings`), and that visited-URL dedup + section selection
 * behave. A live test against the real `B_TS4` is gated behind `CHALLONGE_LIVE`.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { crawlOrg, crawlTournament, type CrawlEvent } from "../src/clients/crawler.ts";
import type {
  Transport,
  TransportRequest,
  TransportResponse,
} from "../src/transports/transport.ts";
import { isLibAvailable } from "@aphrody/bxc/ffi/curl-impersonate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

let moduleHtml = "";
let standingsHtml = "";
let participantsHtml = "";
let logHtml = "";
let orgHtml = "";

beforeAll(async () => {
  [moduleHtml, standingsHtml, participantsHtml, logHtml, orgHtml] = await Promise.all([
    Bun.file(FIXTURES + "bts4_module.html").text(),
    Bun.file(FIXTURES + "bts4_standings.html").text(),
    Bun.file(FIXTURES + "bts4_participants.html").text(),
    Bun.file(FIXTURES + "bts4_log.html").text(),
    Bun.file(FIXTURES + "org_landing.html").text(),
  ]);
});

// ---------------------------------------------------------------------------
// FakeTransport — implements the Transport interface, serves local fixtures
// ---------------------------------------------------------------------------

class FakeTransport implements Transport {
  /** Every URL the fake was asked to fetch, in order (for dedup assertions). */
  readonly requested: string[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  async fetch(url: string, _opts?: TransportRequest): Promise<TransportResponse> {
    this.requested.push(url);
    const body = this.#route(url);
    return {
      status: body == null ? 404 : 200,
      finalUrl: url,
      headers: { "content-type": "text/html" },
      body: body ?? "<!DOCTYPE html><html><body>not found</body></html>",
      timeSec: 0.001,
      fromCache: false,
    };
  }

  close(): void {
    /* nothing to release */
  }

  #route(url: string): string | null {
    if (/\/module$/.test(url)) return moduleHtml;
    if (/\/standings$/.test(url)) return standingsHtml;
    if (/\/participants$/.test(url)) return participantsHtml;
    if (/\/log(?:\?|$)/.test(url)) return logHtml;
    if (/challonge\.com\/[a-z]{2}\/?$/.test(url) || /\.challonge\.com/.test(url)) return orgHtml;
    return null;
  }
}

// ---------------------------------------------------------------------------
// crawlTournament — offline via injected fake transport
// ---------------------------------------------------------------------------

describe("crawlTournament — fake transport", () => {
  test("assembles a coherent ScrapedTournament from the fake frontier", async () => {
    const transport = new FakeTransport();
    const t = await crawlTournament("B_TS4", { transport, pacingMs: 0 });

    // Metadata sourced from the /module snapshot.
    expect(t.metadata.id).toBe(17779621);
    expect(t.metadata.name).toBe("Bey-Tamashii Séries #4");
    expect(t.metadata.type.toLowerCase()).toContain("double");

    // Participants + matches come from the module snapshot — must be non-empty.
    expect(t.participants.length).toBeGreaterThan(0);
    expect(t.matches.length).toBeGreaterThan(0);

    // Standings merged from the /standings HTML-table fallback.
    expect(t.standings.length).toBeGreaterThan(0);

    // Every participant has a numeric id + a name.
    for (const p of t.participants.slice(0, 5)) {
      expect(typeof p.id).toBe("number");
      expect(typeof p.name).toBe("string");
    }
  });

  test("fetches the full frontier and dedups visited URLs", async () => {
    const transport = new FakeTransport();
    await crawlTournament("B_TS4", { transport, pacingMs: 0 });

    const urls = transport.requested;
    // All four sections were hit.
    expect(urls.some((u) => /\/module$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/log\?page=1$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/standings$/.test(u))).toBe(true);
    expect(urls.some((u) => /\/participants$/.test(u))).toBe(true);

    // No URL fetched twice (dedup Set).
    expect(new Set(urls).size).toBe(urls.length);
  });

  test("respects the sections option (participants-only skips other pages)", async () => {
    const transport = new FakeTransport();
    const t = await crawlTournament("B_TS4", {
      transport,
      pacingMs: 0,
      sections: ["participants"],
    });

    // No module fetched → metadata falls back, but the call still resolves.
    expect(transport.requested.every((u) => /\/participants$/.test(u))).toBe(true);
    expect(Array.isArray(t.participants)).toBe(true);
  });

  test("emits crawler.page events for fetched pages", async () => {
    const transport = new FakeTransport();
    const events: CrawlEvent[] = [];
    await crawlTournament("B_TS4", {
      transport,
      pacingMs: 0,
      onEvent: (e) => events.push(e),
    });

    const pages = events.filter((e) => e.kind === "crawler.page");
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.some((e) => e.section === "module")).toBe(true);
  });

  test("honours an already-aborted signal", async () => {
    const transport = new FakeTransport();
    const ac = new AbortController();
    ac.abort();
    await expect(
      crawlTournament("B_TS4", { transport, pacingMs: 0, signal: ac.signal }),
    ).rejects.toThrow();
    // Nothing was fetched because the very first frontier.get aborts.
    expect(transport.requested.length).toBe(0);
  });

  test("normalises a full URL down to a bare slug", async () => {
    const transport = new FakeTransport();
    await crawlTournament("https://challonge.com/fr/B_TS4", {
      transport,
      pacingMs: 0,
      sections: ["module"],
    });
    // Locale already present → not double-prefixed.
    expect(transport.requested[0]).toBe("https://challonge.com/fr/B_TS4/module");
  });
});

// ---------------------------------------------------------------------------
// crawlOrg — offline via injected fake transport
// ---------------------------------------------------------------------------

describe("crawlOrg — fake transport", () => {
  test("parses the org landing into a ScrapedOrg via parseOrgLanding", async () => {
    const transport = new FakeTransport();
    const org = await crawlOrg("rpb", { transport });
    expect(typeof org.url).toBe("string");
    expect(Array.isArray(org.tournaments)).toBe(true);
    // The org_landing fixture surfaces at least one tournament.
    expect(org.tournaments.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Live test — opt-in only (real network + libcurl-impersonate required)
// ---------------------------------------------------------------------------

const LIVE = Boolean(process.env["CHALLONGE_LIVE"]) && isLibAvailable();

describe("crawlTournament — live (opt-in via CHALLONGE_LIVE)", () => {
  test.skipIf(!LIVE)("crawls the real B_TS4 tournament", async () => {
    const t = await crawlTournament("B_TS4", { pacingMs: 500 });
    expect(t.participants.length).toBeGreaterThan(0);
    expect(t.matches.length).toBeGreaterThan(0);
  });
});
