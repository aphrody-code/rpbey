/**
 * Tests for the games-catalogue parser (`extractors/stores/games-catalog`).
 *
 * The inline mini-payload tests are ALWAYS active (no fixture dependency).
 * The fixture-backed assertions run only when `tests/fixtures/games.json`
 * (or `data/challonge-games.json`) is present.
 */

import { describe, expect, it } from "bun:test";
import { findGameByName, parseGamesCatalog } from "../src/extractors/stores/games-catalog";

const MINI = [
  {
    id: 337197,
    value: "Beyblade X",
    tokens: ["Beyblade", "X"],
    permalink: "beyblade-x",
  },
  { id: 758, value: "Beyblade", tokens: ["Beyblade"], permalink: "beyblade" },
  { id: 202503, value: "0 A.D.", tokens: ["0", "A.D."], permalink: "0-ad" },
];

describe("parseGamesCatalog — inline", () => {
  it("parses an already-parsed array", () => {
    const games = parseGamesCatalog(MINI);
    expect(games.length).toBe(3);
    expect(games[0]).toEqual({
      id: 337197,
      value: "Beyblade X",
      tokens: ["Beyblade", "X"],
      permalink: "beyblade-x",
    });
  });

  it("parses a raw JSON string", () => {
    const games = parseGamesCatalog(JSON.stringify(MINI));
    expect(games.length).toBe(3);
    expect(games[1].value).toBe("Beyblade");
  });

  it("unwraps a { games: [...] } / { data: [...] } envelope", () => {
    expect(parseGamesCatalog({ games: MINI }).length).toBe(3);
    expect(parseGamesCatalog({ data: MINI }).length).toBe(3);
  });

  it("coerces a string id and tolerates a missing permalink", () => {
    const games = parseGamesCatalog([{ id: "42", value: "Foo" }]);
    expect(games.length).toBe(1);
    expect(games[0]).toEqual({ id: 42, value: "Foo", permalink: null });
  });

  it("drops entries without a usable id or value", () => {
    const games = parseGamesCatalog([
      { value: "no id" },
      { id: 1 },
      { id: "nan", value: "bad id" },
      null,
      "garbage",
      { id: 7, value: "good" },
    ]);
    expect(games.length).toBe(1);
    expect(games[0]).toEqual({ id: 7, value: "good", permalink: null });
  });

  it("returns [] on malformed JSON / non-catalogue input", () => {
    expect(parseGamesCatalog("not json {")).toEqual([]);
    expect(parseGamesCatalog(42)).toEqual([]);
    expect(parseGamesCatalog(null)).toEqual([]);
    expect(parseGamesCatalog({ foo: "bar" })).toEqual([]);
  });
});

describe("findGameByName — inline", () => {
  const games = parseGamesCatalog(MINI);

  it("finds by value, case-insensitive", () => {
    expect(findGameByName(games, "Beyblade X")?.id).toBe(337197);
    expect(findGameByName(games, "beyblade x")?.id).toBe(337197);
    expect(findGameByName(games, "  BEYBLADE X  ")?.id).toBe(337197);
  });

  it("prefers an exact value match over a token match", () => {
    // "Beyblade" matches both #758 (value) and #337197 (token) — value wins.
    expect(findGameByName(games, "Beyblade")?.id).toBe(758);
  });

  it("falls back to tokens when no value matches", () => {
    expect(findGameByName(games, "A.D.")?.id).toBe(202503);
  });

  it("returns undefined for unknown / empty queries", () => {
    expect(findGameByName(games, "Tetris")).toBeUndefined();
    expect(findGameByName(games, "   ")).toBeUndefined();
  });
});

// ─── Fixture-backed (skipped when no fixture present) ────────────────────────

const FIXTURE_CANDIDATES = [
  new URL("./fixtures/games.json", import.meta.url).pathname,
  new URL("../data/challonge-games.json", import.meta.url).pathname,
];

async function loadFixture(): Promise<string | null> {
  for (const path of FIXTURE_CANDIDATES) {
    const file = Bun.file(path);
    if (await file.exists()) return file.text();
  }
  return null;
}

const fixtureRaw = await loadFixture();
const describeFixture = fixtureRaw === null ? describe.skip : describe;

describeFixture("parseGamesCatalog — real /games.json fixture", () => {
  const games = parseGamesCatalog(fixtureRaw ?? "[]");

  it("parses a non-empty catalogue", () => {
    expect(games.length).toBeGreaterThan(100);
  });

  it("findGameByName('Beyblade X') resolves the real game_id (337197)", () => {
    const bx = findGameByName(games, "Beyblade X");
    expect(bx).toBeDefined();
    expect(bx?.id).toBe(337197);
    expect(bx?.permalink).toBe("beyblade-x");
  });
});
