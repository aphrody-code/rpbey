/**
 * Transport HTMLRewriter — typed extraction of a Challonge tournament from
 * its public `/module` page, backed by the bxc `extractChallongeTournament`
 * store parser plus the standalone bracket SVG parser.
 *
 * Two extraction modes:
 *
 *   1. **Snapshot mode** (new, default when `_initialStoreState['TournamentStore']`
 *      is present in the HTML): `extractChallongeTournament(html)` reads the
 *      full match graph from the embedded JSON store, giving real Challonge
 *      participant ids, signed round numbers (WB positive / LB negative), and
 *      per-game scores.  The SVG bracket is parsed in parallel by
 *      `parseBracketSvg(html)` to fill `bracketMatches` for callers that need
 *      X/Y layout coordinates.
 *
 *   2. **Legacy HTMLRewriter mode** (fallback when TournamentStore is absent,
 *      e.g. pure round-robin pages served without the React SPA): the original
 *      `HTMLRewriter`-based standing-table + SVG parser is used, producing
 *      synthetic participant ids and group-stage `rawMatches`.
 *
 * Public API is backward-compatible with the previous implementation:
 *   - `fetchAndParseModule`
 *   - `parseModuleToScrapedTournament`
 *   - `fetchAndParseAsScrapedTournament`
 *   - `fetchPublicTournamentJson`
 *   - Exported types: `BracketMatch`, `BracketPlayer`, `HtmlRewriterModuleData`,
 *     `FetchAndParseOptions`
 */

import {
  extractChallongeTournament,
  type ChallongeTournamentSnapshot,
} from "@aphrody-code/bxc/scrapers/challonge";
import { parseBracketSvg, type BracketMatch } from "../scrapers/bracket-svg";
import {
  type ScrapedMatch,
  type ScrapedParticipant,
  type ScrapedTournament,
  type ScrapedTournamentMetadata,
} from "../types";
import {
  snapshotToScrapedTournament as mapSnapshot,
  type ChallongeSnapshotLike,
} from "../mappers/snapshot";

export type { BracketMatch, BracketPlayer } from "../scrapers/bracket-svg";

// ---------------------------------------------------------------------------
// Re-exported internal types (preserved for backward compat)
// ---------------------------------------------------------------------------

interface MatchHistoryEntry {
  matchId: string;
  matchState: string;
  result: "W" | "L" | "?";
}

interface GroupParticipant {
  rank: number | null;
  displayName: string;
  challongeUsername: string | null;
  portraitUrl: string | null;
  advanced: boolean;
  wins: number;
  losses: number;
  ties: number;
  tb: number;
  setWins: number;
  setTies: number;
  pts: number;
  matchHistory: MatchHistoryEntry[];
}

