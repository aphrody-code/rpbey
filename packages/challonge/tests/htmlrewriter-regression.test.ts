/**
 * Regression test — htmlrewriter snapshot path vs API v1 golden.
 *
 * Loads `bts4_module.html` (real Challonge /module page captured offline),
 * runs it through `fetchAndParseModule` + `parseModuleToScrapedTournament`
 * (snapshot path via `extractChallongeTournament`), and compares the output
 * against the API v1 canonical shape produced by `ChallongeApi.toCanonical`
 * on `bts4_full.json`.
 *
 * Tolerances:
 *   - Timestamps: not compared (TournamentStore in /module pages does not
 *     carry `started_at`/`completed_at`; only `underway_at` is present).
 *   - Participant `emailHash`, `challongeUsername`, `challongeUserId`: not
 *     available in TournamentStore — omitted from assertions.
 *   - `metadata.game` / `metadata.subdomain`: not available in /module HTML.
 *   - Array order: matches and participants compared by id, not by index.
 *
 * No network calls — all fixtures are loaded from disk.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { ChallongeApi, type ChallongeApiTournament } from "../src/api.ts";
import {
  fetchAndParseModule,
  parseModuleToScrapedTournament,
} from "../src/transports/htmlrewriter.ts";
import type { ScrapedTournament } from "../src/types.ts";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

let fromModule: ScrapedTournament;
let fromApi: ScrapedTournament;

beforeAll(async () => {
  const [moduleHtml, fullJson] = await Promise.all([
    Bun.file(FIXTURES + "bts4_module.html").text(),
    Bun.file(FIXTURES + "bts4_full.json").json() as Promise<{
      tournament: ChallongeApiTournament;
    }>,
  ]);

  // Snapshot path: HTML -> extractChallongeTournament -> parseModuleToScrapedTournament
  const moduleData = await fetchAndParseModule("B_TS4", {
    htmlOverride: moduleHtml,
  });
  fromModule = parseModuleToScrapedTournament(moduleData);

  // API v1 path: bts4_full.json -> ChallongeApi.toCanonical
  const api = new ChallongeApi({ apiKey: "fixture-key" });
  fromApi = api.toCanonical(fullJson.tournament, { synthesizeLog: false });
});

// ---------------------------------------------------------------------------
// Snapshot path basics
// ---------------------------------------------------------------------------

describe("fetchAndParseModule — snapshot path", () => {
  test("snapshot is present when TournamentStore is embedded", async () => {
    const html = await Bun.file(FIXTURES + "bts4_module.html").text();
    const data = await fetchAndParseModule("B_TS4", { htmlOverride: html });
    expect(data.snapshot).toBeDefined();
    expect(data.snapshot!.tournament.id).toBe(17779621);
  });

  test("tournamentName extracted correctly", async () => {
    const html = await Bun.file(FIXTURES + "bts4_module.html").text();
    const data = await fetchAndParseModule("B_TS4", { htmlOverride: html });
    expect(data.tournamentName).toBe("Bey-Tamashii Séries #4");
  });

  test("tournamentType is double elimination", async () => {
    const html = await Bun.file(FIXTURES + "bts4_module.html").text();
    const data = await fetchAndParseModule("B_TS4", { htmlOverride: html });
    expect(data.tournamentType).toBe("double elimination");
  });

  test("bracketMatches is empty (no SVG on /module page)", async () => {
    const html = await Bun.file(FIXTURES + "bts4_module.html").text();
    const data = await fetchAndParseModule("B_TS4", { htmlOverride: html });
    // The /module page does not embed a standalone SVG bracket; the React SPA
    // renders it client-side.  SVG bracket parsing is for the main page.
    expect(data.bracketMatches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe("parseModuleToScrapedTournament — metadata (snapshot path)", () => {
  test("metadata.id === 17779621", () => {
    expect(fromModule.metadata.id).toBe(17779621);
  });

  test("metadata.name === 'Bey-Tamashii Séries #4'", () => {
    expect(fromModule.metadata.name).toBe("Bey-Tamashii Séries #4");
  });

  test("metadata.type === 'double elimination'", () => {
    expect(fromModule.metadata.type).toBe("double elimination");
  });

  test("metadata.state === 'complete'", () => {
    // Live-recaptured fixture: B_TS4 finished since the original capture, so the
    // embedded TournamentStore now reports `complete` (was `underway`).
    expect(fromModule.metadata.state).toBe("complete");
  });

  test("metadata.url contains the slug", () => {
    expect(fromModule.metadata.url).toContain("B_TS4");
  });

  test("metadata.participantsCount === 81", () => {
    expect(fromModule.metadata.participantsCount).toBe(81);
  });

  test("metadata.startedAt is null (not in TournamentStore)", () => {
    expect(fromModule.metadata.startedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Participants count parity
// ---------------------------------------------------------------------------

describe("participants — parity with API golden", () => {
  test("same participant count as API (81)", () => {
    expect(fromModule.participants).toHaveLength(fromApi.participants.length);
    expect(fromModule.participants).toHaveLength(81);
  });

  test("all participant ids match the API golden", () => {
    const moduleIds = new Set(fromModule.participants.map((p) => p.id));
    const apiIds = new Set(fromApi.participants.map((p) => p.id));
    // Every id from the module path must be present in the API golden.
    for (const id of moduleIds) {
      expect(apiIds.has(id)).toBe(true);
    }
  });

  test("all participants have a non-empty name", () => {
    for (const p of fromModule.participants) {
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  test("at least 70 participants have a non-null portraitUrl", () => {
    const withPortrait = fromModule.participants.filter((p) => p.portraitUrl != null);
    expect(withPortrait.length).toBeGreaterThanOrEqual(70);
  });
});

// ---------------------------------------------------------------------------
// Matches count + id parity
// ---------------------------------------------------------------------------

describe("matches — parity with API golden", () => {
  test("same match count as API (161)", () => {
    expect(fromModule.matches).toHaveLength(fromApi.matches.length);
    expect(fromModule.matches).toHaveLength(161);
  });

  test("all match ids match the API golden", () => {
    const moduleIds = new Set(fromModule.matches.map((m) => m.id));
    const apiIds = new Set(fromApi.matches.map((m) => m.id));
    for (const id of moduleIds) {
      expect(apiIds.has(id)).toBe(true);
    }
  });

  test("complete matches have the same winner_id as API (when both are complete)", () => {
    // The HTML snapshot and the API golden were captured at different times
    // during a live tournament. A small number of matches transitioned from
    // open -> complete between the two captures. We only assert parity on
    // matches that are marked complete in BOTH sources.
    const apiById = new Map(fromApi.matches.map((m) => [m.id, m]));
    let checked = 0;
    for (const m of fromModule.matches) {
      if (m.state !== "complete") continue;
      const apiMatch = apiById.get(m.id);
      if (!apiMatch || apiMatch.state !== "complete") continue;
      expect(m.winnerId).toBe(apiMatch.winnerId);
      checked++;
    }
    // At least 100 matches should be complete in both sources.
    expect(checked).toBeGreaterThanOrEqual(100);
  });

  test("complete matches have the same scores string as API (when both are complete)", () => {
    const apiById = new Map(fromApi.matches.map((m) => [m.id, m]));
    let checked = 0;
    for (const m of fromModule.matches) {
      if (m.state !== "complete" || !m.scores || m.scores === "0-0") continue;
      const apiMatch = apiById.get(m.id);
      // Skip matches where the API shows open (different capture time).
      if (!apiMatch || apiMatch.state !== "complete") continue;
      expect(m.scores).toBe(apiMatch.scores);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(50);
  });

  test("round numbers match API golden for complete matches", () => {
    const apiById = new Map(fromApi.matches.map((m) => [m.id, m]));
    let checked = 0;
    for (const m of fromModule.matches) {
      if (m.state !== "complete") continue;
      const apiMatch = apiById.get(m.id);
      if (!apiMatch) continue;
      expect(m.round).toBe(apiMatch.round);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// BracketSide distribution (same expectations as api-canonical.test.ts)
// ---------------------------------------------------------------------------

describe("matches — bracketSide distribution", () => {
  test("WB matches > 70", () => {
    const wb = fromModule.matches.filter((m) => m.bracketSide === "WB").length;
    expect(wb).toBeGreaterThan(70);
  });

  test("LB matches > 70", () => {
    const lb = fromModule.matches.filter((m) => m.bracketSide === "LB").length;
    expect(lb).toBeGreaterThan(70);
  });

  test("GF matches >= 1", () => {
    const gf = fromModule.matches.filter((m) => m.bracketSide === "GF").length;
    expect(gf).toBeGreaterThanOrEqual(1);
  });

  test("WB + LB + GF === total matches for double elimination", () => {
    const wb = fromModule.matches.filter((m) => m.bracketSide === "WB").length;
    const lb = fromModule.matches.filter((m) => m.bracketSide === "LB").length;
    const gf = fromModule.matches.filter((m) => m.bracketSide === "GF").length;
    expect(wb + lb + gf).toBe(fromModule.matches.length);
  });

  test("no matches have null bracketSide in a double elim tournament", () => {
    const nullSided = fromModule.matches.filter((m) => m.bracketSide == null);
    expect(nullSided).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Standings (new in snapshot path — was empty in legacy)
// ---------------------------------------------------------------------------

describe("standings — snapshot path", () => {
  test("standings array is non-empty (derived from TournamentStore)", () => {
    expect(fromModule.standings.length).toBeGreaterThan(0);
  });

  test("standings length equals participants count", () => {
    expect(fromModule.standings.length).toBe(fromModule.participants.length);
  });

  test("first standing has rank 1", () => {
    const sortedByRank = [...fromModule.standings].sort((a, b) => a.rank - b.rank);
    expect(sortedByRank[0]!.rank).toBe(1);
  });

  test("all standings have non-empty name", () => {
    for (const s of fromModule.standings) {
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  test("all standings have wins and losses as numbers", () => {
    for (const s of fromModule.standings) {
      expect(typeof s.wins).toBe("number");
      expect(typeof s.losses).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// ScrapedTournament shape invariants
// ---------------------------------------------------------------------------

describe("ScrapedTournament — shape invariants", () => {
  test("stations is empty array", () => {
    expect(fromModule.stations).toHaveLength(0);
  });

  test("log is empty array (no synthesis in module path)", () => {
    expect(fromModule.log).toHaveLength(0);
  });

  test("raw field is the ChallongeTournamentSnapshot", () => {
    expect(fromModule.raw).toBeDefined();
    expect(typeof fromModule.raw).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// parseBracketSvg — standalone bracket SVG parser unit tests
// ---------------------------------------------------------------------------

import { parseBracketSvg } from "../src/scrapers/bracket-svg.ts";

describe("parseBracketSvg — unit", () => {
  test("returns empty array on HTML with no SVG bracket", async () => {
    const result = await parseBracketSvg("<html><body><p>no bracket</p></body></html>");
    expect(result).toHaveLength(0);
  });

  test("parses a minimal inline match SVG", async () => {
    const html = `
      <svg>
        <g class="match -complete" data-match-id="999" data-identifier="A" transform="translate(100 200)">
          <svg class="match--player" data-participant-id="42">
            <text class="match--seed">1</text>
            <text class="match--player-name -winner">Alice</text>
            <text class="match--player-score">3</text>
          </svg>
          <svg class="match--player" data-participant-id="43">
            <text class="match--seed">2</text>
            <text class="match--player-name">Bob</text>
            <text class="match--player-score">1</text>
          </svg>
        </g>
      </svg>
    `;
    const result = await parseBracketSvg(html);
    expect(result).toHaveLength(1);
    const m = result[0]!;
    expect(m.matchId).toBe(999);
    expect(m.identifier).toBe("A");
    expect(m.state).toBe("complete");
    expect(m.x).toBe(100);
    expect(m.y).toBe(200);
    expect(m.player1).not.toBeNull();
    expect(m.player1!.participantId).toBe(42);
    expect(m.player1!.name).toBe("Alice");
    expect(m.player1!.seed).toBe(1);
    expect(m.player1!.score).toBe(3);
    expect(m.player1!.winner).toBe(true);
    expect(m.player2).not.toBeNull();
    expect(m.player2!.participantId).toBe(43);
    expect(m.player2!.name).toBe("Bob");
    expect(m.player2!.winner).toBe(false);
  });

  test("handles pending match with no scores", async () => {
    const html = `
      <svg>
        <g class="match -pending" data-match-id="1000" data-identifier="B" transform="translate(300 100)">
          <svg class="match--player" data-participant-id="0">
            <text class="match--player-name">TBD</text>
          </svg>
          <svg class="match--player" data-participant-id="0">
            <text class="match--player-name">TBD</text>
          </svg>
        </g>
      </svg>
    `;
    const result = await parseBracketSvg(html);
    expect(result).toHaveLength(1);
    const m = result[0]!;
    expect(m.state).toBe("pending");
    expect(m.player1!.score).toBeNull();
    expect(m.player2!.score).toBeNull();
    expect(m.player1!.participantId).toBeNull(); // pid=0 is treated as null
  });

  test("returns empty array on bts4_module.html (no SVG bracket on /module)", async () => {
    const html = await Bun.file(FIXTURES + "bts4_module.html").text();
    const result = await parseBracketSvg(html);
    expect(result).toHaveLength(0);
  });

  test("parses multiple matches with correct x/y", async () => {
    const html = `
      <svg>
        <g class="match -complete" data-match-id="1" data-identifier="A" transform="translate(50 100)">
          <svg class="match--player" data-participant-id="1"></svg>
          <svg class="match--player" data-participant-id="2"></svg>
        </g>
        <g class="match -open" data-match-id="2" data-identifier="B" transform="translate(150 100)">
          <svg class="match--player" data-participant-id="3"></svg>
          <svg class="match--player" data-participant-id="4"></svg>
        </g>
      </svg>
    `;
    const result = await parseBracketSvg(html);
    expect(result).toHaveLength(2);
    expect(result[0]!.x).toBe(50);
    expect(result[1]!.x).toBe(150);
    expect(result[0]!.state).toBe("complete");
    expect(result[1]!.state).toBe("open");
  });
});
