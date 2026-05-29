/**
 * Games-catalogue parser (pure, bundlable).
 *
 * Parses the Challonge `/games.json` payload — a flat array of
 * `{ id, value, tokens[], permalink }` objects — into `ChallongeGame[]`, and
 * offers a case-insensitive lookup helper to pin a stable `game_id`
 * (e.g. Beyblade X = 337197) across tournaments.
 *
 * ZERO bxc / transport / FFI imports. Input is either a raw JSON string or an
 * already-parsed value; output is `ChallongeGame[]`. Universally bundlable
 * (Next.js / browser).
 *
 * @module extractors/stores/games-catalog
 */

import { type ChallongeGame } from "../../types";

/**
 * Coerce one raw catalogue entry into a `ChallongeGame`, or `null` when it has
 * no usable identity (missing/invalid `id` or `value`).
 */
function coerceGame(raw: unknown): ChallongeGame | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const idRaw = o.id;
  const id =
    typeof idRaw === "number"
      ? idRaw
      : typeof idRaw === "string" && idRaw.trim() !== "" && Number.isFinite(Number(idRaw))
        ? Number(idRaw)
        : null;
  if (id === null || !Number.isFinite(id)) return null;

  const value = typeof o.value === "string" ? o.value : null;
  if (value === null) return null;

  const tokens = Array.isArray(o.tokens)
    ? o.tokens.filter((t): t is string => typeof t === "string")
    : undefined;

  const permalink = typeof o.permalink === "string" ? o.permalink : null;

  const game: ChallongeGame = { id, value, permalink };
  if (tokens !== undefined) game.tokens = tokens;
  return game;
}

/**
 * Parse the `/games.json` payload into `ChallongeGame[]`.
 *
 * Accepts either a raw JSON string (parsed internally) or an already-parsed
 * value. Tolerates the array living under a wrapper key (`games`/`data`).
 * Entries missing a usable `id` or `value` are dropped; never throws on bad
 * input — returns an empty array instead.
 *
 * @param json  Raw `/games.json` string, or the parsed value.
 * @returns Parsed catalogue, in source order.
 */
export function parseGamesCatalog(json: string | unknown): ChallongeGame[] {
  let parsed: unknown = json;
  if (typeof json === "string") {
    try {
      parsed = JSON.parse(json);
    } catch {
      return [];
    }
  }

  let arr: unknown[];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed !== null && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.games)) arr = o.games;
    else if (Array.isArray(o.data)) arr = o.data;
    else return [];
  } else {
    return [];
  }

  const out: ChallongeGame[] = [];
  for (const entry of arr) {
    const game = coerceGame(entry);
    if (game !== null) out.push(game);
  }
  return out;
}

/**
 * Case-insensitive lookup of a game by name.
 *
 * Matches against `value` first, then any `tokens` entry (exact, lowercased).
 * Useful to figer a stable `game_id` from a human-typed name
 * (`findGameByName(games, "Beyblade X")` → id 337197).
 *
 * @param games  Parsed catalogue (from {@link parseGamesCatalog}).
 * @param q      Game name / token to look up.
 * @returns The first matching game, or `undefined`.
 */
export function findGameByName(games: ChallongeGame[], q: string): ChallongeGame | undefined {
  const needle = q.trim().toLowerCase();
  if (needle === "") return undefined;
  for (const game of games) {
    if (game.value.toLowerCase() === needle) return game;
  }
  for (const game of games) {
    if (game.tokens?.some((t) => t.toLowerCase() === needle)) return game;
  }
  return undefined;
}
