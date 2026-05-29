"use server";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import {
  getBladerByName,
  linkBlader,
  listBladers,
  listUsersForLinking,
  replaceWbSeason,
} from "@/server/dal/rankings";

// Season config: which UB numbers and HS keys belong to each season
// Saison 1  = UB1 → UB11 (pas de HS)
// Saison 2  = UB12 → UB14 + Hors-Séries Défi Patoo + HS Phase 2
const SEASON_CONFIG: Record<number, { ub: number[]; hs: string[] }> = {
  1: {
    ub: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    hs: [],
  },
  2: {
    ub: [12, 13, 14],
    hs: ["patoo", "phase2"],
  },
};
const CURRENT_SEASON = 2;

// Display labels for hors-série tournaments
const HS_LABELS: Record<string, string> = {
  patoo: "HS: Défi Patoo",
  phase2: "HS: Phase 2",
};

// Manual name overrides for known aliases/staff accounts
const NAME_OVERRIDES: Record<string, string> = {
  "staff wb azure": "Azure",
  "wb fulguris": "Fulguris",
};

interface TournamentMatch {
  id: number;
  identifier: number;
  round: number;
  player1Id: number;
  player2Id: number;
  winnerId: number;
  loserId: number;
  scores: string;
  state: string;
}

interface TournamentParticipant {
  id: number;
  name: string;
  seed: number;
  finalRank: number;
}

interface TournamentData {
  metadata: {
    id: number;
    name: string;
    url: string;
    state: string;
    type: string;
    participantsCount: number;
  };
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
}

export interface WbTournamentMeta {
  slug: string;
  ubNumber: number;
  label: string;
  participantsCount: number;
  matchesCount: number;
  format: string;
  isHorsSerie?: boolean;
}

interface PlayerStats {
  wins: number;
  losses: number;
  points: number;
  participations: number;
  tournaments: string[];
  displayName: string;
  tournamentWins: number;
  top3: number;
  top5: number;
}

/**
 * Normalize a player name:
 * - Split on "/" and take the first part (removes deck info)
 * - Trim whitespace
 * - Apply manual overrides for staff/alias accounts
 * - Preserve original casing for display
 */
function normalizeName(rawName: string): string {
  const [beforeSlash] = rawName.split("/");
  let name = (beforeSlash ?? rawName).trim();
  const overrideKey = name.toLowerCase();
  const override = NAME_OVERRIDES[overrideKey];
  if (override) name = override;
  return name;
}

/**
 * Parse match scores from a score string.
 * Handles formats: "4-2", "0-5", "5-2,0-0" (multi-set: take first set)
 * Returns { winnerScore, loserScore } or null if unparseable.
 */
function parseMatchScores(scores: string): { winnerScore: number; loserScore: number } | null {
  if (!scores || scores === "0-0") return null;

  const [firstSet] = scores.split(",");
  if (!firstSet) return null;

  const parts = firstSet.trim().split("-").map(Number);
  if (parts.length !== 2) return null;
  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return null;
  if (a === 0 && b === 0) return null;
  return { winnerScore: Math.max(a, b), loserScore: Math.min(a, b) };
}

/**
 * Load all tournament data for a given season from local JSON files.
 */