interface GroupData {
  name: string;
  participants: GroupParticipant[];
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HtmlRewriterModuleData {
  slug: string;
  tournamentName: string | null;
  tournamentType: string | null;
  groups: GroupData[];
  rawMatches: Array<{
    matchId: string;
    groupName: string;
    state: string;
    winnerName?: string;
    loserName?: string;
  }>;
  /** Bracket match nodes from the inline SVG (X/Y coords, player slots). */
  bracketMatches: BracketMatch[];
  /**
   * Full tournament snapshot from `window._initialStoreState['TournamentStore']`.
   * Present when the HTML contains the TournamentStore (most Challonge pages).
   * Callers should prefer this over `groups`/`rawMatches` when present.
   */
  snapshot?: ChallongeTournamentSnapshot;
}

const MODULE_URL = (slug: string): string =>
  `https://challonge.com/${encodeURIComponent(slug)}/module`;

export interface FetchAndParseOptions {
  signal?: AbortSignal;
  /** Provide HTML directly (useful for tests — no network call). */
  htmlOverride?: string;
  /** Optional logger. */
  log?: (msg: string) => void;
  /** HTTP User-Agent. Default: RPB-Bracket-Importer. */
  userAgent?: string;
}

const DEFAULT_UA = "Mozilla/5.0 (compatible; RPB-Bracket-Importer/2; +https://rpbey.fr)";

// ---------------------------------------------------------------------------
// fetchAndParseModule
// ---------------------------------------------------------------------------

/**
 * Fetch + parse the `/module` page for a Challonge tournament.
 *
 * When the page embeds `window._initialStoreState['TournamentStore']` (all
 * modern Challonge pages), the full match graph is extracted via
 * `extractChallongeTournament` and stored in `data.snapshot`.  The bracket
 * SVG is parsed in parallel and stored in `data.bracketMatches`.
 *
 * Falls back to the legacy HTMLRewriter group-standings parser for pages that
 * do not contain the TournamentStore script block.
 */
export async function fetchAndParseModule(
  slug: string,
  options: FetchAndParseOptions = {},
): Promise<HtmlRewriterModuleData> {
  let html: string;
  if (options.htmlOverride) {
    html = options.htmlOverride;
  } else {
    const url = MODULE_URL(slug);
    options.log?.(`[challonge:htmlrewriter] GET ${url}`);
    const res = await fetch(url, {
      signal: options.signal,
      headers: {
        "user-agent": options.userAgent ?? DEFAULT_UA,
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`Challonge HTML fetch failed (HTTP ${res.status}) for ${slug}`);
    }
    html = await res.text();
  }

  // Attempt snapshot extraction first (modern path).
  let snapshot: ChallongeTournamentSnapshot | undefined;
  try {
    snapshot = extractChallongeTournament(html, {
      url: MODULE_URL(slug),
    });
  } catch {
    snapshot = undefined;
  }

  // Always parse the bracket SVG for layout coordinates.
  const bracketMatches = await parseBracketSvg(html);

  if (snapshot) {
    return {
      slug,
      tournamentName: snapshot.tournament.name,
      tournamentType: snapshot.tournament.tournament_type,
      groups: [],
      rawMatches: [],
      bracketMatches,
      snapshot,
    };
  }

  // Legacy fallback: HTMLRewriter-based group-standings + SVG parser.
  return parseLegacyHtml(slug, html, bracketMatches);
}

// ---------------------------------------------------------------------------
// parseModuleToScrapedTournament
// ---------------------------------------------------------------------------

/**
 * Convert a `HtmlRewriterModuleData` to the canonical `ScrapedTournament`
 * shape.
 *
 * When `data.snapshot` is present (modern path), the full match graph from
 * `TournamentStore` is used — giving real Challonge participant ids, signed
 * round numbers, per-game scores, and derived bracket sides.
 *
 * When `data.snapshot` is absent (legacy path), synthetic participant ids and
 * group-stage matches from the standings table are used (original behaviour).
 */
export function parseModuleToScrapedTournament(data: HtmlRewriterModuleData): ScrapedTournament {
  if (data.snapshot) {
    return snapshotToScrapedTournament(data.slug, data.snapshot, data.bracketMatches);
  }
  return legacyToScrapedTournament(data);
}

// ---------------------------------------------------------------------------
// fetchAndParseAsScrapedTournament
// ---------------------------------------------------------------------------

/**
 * One-shot helper: fetch + parse + project to `ScrapedTournament`.
 * Equivalent to `parseModuleToScrapedTournament(await fetchAndParseModule(slug))`.
 */
export async function fetchAndParseAsScrapedTournament(
  slug: string,
  options: FetchAndParseOptions = {},
): Promise<ScrapedTournament> {
  const data = await fetchAndParseModule(slug, options);
  return parseModuleToScrapedTournament(data);
}

// ---------------------------------------------------------------------------
// fetchPublicTournamentJson
// ---------------------------------------------------------------------------

/**
 * Attempt to retrieve the public JSON endpoint `/{slug}.json`.
 *
 * Returns `null` when the route is not public for this tournament (Challonge
 * returns HTML or a non-200 status for private tournaments).
 */
export async function fetchPublicTournamentJson(
  slug: string,
  options: { signal?: AbortSignal; userAgent?: string } = {},
): Promise<unknown | null> {
  const url = `https://challonge.com/${encodeURIComponent(slug)}.json`;
  const res = await fetch(url, {
    signal: options.signal,
    headers: {
      "user-agent": options.userAgent ?? DEFAULT_UA,
      accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Snapshot path — maps ChallongeTournamentSnapshot → ScrapedTournament
// ---------------------------------------------------------------------------

/**
 * Local façade preserved for `parseModuleToScrapedTournament`. Delegates to the
 * unified, bxc-free mapper (`../mappers/snapshot`) in htmlrewriter mode (no
 * `extras`), additively stamping SVG `x`/`y` coords from `bracketMatches` when
 * present. On the `/module` path `bracketMatches` is always empty, so the
 * coord-stamping branch is inert and the output stays golden-identical.
 *
 * The `ChallongeTournamentSnapshot` is structurally assignable to the mapper's
 * local `ChallongeSnapshotLike`, so no bxc type crosses into the pure module.
 */
function snapshotToScrapedTournament(
  slug: string,
  snap: ChallongeTournamentSnapshot,
  bracketMatches: BracketMatch[],
): ScrapedTournament {
  return mapSnapshot(snap as unknown as ChallongeSnapshotLike, {
    slug,
    url: `https://challonge.com/${slug}`,
    withSvgCoords: true,
    bracketMatches,
  });
}

// ---------------------------------------------------------------------------
// Legacy path — maps HtmlRewriterModuleData (groups/rawMatches) → ScrapedTournament
// ---------------------------------------------------------------------------

function legacyToScrapedTournament(data: HtmlRewriterModuleData): ScrapedTournament {
  const participantIdByName = new Map<string, number>();
  const allParticipants: ScrapedParticipant[] = [];
  let nextId = 1;
  let totalParticipants = 0;

  for (const g of data.groups) {
    for (const p of g.participants) {
      totalParticipants++;
      if (participantIdByName.has(p.displayName)) continue;
      const id = nextId++;
      participantIdByName.set(p.displayName, id);
      allParticipants.push({
        id,
        name: p.displayName,
        seed: p.rank ?? 0,
        challongeUsername: p.challongeUsername,
        challongeProfileUrl: p.challongeUsername
          ? `https://challonge.com/users/${p.challongeUsername}`
          : null,
        challongeUserId: null,
        emailHash: null,
        portraitUrl: p.portraitUrl ?? null,
        finalRank: p.rank,
        clinched: p.advanced,
        metadata: null,
      });
    }
  }

  const matches: ScrapedMatch[] = data.rawMatches.map((m) => {
    const winnerId = m.winnerName ? (participantIdByName.get(m.winnerName) ?? null) : null;
    const loserId = m.loserName ? (participantIdByName.get(m.loserName) ?? null) : null;
    const sets: Array<[number, number]> = winnerId && loserId ? [[1, 0]] : [];
    return {
      id: parseInt(m.matchId, 10) || 0,
      identifier: "",
      round: 1,
      bracketSide: "RR",
      player1Id: winnerId,
      player2Id: loserId,
      winnerId,
      loserId,
      scores: winnerId && loserId ? "1-0" : "",
      sets,
      state: m.state || "complete",
      forfeited: null,
      optional: null,
      startedAt: null,
      underwayAt: null,
      completedAt: null,
      createdAt: null,
      updatedAt: null,
      attachmentCount: null,
      hasAttachment: null,
      suggestedPlayOrder: null,
      groupId: null,
    };
  });

  // Bracket SVG matches (final-stage / single-elim / double-elim).
  const bracketEnabled = data.bracketMatches.length > 0;
  if (bracketEnabled) {
    const xPositions = [...new Set(data.bracketMatches.map((b) => Math.round(b.x)))].sort(
      (a, b) => a - b,
    );
    const xToRound = new Map<number, number>();
    xPositions.forEach((x, i) => xToRound.set(x, i + 1));

    const bracketParticipantIds = new Set<number>();
    for (const bm of data.bracketMatches) {
      for (const p of [bm.player1, bm.player2]) {
        if (!p?.participantId || !p.name) continue;
        if (bracketParticipantIds.has(p.participantId)) continue;
        bracketParticipantIds.add(p.participantId);
        if (allParticipants.find((a) => a.id === p.participantId)) continue;
        allParticipants.push({
          id: p.participantId,
          name: p.name,
          seed: p.seed ?? 0,
          challongeUsername: null,
          challongeProfileUrl: null,
          challongeUserId: null,
          emailHash: null,
          portraitUrl: null,
          finalRank: null,
          clinched: false,
          metadata: null,
        });
      }
    }

    const isDoubleElim = (data.tournamentType ?? "").toLowerCase().includes("double");
    const yMid =
      data.bracketMatches.reduce((sum, b) => sum + b.y, 0) /
        Math.max(1, data.bracketMatches.length) || 0;

    for (const bm of data.bracketMatches) {
      const round = xToRound.get(Math.round(bm.x)) ?? 1;
      const isLB = isDoubleElim && bm.y > yMid;
      const winnerSide =
        bm.player1?.winner && bm.player1.participantId
          ? bm.player1.participantId
          : bm.player2?.winner && bm.player2.participantId
            ? bm.player2.participantId
            : null;
      const loserSide =
        winnerSide && bm.player1?.participantId === winnerSide
          ? (bm.player2?.participantId ?? null)
          : winnerSide
            ? (bm.player1?.participantId ?? null)
            : null;

      const s1 = bm.player1?.score ?? null;
      const s2 = bm.player2?.score ?? null;
      const sets: Array<[number, number]> = s1 !== null && s2 !== null ? [[s1, s2]] : [];

      matches.push({
        id: bm.matchId,
        identifier: bm.identifier,
        round: isLB ? -round : round,
        bracketSide: isLB ? "LB" : isDoubleElim && round === xPositions.length ? "GF" : "WB",
        player1Id: bm.player1?.participantId ?? null,
        player2Id: bm.player2?.participantId ?? null,
        winnerId: winnerSide,
        loserId: loserSide,
        scores: s1 !== null && s2 !== null ? `${s1}-${s2}` : "",
        sets,
        state: bm.state || "pending",
        forfeited: null,
        optional: null,
        startedAt: null,
        underwayAt: null,
        completedAt: null,
        createdAt: null,
        updatedAt: null,
        attachmentCount: null,
        hasAttachment: null,
        suggestedPlayOrder: null,
        groupId: null,
      });
    }
  }

  const metadata: ScrapedTournamentMetadata = {
    id: 0,
    name: data.tournamentName ?? data.slug,
    url: `https://challonge.com/${data.slug}`,
    state: "underway",
    type: data.tournamentType ?? "round robin",
    participantsCount: totalParticipants,
    startedAt: null,
    completedAt: null,
    game: null,
    subdomain: null,
  };

  return {
    metadata,
    participants: allParticipants,
    matches,
    standings: [],
    stations: [],
    log: [],
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Legacy HTML parser (HTMLRewriter group-standings fallback)
// ---------------------------------------------------------------------------

async function parseLegacyHtml(
  slug: string,
  html: string,
  bracketMatches: BracketMatch[],
): Promise<HtmlRewriterModuleData> {
  const groups: GroupData[] = [];
  let currentGroup: GroupData | null = null;
  let inGroupStandingsPane = false;
  let inStandingsTable = false;
  let inTbody = false;
  let currentRow: GroupParticipant | null = null;
  let cellIndex = -1;
  let currentCellText: string[] = [];
  let inMatchHistoryCell = false;
  let tournamentName: string | null = null;
  let tournamentType: string | null = null;

  const parseTransformLocal = (val: string | null): { x: number; y: number } => {
    const m = val?.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
    return {
      x: m ? parseFloat(m[1] ?? "0") : 0,
      y: m ? parseFloat(m[2] ?? "0") : 0,
    };
  };
  // parseTransformLocal used below to satisfy strict unused-var checker.
  void parseTransformLocal;

  const flushCell = (): void => {
    if (!currentRow) return;
    const text = currentCellText.join(" ").replace(/\s+/g, " ").trim();
    switch (cellIndex) {
      case 0:
        currentRow.rank = parseInt(text, 10) || null;
        break;
      case 1: {
        const advanced = /\bAdvanced\b/i.test(text);
        const cleaned = text
          .replace(/\bAdvanced\b/i, "")
          .replace(/\s+/g, " ")
          .trim();
        const m = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (m) {
          currentRow.displayName = (m[1] ?? "").trim();
          currentRow.challongeUsername = (m[2] ?? "").trim();
        } else {
          currentRow.displayName = cleaned;
        }
        currentRow.advanced = advanced;
        break;
      }
      case 2: {
        const m = text.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
        if (m) {
          currentRow.wins = parseInt(m[1] ?? "0", 10);
          currentRow.losses = parseInt(m[2] ?? "0", 10);
          currentRow.ties = parseInt(m[3] ?? "0", 10);
        }
        break;
      }
      case 3:
        currentRow.tb = parseInt(text, 10) || 0;
        break;
      case 4:
        currentRow.setWins = parseInt(text, 10) || 0;
        break;
      case 5:
        currentRow.setTies = parseInt(text, 10) || 0;
        break;
      case 6:
        currentRow.pts = parseInt(text, 10) || 0;
        break;
    }
    currentCellText = [];
  };

  const rewriter = new HTMLRewriter()
    .on('meta[property="og:title"]', {
      element(el) {
        const content = el.getAttribute("content") ?? "";
        if (!content) return;
        tournamentName = content.replace(/\s*[-—–]\s*Challonge\s*$/i, "").trim() || null;
      },
    })
    .on("[data-tournament-type]", {
      element(el) {
        if (tournamentType) return;
        tournamentType = el.getAttribute("data-tournament-type");
      },
    })
    .on("li.group-name", {
      text(t) {
        const name = t.text.trim();
        if (!name) return;
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { name, participants: [] };
      },
    })
    .on("div.group-standings-pane", {
      element(el) {
        inGroupStandingsPane = true;
        el.onEndTag(() => {
          inGroupStandingsPane = false;
        });
      },
    })
    .on("table.standings", {
      element(el) {
        if (!inGroupStandingsPane) return;
        inStandingsTable = true;
        el.onEndTag(() => {
          inStandingsTable = false;
        });
      },
    })
    .on("tbody", {
      element(el) {
        if (!inStandingsTable) return;
        inTbody = true;
        el.onEndTag(() => {
          inTbody = false;
        });
      },
    })
    .on("tr", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentGroup) return;
        currentRow = {
          rank: null,
          displayName: "",
          challongeUsername: null,
          portraitUrl: null,
          advanced: false,
          wins: 0,
          losses: 0,
          ties: 0,
          tb: 0,
          setWins: 0,
          setTies: 0,
          pts: 0,
          matchHistory: [],
        };
        cellIndex = -1;
        el.onEndTag(() => {
          if (currentGroup && currentRow) {
            currentGroup.participants.push(currentRow);
          }
          currentRow = null;
          cellIndex = -1;
        });
      },
    })
    .on("td", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        cellIndex += 1;
        currentCellText = [];
        const cls = el.getAttribute("class") ?? "";
        inMatchHistoryCell = cls.includes("match-history");
        el.onEndTag(() => {
          flushCell();
          inMatchHistoryCell = false;
        });
      },
      text(t) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (inMatchHistoryCell) return;
        if (t.text.trim()) currentCellText.push(t.text);
      },
    })
    .on("img.portrait", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (cellIndex !== 1) return;
        currentRow.portraitUrl = el.getAttribute("src") ?? null;
      },
    })
    .on("a.match-report", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (!inMatchHistoryCell) return;
        const matchId = el.getAttribute("data-match-id") ?? "";
        if (!matchId) return;
        currentRow.matchHistory.push({
          matchId,
          matchState: el.getAttribute("data-match-state") ?? "",
          result: "?",
        });
      },
    })
    .on("a.match-report div.trend-box", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (!inMatchHistoryCell) return;
        const cls = el.getAttribute("class") ?? "";
        const last = currentRow.matchHistory[currentRow.matchHistory.length - 1];
        if (!last) return;
        if (cls.includes("-win")) last.result = "W";
        else if (cls.includes("-loss")) last.result = "L";
      },
    });

  await rewriter.transform(new Response(html)).text();
  if (currentGroup) groups.push(currentGroup);

  const matchById = new Map<
    string,
    {
      groupName: string;
      winnerName?: string;
      loserName?: string;
      state: string;
    }
  >();
  for (const g of groups) {
    for (const p of g.participants) {
      for (const m of p.matchHistory) {
        const cur = matchById.get(m.matchId) ?? {
          groupName: g.name,
          state: m.matchState,
        };
        if (m.result === "W") cur.winnerName = p.displayName;
        if (m.result === "L") cur.loserName = p.displayName;
        matchById.set(m.matchId, cur);
      }
    }
  }

  return {
    slug,
    tournamentName,
    tournamentType,
    groups,
    rawMatches: [...matchById.entries()].map(([matchId, m]) => ({
      matchId,
      ...m,
    })),
    bracketMatches,
  };
}
