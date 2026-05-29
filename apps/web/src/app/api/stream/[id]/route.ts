/**
 * RPB Stream API — TSH-compatible tournament data endpoint
 *
 * Public endpoint that returns tournament state in TournamentStreamHelper format.
 * Designed to be polled by TSH or OBS browser sources.
 *
 * GET /api/stream/:id                → Full TSH program_state
 * GET /api/stream/:id?format=players → Players list only
 * GET /api/stream/:id?format=match   → Current/next match only
 * GET /api/stream/:id?match=3        → Specific match by round
 *
 * Supports: DB tournaments (by id), scraped exports (bts2, bts3),
 *           and WB tournaments (wb_ub3..wb_ub13)
 */

import { type NextRequest, NextResponse } from "next/server";
import { loadJsonSafe } from "@/lib/data-cache";
import { getTournamentForStream } from "@/server/dal/stream";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// RPB colors
const COLOR_RED = "#dc2626";
const COLOR_GOLD = "#fbbf24";

// Name cleanup: strip emojis, deck notation, penalties
function cleanName(raw: string): string {
  let name = (raw.split("/")[0] ?? raw).trim();
  name = name.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F/gu, "").trim();
  name = name.replace(/^\(-?\d+\)\s*/, "").trim();
  return name.replace(/^[_\s]+|[_\s]+$/g, "");
}

// Detect team prefix from display name
function detectPrefix(name: string): { prefix: string | null; tag: string } {
  const teams: Record<string, string[]> = {
    SAtR: ["SAtR |", "SAtR|", "SAtR_", "SAtR", "SATR |", "SATR"],
    RNSX: ["RNSX |", "RNSX|", "RNSX_", "RNSX"],
    "Team Arc": ["Team Arc |", "Team_Arc |", "Team Arc_", "Team_Arc "],
    WB: ["Staff WB ", "WB |", "WB|", "WB_", "WB "],
    BP: ["BP |", "BP|"],
    RG: ["RG |", "RG|"],
  };

  for (const [teamName, patterns] of Object.entries(teams)) {
    for (const pattern of patterns) {
      if (name.startsWith(pattern)) {
        const tag = name.slice(pattern.length).replace(/^[|_\s]+/, "");
        return { prefix: teamName, tag: cleanName(tag) };
      }
    }
  }
  return { prefix: null, tag: cleanName(name) };
}

// Detect tournament type from slug/name
function detectType(idOrName: string): "bts" | "wb" | "standard" {
  const upper = idOrName.toUpperCase();
  if (upper.includes("B_TS") || upper.includes("BTS") || upper.includes("TAMASHII")) return "bts";
  if (upper.includes("UB") || upper.includes("ULTIME") || upper.includes("WILD")) return "wb";
  return "standard";
}

// Build TSH player object
function toTSHPlayer(name: string, seed?: number | null, avatar?: string | null) {
  const { prefix, tag } = detectPrefix(name);
  return {
    name: tag,
    prefix: prefix ?? "",
    gamerTag: tag,
    country_code: "FR",
    seed: seed ?? 0,
    avatar: avatar ?? null,
  };
}

// Build TSH match object from DB match
function toTSHMatch(
  match: {
    round: number;
    state: string;
    score: string | null;
    player1Name: string | null;
    player2Name: string | null;
    winnerName: string | null;
    challongeMatchId: string | null;
  },
  tournamentType: "bts" | "wb" | "standard",
) {
  const scoreParts = (match.score ?? "0-0").split("-").map(Number);
  const p1 = toTSHPlayer(match.player1Name ?? "");
  const p2 = toTSHPlayer(match.player2Name ?? "");

  // Determine round name
  let roundName = `Tour ${Math.abs(match.round)}`;
  if (match.round < 0) roundName += " Loser";
  else roundName += " Winner";

  return {
    id: match.challongeMatchId ?? "",
    round: match.round,
    round_name: roundName,
    state: match.state,
    entrants: [[p1], [p2]] as const,
    team1score: scoreParts[0] ?? 0,
    team2score: scoreParts[1] ?? 0,
    team1losers: match.round < 0,
    team2losers: match.round < 0,
    p1_name: p1.name,
    p2_name: p2.name,
    winner_name: match.winnerName ? cleanName(match.winnerName) : null,
    tournament_phase: tournamentType === "bts" ? "Bey-Tamashii Séries" : "Ultime Bataille",
  };
}