async function loadTournamentData(season: number) {
  const historyDir = join(process.cwd(), "data", "wb_history");
  let files: string[];
  try {
    files = await readdir(historyDir);
  } catch {
    return { tournaments: [], metas: [] };
  }
  const seasonConfig = SEASON_CONFIG[season];
  const ubNumbers = seasonConfig?.ub || [];
  const hsKeys = seasonConfig?.hs || [];

  const tournaments: TournamentData[] = [];
  const metas: WbTournamentMeta[] = [];

  for (const file of files.sort()) {
    // Match UB tournaments: wb_ub1.json, wb_ub2.json, etc.
    const ubMatch = file.match(/wb_ub(\d+)\.json/);
    if (ubMatch?.[1]) {
      const ubNum = parseInt(ubMatch[1], 10);
      if (ubNumbers.length > 0 && !ubNumbers.includes(ubNum)) continue;

      const content = await readFile(join(historyDir, file), "utf-8");
      const data: TournamentData = JSON.parse(content);
      tournaments.push(data);
      metas.push({
        slug: `wb_ub${ubNum}`,
        ubNumber: ubNum,
        label: `UB ${ubNum}`,
        participantsCount: data.metadata.participantsCount,
        matchesCount: data.matches?.length || 0,
        format: data.metadata.type || "double elimination",
      });
      continue;
    }

    // Match HS tournaments: wb_hs_patoo.json, wb_hs_jgf.json, etc.
    const hsMatch = file.match(/wb_hs_(\w+)\.json/);
    if (hsMatch?.[1]) {
      const hsKey = hsMatch[1];
      if (hsKeys.length > 0 && !hsKeys.includes(hsKey)) continue;

      const content = await readFile(join(historyDir, file), "utf-8");
      const data: TournamentData = JSON.parse(content);
      tournaments.push(data);
      metas.push({
        slug: `wb_hs_${hsKey}`,
        ubNumber: 0,
        label: HS_LABELS[hsKey] || `HS: ${hsKey}`,
        participantsCount: data.metadata.participantsCount,
        matchesCount: data.matches?.length || 0,
        format: data.metadata.type || "single elimination",
        isHorsSerie: true,
      });
    }
  }

  return { tournaments, metas };
}

/**
 * Build a normalized name lookup for a tournament.
 * Maps participant Challonge IDs to their normalized, deduplicated names.
 * Uses case-insensitive merging: the first occurrence's casing wins.
 */
function buildNameMap(
  participants: TournamentParticipant[],
  canonicalNames: Map<string, string>,
): Map<number, string> {
  const idToName = new Map<number, string>();
  for (const p of participants) {
    const normalized = normalizeName(p.name);
    const key = normalized.toLowerCase();

    // Register canonical display name (first occurrence wins)
    if (!canonicalNames.has(key)) {
      canonicalNames.set(key, normalized);
    }

    idToName.set(p.id, canonicalNames.get(key)!);
  }
  return idToName;
}

/**
 * Compute WB ranking using the Ichigo v2 algorithm.
 *
 * Improvements over v1:
 * 1. Winner points scale with actual score (not flat 4)
 * 2. Punish uses only participation rate (decoupled from pointAvg)
 * 3. Punishment coefficient is stable across tournament counts
 * 4. Recency weighting: recent tournaments count more (0.6→1.0 linear)
 */
