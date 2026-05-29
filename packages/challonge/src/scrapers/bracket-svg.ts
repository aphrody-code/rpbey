/**
 * Bracket SVG parser — extracts match layout from the `<g class="match">` SVG
 * elements embedded in Challonge tournament HTML pages.
 *
 * Challonge renders the final-stage / single-elim / double-elim bracket as an
 * inline SVG where each match is a `<g class="match -complete|-open|-pending">`
 * element carrying:
 *   - `data-match-id`       : integer Challonge match id
 *   - `data-identifier`     : string round identifier (e.g. "A", "GF1")
 *   - `transform="translate(X Y)"` : pixel coordinates — round inferred from X,
 *                                    bracket side from Y in double-elim
 *
 * Each player slot is an `<svg class="match--player">` containing:
 *   - `data-participant-id` : integer Challonge participant id
 *   - `<text class="match--seed">` : seed number
 *   - `<text class^="match--player-name">` : display name + "-winner" class
 *   - `<text class^="match--player-score">` : score integer
 *
 * This module is intentionally lightweight — it replaces the SVG section of
 * the legacy `HTMLRewriter`-based transport without pulling in any DOM library.
 *
 * @example
 *   import { type parseBracketSvg } from "../scrapers/bracket-svg";
 *   const matches = parseBracketSvg(html);
 *   // matches[0].matchId, matches[0].x, matches[0].player1.name, ...
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single player slot inside a bracket match.
 */
export interface BracketPlayer {
  /** Real Challonge participant id (from `data-participant-id`), or null if TBD. */
  participantId: number | null;
  /** Display name as rendered in the bracket SVG. */
  name: string;
  /** Seeding integer, or null if hidden. */
  seed: number | null;
  /** Score as rendered, or null if not yet played. */
  score: number | null;
  /** True when the player name element carries the `-winner` class. */
  winner: boolean;
}

/**
 * A match node extracted from the bracket SVG.
 *
 * Coordinate system: `x` and `y` come from the `translate(X Y)` transform on
 * the `<g class="match">` element. Challonge aligns all matches of the same
 * round at the same `x` position; y is used to separate WB from LB rows in
 * double-elimination brackets.
 */
export interface BracketMatch {
  /** Integer Challonge match id. */
  matchId: number;
  /** String match identifier (e.g. "A", "GF1"). */
  identifier: string;
  /** Match lifecycle state. */
  state: "complete" | "open" | "pending" | string;
  /** Horizontal pixel coordinate — used to infer round number. */
  x: number;
  /** Vertical pixel coordinate — used to infer bracket side in double-elim. */
  y: number;
  /** First player slot, or null when not yet known. */
  player1: BracketPlayer | null;
  /** Second player slot, or null when not yet known. */
  player2: BracketPlayer | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a CSS `translate(X Y)` transform string into `{ x, y }` pixel coords.
 * Returns `{ x: 0, y: 0 }` when the attribute is absent or malformed.
 */
function parseTransform(val: string | null): { x: number; y: number } {
  const m = val?.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
  return {
    x: m ? parseFloat(m[1] ?? "0") : 0,
    y: m ? parseFloat(m[2] ?? "0") : 0,
  };
}

// ---------------------------------------------------------------------------
// Public extractor
// ---------------------------------------------------------------------------

/**
 * Parse all bracket match nodes from a Challonge tournament HTML page.
 *
 * Uses `Bun.HTMLRewriter` in streaming mode — no DOM, no allocations beyond
 * the output array.  Typically completes in < 3 ms for a 230 KB Challonge page.
 *
 * Returns an empty array when the page contains no SVG bracket (e.g. for a
 * pure round-robin tournament or when the bracket has not yet been started).
 */
export async function parseBracketSvg(html: string): Promise<BracketMatch[]> {
  const bracketMatches: BracketMatch[] = [];

  let currentMatch: BracketMatch | null = null;
  let currentPlayer: BracketPlayer | null = null;
  let inPlayerName = false;
  let inPlayerScore = false;
  let inPlayerSeed = false;
  const playerNameBuf: string[] = [];
  const playerScoreBuf: string[] = [];
  const playerSeedBuf: string[] = [];

  const rewriter = new HTMLRewriter()
    .on("g.match", {
      element(el) {
        const matchId = parseInt(el.getAttribute("data-match-id") ?? "0", 10);
        if (!matchId) return;
        const cls = el.getAttribute("class") ?? "";
        const stateMatch = cls.match(/\s-(complete|open|pending|locked)\b/);
        const transform = parseTransform(el.getAttribute("transform"));
        currentMatch = {
          matchId,
          identifier: el.getAttribute("data-identifier") ?? "",
          state: stateMatch ? (stateMatch[1] ?? "pending") : "pending",
          x: transform.x,
          y: transform.y,
          player1: null,
          player2: null,
        };
        el.onEndTag(() => {
          if (currentMatch) bracketMatches.push(currentMatch);
          currentMatch = null;
        });
      },
    })
    .on("svg.match--player", {
      element(el) {
        if (!currentMatch) return;
        const pid = parseInt(el.getAttribute("data-participant-id") ?? "", 10);
        currentPlayer = {
          participantId: Number.isFinite(pid) && pid > 0 ? pid : null,
          name: "",
          seed: null,
          score: null,
          winner: false,
        };
        el.onEndTag(() => {
          if (!currentMatch || !currentPlayer) return;
          if (!currentMatch.player1) currentMatch.player1 = currentPlayer;
          else if (!currentMatch.player2) currentMatch.player2 = currentPlayer;
          currentPlayer = null;
        });
      },
    })
    .on("text.match--seed", {
      element(el) {
        if (!currentPlayer) return;
        inPlayerSeed = true;
        playerSeedBuf.length = 0;
        el.onEndTag(() => {
          inPlayerSeed = false;
          if (currentPlayer) {
            const seed = parseInt(playerSeedBuf.join("").trim(), 10);
            currentPlayer.seed = Number.isFinite(seed) ? seed : null;
          }
        });
      },
      text(t) {
        if (inPlayerSeed && t.text) playerSeedBuf.push(t.text);
      },
    })
    .on('text[class^="match--player-name"]', {
      element(el) {
        if (!currentPlayer) return;
        inPlayerName = true;
        playerNameBuf.length = 0;
        const cls = el.getAttribute("class") ?? "";
        if (cls.includes("-winner") && currentPlayer) {
          currentPlayer.winner = true;
        }
        el.onEndTag(() => {
          inPlayerName = false;
          if (currentPlayer) {
            currentPlayer.name = playerNameBuf.join("").replace(/\s+/g, " ").trim();
          }
        });
      },
      text(t) {
        if (inPlayerName && t.text) playerNameBuf.push(t.text);
      },
    })
    .on('text[class^="match--player-score"]', {
      element(el) {
        if (!currentPlayer) return;
        inPlayerScore = true;
        playerScoreBuf.length = 0;
        el.onEndTag(() => {
          inPlayerScore = false;
          if (currentPlayer) {
            const raw = playerScoreBuf.join("").trim();
            const n = parseInt(raw, 10);
            currentPlayer.score = Number.isFinite(n) ? n : null;
          }
        });
      },
      text(t) {
        if (inPlayerScore && t.text) playerScoreBuf.push(t.text);
      },
    });

  await rewriter.transform(new Response(html)).text();

  return bracketMatches;
}