// Build full TSH program_state
function buildProgramState(
  tournament: {
    name: string;
    format?: string | null;
    challongeUrl?: string | null;
    location?: string | null;
  },
  participants: Array<{
    name: string;
    rank?: number;
    seed?: number | null;
    wins?: number;
    losses?: number;
    avatarUrl?: string | null;
  }>,
  currentMatch: ReturnType<typeof toTSHMatch> | null,
  tournamentType: "bts" | "wb" | "standard",
) {
  const isBTS = tournamentType === "bts";
  const bestOf = isBTS ? 7 : 5;
  const firstTo = isBTS ? 4 : 3;
  const charsPerPlayer = isBTS ? 3 : 1;

  const emptyPlayer = {
    name: "",
    prefix: "",
    gamerTag: "",
    country_code: "FR",
    seed: 0,
    avatar: null,
  };
  const p1 = currentMatch?.entrants[0]?.[0] ?? emptyPlayer;
  const p2 = currentMatch?.entrants[1]?.[0] ?? emptyPlayer;

  const characters: Record<string, null> = {};
  for (let i = 1; i <= charsPerPlayer; i++) characters[String(i)] = null;

  return {
    score: {
      "1": {
        team: {
          "1": {
            player: {
              "1": {
                name: p1.gamerTag,
                prefix: p1.prefix,
                country_code: p1.country_code,
                seed: p1.seed,
                character: { ...characters },
              },
            },
            color: COLOR_RED,
            teamName: "",
            losers: currentMatch?.team1losers ?? false,
            score: currentMatch?.team1score ?? 0,
          },
          "2": {
            player: {
              "1": {
                name: p2.gamerTag,
                prefix: p2.prefix,
                country_code: p2.country_code,
                seed: p2.seed,
                character: { ...characters },
              },
            },
            color: COLOR_GOLD,
            teamName: "",
            losers: currentMatch?.team2losers ?? false,
            score: currentMatch?.team2score ?? 0,
          },
        },
        best_of: bestOf,
        best_of_text: `Best of ${bestOf}`,
        best_of_short_text: `BO${bestOf}`,
        first_to: firstTo,
        first_to_text: `First to ${firstTo}`,
        first_to_short_text: `FT${firstTo}`,
        phase: isBTS ? "Bey-Tamashii Séries" : "Ultime Bataille",
        match: currentMatch?.round_name ?? "",
        set_id: currentMatch?.id ?? "",
      },
    },
    game: {
      name: "Beyblade X",
      defaults: {
        players_per_team: 1,
        characters_per_player: charsPerPlayer,
      },
    },
    tournament: {
      name: tournament.name,
      format: tournament.format ?? (isBTS ? "3on3 Double Élimination" : "1v1 Double Élimination"),
      organizer: isBTS ? "RPB - République Populaire du Beyblade" : "Wild Breakers",
      website: isBTS ? "https://rpbey.fr" : "https://linktr.ee/wildbreakers",
      challonge: tournament.challongeUrl ?? null,
      location: tournament.location ?? null,
    },
    standings: participants.map((p, i) => ({
      rank: p.rank ?? i + 1,
      name: cleanName(p.name),
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
    })),
  };
}

// ─── Scraped tournament handler (BTS2, BTS3, WB UB*) ─────────────────────────

type ScrapedStateInput = Parameters<typeof buildScrapedState>[0];

interface WbHistoryExport {
  metadata?: { url?: string };
  participants?: Array<{ name: string; finalRank: number; seed: number }>;
  matches?: ScrapedStateInput["matches"];
}

async function handleScrapedTournament(id: string) {
  // Check BTS exports (FS/CDN via loadJsonSafe — plus de process.cwd()).
  const btsMap: Record<string, string> = {
    bts2: "B_TS2.json",
    bts3: "B_TS3.json",
  };
  const btsFile = btsMap[id];
  if (btsFile) {
    const data = await loadJsonSafe<ScrapedStateInput>(`data/exports/${btsFile}`);
    if (!data) return null;
    return buildScrapedState(data, "bts", id.toUpperCase());
  }

  // Check WB exports
  const wbMatch = id.match(/^wb_?(ub\d+)$/i);
  if (wbMatch?.[1]) {
    const slug = `wb_${wbMatch[1].toLowerCase()}`;
    const data = await loadJsonSafe<WbHistoryExport>(`data/wb_history/${slug}.json`);
    if (!data) return null;
    return buildScrapedState(
      {
        url: data.metadata?.url,
        participants: (data.participants ?? []).map((p) => ({
          name: p.name,
          rank: p.finalRank,
          seed: p.seed,
        })),
        matches: data.matches ?? [],
      },
      "wb",
      slug.toUpperCase(),
    );
  }

  return null;
}

function buildScrapedState(
  data: {
    url?: string;
    participants?: Array<{
      name: string;
      rank?: number;
      seed?: number;
      exactWins?: number;
      exactLosses?: number;
    }>;
    matches?: Array<{
      round?: number;
      scores?: string;
      state?: string;
      winnerId?: number;
    }>;
  },
  type: "bts" | "wb",
  slug: string,
) {
  const participants = (data.participants ?? [])
    .filter((p) => (p.rank ?? 0) > 0)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const matches = data.matches ?? [];

  const state = buildProgramState(
    {
      name: type === "bts" ? `Bey-Tamashii Séries - ${slug}` : `Ultime Bataille - ${slug}`,
      format: type === "bts" ? "3on3 Double Elimination" : "1v1 Double Elimination",
      challongeUrl: data.url ?? null,
    },
    participants.map((p) => ({
      name: p.name,
      rank: p.rank,
      wins: p.exactWins ?? 0,
      losses: p.exactLosses ?? 0,
    })),
    null,
    type,
  );

  return {
    ...state,
    _meta: {
      source: "scraped",
      slug,
      type,
      participantsCount: participants.length,
      matchesCount: matches.length,
    },
  };
}