function computeRanking(tournaments: TournamentData[]) {
  const playerStats = new Map<string, PlayerStats>();
  const canonicalNames = new Map<string, string>();
  const nbTournois = tournaments.length;

  const initStats = (name: string): PlayerStats => ({
    wins: 0,
    losses: 0,
    points: 0,
    participations: 0,
    tournaments: [],
    displayName: name,
    tournamentWins: 0,
    top3: 0,
    top5: 0,
  });

  for (let tIdx = 0; tIdx < tournaments.length; tIdx++) {
    const tournament = tournaments[tIdx]!;
    const idToName = buildNameMap(tournament.participants, canonicalNames);

    // Recency weight: oldest = 0.6, newest = 1.0 (linear)
    const recency = nbTournois > 1 ? 0.6 + (0.4 * tIdx) / (nbTournois - 1) : 1;

    for (const match of tournament.matches || []) {
      if (match.state !== "complete" || !match.winnerId || !match.loserId) continue;

      const winnerName = idToName.get(match.winnerId);
      const loserName = idToName.get(match.loserId);
      if (!winnerName || !loserName) continue;

      const wKey = winnerName.toLowerCase();
      const lKey = loserName.toLowerCase();

      if (!playerStats.has(wKey)) playerStats.set(wKey, initStats(winnerName));
      if (!playerStats.has(lKey)) playerStats.set(lKey, initStats(loserName));

      const winner = playerStats.get(wKey)!;
      const loser = playerStats.get(lKey)!;

      const parsed = parseMatchScores(match.scores);
      if (parsed) {
        winner.points += Math.round(parsed.winnerScore * recency * 100) / 100;
        loser.points += Math.round(parsed.loserScore * recency * 100) / 100;
      } else {
        winner.points += Math.round(4 * recency * 100) / 100;
      }

      winner.wins += 1;
      loser.losses += 1;
    }

    // Track participation + tournament placements
    const slug = tournament.metadata.url.split("/").pop() || "";
    for (const p of tournament.participants) {
      const normalized = normalizeName(p.name);
      const key = normalized.toLowerCase();
      if (!playerStats.has(key)) playerStats.set(key, initStats(normalized));
      const stats = playerStats.get(key)!;
      if (!stats.tournaments.includes(slug)) {
        stats.tournaments.push(slug);
        stats.participations += 1;
      }
      // Placement bonuses (weighted by recency)
      if (p.finalRank === 1) {
        stats.tournamentWins += 1;
        stats.top3 += 1;
        stats.top5 += 1;
      } else if (p.finalRank && p.finalRank <= 3) {
        stats.top3 += 1;
        stats.top5 += 1;
      } else if (p.finalRank && p.finalRank <= 5) {
        stats.top5 += 1;
      }
    }
  }

  const rankings: Array<{
    rank: number;
    playerName: string;
    score: number;
    wins: number;
    losses: number;
    participation: number;
    winRate: string;
    pointsAverage: string;
  }> = [];

  for (const [, stats] of playerStats) {
    const totalMatches = stats.wins + stats.losses;
    if (totalMatches === 0) continue;

    const pointAvg = stats.points / totalMatches;
    const winrate = stats.wins / totalMatches;
    const winscore = winrate + pointAvg / 100;

    // Participation factor: gentle power curve
    const participationRate = stats.participations / nbTournois;
    const punish = participationRate ** 0.6;

    // Placement bonus: rewards tournament victories and podiums
    // 1st = +15%, top3 = +5%, top5 = +2% (per occurrence)
    const placementBonus =
      1 +
      stats.tournamentWins * 0.15 +
      (stats.top3 - stats.tournamentWins) * 0.05 +
      (stats.top5 - stats.top3) * 0.02;

    const score = Math.round(punish * winscore * placementBonus * 100000);

    rankings.push({
      rank: 0,
      playerName: stats.displayName,
      score,
      wins: stats.wins,
      losses: stats.losses,
      participation: stats.participations,
      winRate: `${(winrate * 100).toFixed(1)}%`,
      pointsAverage: pointAvg.toFixed(2),
    });
  }

  rankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const avgDiff = parseFloat(b.pointsAverage) - parseFloat(a.pointsAverage);
    if (avgDiff !== 0) return avgDiff;
    return b.participation - a.participation;
  });

  for (let i = 0; i < rankings.length; i++) {
    const entry = rankings[i];
    if (entry) entry.rank = i + 1;
  }

  return rankings;
}

/**
 * Sync WB ranking by computing it from local tournament JSON data.
 */
export async function syncWbRanking(season: number = CURRENT_SEASON) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const { tournaments } = await loadTournamentData(season);
    if (tournaments.length === 0) {
      return { success: false, error: "No tournament data found" };
    }

    const rankings = computeRanking(tournaments);

    // Ne toucher qu'à la saison demandée — préserve les autres saisons en DB.
    await replaceWbSeason(
      season,
      rankings.map((r) => ({ ...r, season })),
    );

    revalidatePath("/tournaments/wb");
    return { success: true, count: rankings.length };
  } catch (error) {
    console.error("WB Sync Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get season stats: tournament count, unique participants, tournament metadata.
 * Uses normalized names for accurate unique participant count.
 */
export async function getWbSeasonStats(season: number = CURRENT_SEASON) {
  try {
    const { tournaments, metas } = await loadTournamentData(season);
    const uniqueNames = new Set<string>();
    for (const t of tournaments) {
      for (const p of t.participants) {
        uniqueNames.add(normalizeName(p.name).toLowerCase());
      }
    }

    return {
      success: true,
      data: {
        tournamentCount: tournaments.length,
        uniqueParticipants: uniqueNames.size,
        metas,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get match details for a specific player in a specific tournament.
 * Uses normalized name matching to find the player across name variants.
 */
export async function getWbPlayerTournamentMatches(tournamentSlug: string, playerName: string) {
  try {
    const path = join(process.cwd(), "data", "wb_history", `${tournamentSlug.toLowerCase()}.json`);
    const content = await readFile(path, "utf-8");
    const data: TournamentData = JSON.parse(content);

    const canonicalNames = new Map<string, string>();
    const idToName = buildNameMap(data.participants, canonicalNames);

    // Find player by normalized name match
    const searchKey = normalizeName(playerName).toLowerCase();
    const playerId = data.participants.find((p) => {
      const normalized = normalizeName(p.name).toLowerCase();
      return normalized === searchKey;
    })?.id;

    if (!playerId) return { success: true, data: [] };

    const matches = (data.matches || [])
      .filter(
        (m) => m.state === "complete" && (m.player1Id === playerId || m.player2Id === playerId),
      )
      .map((m) => {
        const opponentId = m.player1Id === playerId ? m.player2Id : m.player1Id;
        return {
          opponent: idToName.get(opponentId) || "Unknown",
          scores: m.scores,
          won: m.winnerId === playerId,
          round: m.round,
        };
      })
      .sort((a, b) => {
        if (a.round > 0 && b.round > 0) return a.round - b.round;
        if (a.round < 0 && b.round < 0) return Math.abs(b.round) - Math.abs(a.round);
        return a.round > 0 ? -1 : 1;
      });

    return { success: true, data: matches };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function linkWbBladers() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const bladers = await listBladers("wb");
    const users = await listUsersForLinking();

    let linkedCount = 0;
    for (const blader of bladers) {
      const match = users.find(
        (u) =>
          (u.name && u.name.toLowerCase() === blader.name.toLowerCase()) ||
          (u.discordTag && u.discordTag.toLowerCase() === blader.name.toLowerCase()),
      );

      if (match && blader.linkedUserId !== match.id) {
        await linkBlader("wb", blader.id, match.id);
        linkedCount++;
      }
    }

    revalidatePath("/tournaments/wb");
    return { success: true, linkedCount };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getWbTournamentTop10(slug: string) {
  try {
    const path = join(process.cwd(), "data", "wb_history", `${slug.toLowerCase()}.json`);
    const content = await readFile(path, "utf-8");
    const data = JSON.parse(content);

    const top10 = (data.participants as TournamentParticipant[])
      .filter((p) => p.finalRank && p.finalRank <= 10)
      .sort((a, b) => a.finalRank - b.finalRank)
      .slice(0, 10)
      .map((p) => ({
        rank: p.finalRank,
        name: normalizeName(p.name),
      }));

    return { success: true, data: top10 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getWbTournamentMeta(slug: string) {
  try {
    const path = join(process.cwd(), "data", "wb_history", `${slug.toLowerCase()}.json`);
    const content = await readFile(path, "utf-8");
    const data: TournamentData = JSON.parse(content);

    return {
      success: true,
      data: {
        participantsCount: data.metadata.participantsCount,
        matchesCount: data.matches?.length || 0,
        format: data.metadata.type || "double elimination",
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getWbBladerByName(name: string) {
  try {
    const blader = await getBladerByName("wb", name);
    return { success: true, data: blader ?? null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