// ─── DB tournament handler ───────────────────────────────────────────────────

async function handleDBTournament(id: string, matchRound?: number | null) {
  const tournamentRaw = await getTournamentForStream(id);

  if (!tournamentRaw) return null;

  function remapUser<
    P extends { bladerName: string | null },
    T extends { name: string | null; profiles: P[] },
  >(u: T | null) {
    return u ? { ...u, profile: u.profiles[0] ?? null } : null;
  }

  const tournament = {
    ...tournamentRaw,
    participants: tournamentRaw.tournamentParticipants.map((p) => ({
      ...p,
      user: remapUser(p.user),
    })),
    matches: tournamentRaw.tournamentMatches.map((m) => ({
      ...m,
      player1: remapUser(m.user_player1Id),
      player2: remapUser(m.user_player2Id),
      winner: remapUser(m.user_winnerId),
    })),
  };

  const tournamentType = detectType(tournament.name);

  // Find current/specified match
  let currentMatch = null;
  if (matchRound !== undefined && matchRound !== null) {
    const match = tournament.matches.find((m) => m.round === matchRound);
    if (match) {
      currentMatch = toTSHMatch(
        {
          round: match.round,
          state: match.state,
          score: match.score,
          player1Name:
            match.player1?.profile?.bladerName ?? match.player1?.name ?? match.player1Name,
          player2Name:
            match.player2?.profile?.bladerName ?? match.player2?.name ?? match.player2Name,
          winnerName: match.winner?.profile?.bladerName ?? match.winner?.name ?? match.winnerName,
          challongeMatchId: match.challongeMatchId,
        },
        tournamentType,
      );
    }
  } else {
    // Find first underway match, or last completed
    const underway = tournament.matches.find((m) => m.state === "open" || m.state === "underway");
    const target = underway ?? tournament.matches.filter((m) => m.state === "complete").pop();
    if (target) {
      currentMatch = toTSHMatch(
        {
          round: target.round,
          state: target.state,
          score: target.score,
          player1Name:
            target.player1?.profile?.bladerName ?? target.player1?.name ?? target.player1Name,
          player2Name:
            target.player2?.profile?.bladerName ?? target.player2?.name ?? target.player2Name,
          winnerName:
            target.winner?.profile?.bladerName ?? target.winner?.name ?? target.winnerName,
          challongeMatchId: target.challongeMatchId,
        },
        tournamentType,
      );
    }
  }

  // Build participants list for standings
  const participantsList = tournament.participants.map((p, i) => ({
    name: p.user?.profile?.bladerName ?? p.playerName ?? p.user?.name ?? "Unknown",
    rank: p.finalPlacement ?? i + 1,
    seed: p.seed,
    wins: p.wins,
    losses: p.losses,
  }));

  const state = buildProgramState(
    {
      name: tournament.name,
      format: tournament.format,
      challongeUrl: tournament.challongeUrl,
      location: tournament.location,
    },
    participantsList,
    currentMatch,
    tournamentType,
  );

  // Add all matches for bracket display
  const allMatches = tournament.matches.map((m) =>
    toTSHMatch(
      {
        round: m.round,
        state: m.state,
        score: m.score,
        player1Name: m.player1?.profile?.bladerName ?? m.player1?.name ?? m.player1Name,
        player2Name: m.player2?.profile?.bladerName ?? m.player2?.name ?? m.player2Name,
        winnerName: m.winner?.profile?.bladerName ?? m.winner?.name ?? m.winnerName,
        challongeMatchId: m.challongeMatchId,
      },
      tournamentType,
    ),
  );

  return {
    ...state,
    matches: allMatches,
    _meta: {
      source: "database",
      id: tournament.id,
      status: tournament.status,
      type: tournamentType,
      participantsCount: tournament.participants.length,
      matchesCount: tournament.matches.length,
      updatedAt: tournament.updatedAt,
    },
  };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const matchRound = searchParams.get("match");

    // Try scraped data first (bts2, bts3, wb_ub*)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = await handleScrapedTournament(id.toLowerCase());

    // Then try DB
    if (!result) {
      result = await handleDBTournament(id, matchRound ? parseInt(matchRound, 10) : null);
    }

    if (!result) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Format filter
    if (format === "players") {
      return NextResponse.json({
        data: result.standings,
        _meta: result._meta,
      });
    }

    if (format === "match") {
      return NextResponse.json({
        data: result.score["1"],
        _meta: result._meta,
      });
    }

    // Add CORS headers for TSH access
    const response = NextResponse.json({ data: result });
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Cache-Control", "public, max-age=5");
    return response;
  } catch (error) {
    console.error("Stream API error:", error);
    return NextResponse.json({ error: "Failed to fetch stream data" }, { status: 500 });
  }
}
