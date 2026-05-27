"use server";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { db, schema, eq, ilike } from "@/lib/db";

// Season config: which BBT numbers belong to each season
// Saison 1 = BBT 1-11
// Saison 2 = BBT 12-22 (en cours)
const SEASON_CONFIG: Record<number, number[]> = {
	1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
	2: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
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

export interface TournamentMeta {
	slug: string;
	bbtNumber: number;
	participantsCount: number;
	matchesCount: number;
	format: string;
}

interface PlayerStats {
	wins: number;
	losses: number;
	points: number;
	participations: number;
	tournaments: string[];
}

/**
 * Load all tournament data for a given season from local JSON files.
 */
async function loadTournamentData(season: number) {
	const historyDir = join(process.cwd(), "data", "satr_history");
	const files = await readdir(historyDir);
	const bbtNumbers = SEASON_CONFIG[season] || [];

	const tournaments: TournamentData[] = [];
	const metas: TournamentMeta[] = [];

	for (const file of files.sort()) {
		const match = file.match(/satr_bbt(\d+)\.json/);
		if (!match?.[1]) continue;
		const bbtNum = parseInt(match[1], 10);
		if (!bbtNumbers.includes(bbtNum)) continue;

		const content = await readFile(join(historyDir, file), "utf-8");
		const data: TournamentData = JSON.parse(content);
		tournaments.push(data);
		metas.push({
			slug: `satr_bbt${bbtNum}`,
			bbtNumber: bbtNum,
			participantsCount: data.metadata.participantsCount,
			matchesCount: data.matches?.length || 0,
			format: data.metadata.type || "double elimination",
		});
	}

	return { tournaments, metas };
}

/**
 * Parse loser score from a score string.
 * Handles formats: "4-2", "0-5", "5-2,0-0" (multi-set: take first set)
 * Returns the loser's game wins (the minimum of the two scores).
 */
function getLoserScore(scores: string): number | null {
	if (!scores || scores === "0-0") return null;

	// Handle multi-set scores like "5-2,0-0" — take the first set
	const [firstSet] = scores.split(",");
	if (!firstSet) return null;

	const parts = firstSet.trim().split("-").map(Number);
	if (parts.length !== 2) return null;
	const a = parts[0];
	const b = parts[1];
	if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b))
		return null;
	if (a === 0 && b === 0) return null;
	return Math.min(a, b);
}

/**
 * Compute SATR ranking using the Ichigo algorithm.
 *
 * For each player:
 *   points = 4 × W + Σ(loser score per loss)
 *   point_avg = points / (W + L)
 *   winrate = W / (W + L)
 *   winscore = winrate + (point_avg / 100)
 *   punish = 1 / (1 + (floor(nb_tournois / 1.25) + 2) × (1 / (participations × point_avg)))
 *   score = floor(punish × winscore × 100000)
 */
function computeRanking(tournaments: TournamentData[]) {
	const playerStats = new Map<string, PlayerStats & { displayName: string }>();
	// Canonical name map: lowercase key -> display name (first occurrence wins)
	const canonicalNames = new Map<string, string>();

	for (const tournament of tournaments) {
		const idToName = new Map<number, string>();
		for (const p of tournament.participants) {
			const key = p.name.toLowerCase().trim();
			if (!canonicalNames.has(key)) canonicalNames.set(key, p.name.trim());
			idToName.set(p.id, canonicalNames.get(key)!);
		}

		for (const match of tournament.matches || []) {
			if (match.state !== "complete" || !match.winnerId || !match.loserId)
				continue;

			const winnerName = idToName.get(match.winnerId);
			const loserName = idToName.get(match.loserId);
			if (!winnerName || !loserName) continue;

			const wKey = winnerName.toLowerCase();
			const lKey = loserName.toLowerCase();

			if (!playerStats.has(wKey)) {
				playerStats.set(wKey, {
					wins: 0,
					losses: 0,
					points: 0,
					participations: 0,
					tournaments: [],
					displayName: winnerName,
				});
			}
			const winner = playerStats.get(wKey)!;
			winner.wins += 1;
			winner.points += 4;

			if (!playerStats.has(lKey)) {
				playerStats.set(lKey, {
					wins: 0,
					losses: 0,
					points: 0,
					participations: 0,
					tournaments: [],
					displayName: loserName,
				});
			}
			const loser = playerStats.get(lKey)!;
			loser.losses += 1;
			const loserScore = getLoserScore(match.scores);
			if (loserScore !== null) loser.points += loserScore;
		}

		const slug = tournament.metadata.url.split("/").pop() || "";
		for (const p of tournament.participants) {
			const key = p.name.toLowerCase().trim();
			const stats = playerStats.get(key);
			if (stats && !stats.tournaments.includes(slug)) {
				stats.tournaments.push(slug);
				stats.participations += 1;
			}
		}
	}

	const nbTournois = tournaments.length;
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

		let punish = 1;
		if (stats.participations > 0 && pointAvg > 0) {
			punish =
				1 /
				(1 +
					(Math.floor(nbTournois / 1.25) + 2) *
						(1 / (stats.participations * pointAvg)));
		} else {
			punish = 0;
		}

		const score = Math.round(punish * winscore * 100000);

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
 * Sync SATR ranking by computing it natively from local tournament JSON data.
 * Replaces the previous Google Sheet-based sync.
 */
// Google Sheets autoritatives — 1 par saison.
const SATR_SHEETS: Record<number, string> = {
	1: "2PACX-1vRa4-OPfgPL4-V0xpUAN2qAYADAg9729QTsgx0VCUTbJPl9vK0_HFrYXgo3_RdLZvWxmsC4Hr6OgrVE",
	2: "2PACX-1vTi8555gpQmuRtj1Sh14YWVyecDhPgRC58ZeKsJJhJHRvzwJi2aa_g5D4y1vaowKNKSexA293lQ7Ge-",
};

function splitCsvLine(line: string): string[] {
	const out: string[] = [];
	let cur = "";
	let inQ = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') {
			inQ = !inQ;
			continue;
		}
		if (c === "," && !inQ) {
			out.push(cur);
			cur = "";
			continue;
		}
		cur += c;
	}
	out.push(cur);
	return out;
}

async function fetchSatrRankingFromSheet(season: number): Promise<Array<{
	rank: number;
	playerName: string;
	score: number;
	wins: number;
	losses: number;
	participation: number;
	winRate: string;
	pointsAverage: string;
}> | null> {
	const sheetId = SATR_SHEETS[season];
	if (!sheetId) return null;
	const url = `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?gid=0&single=true&output=csv`;
	try {
		const res = await fetch(url, { redirect: "follow" });
		if (!res.ok) return null;
		const csv = await res.text();
		const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
		const header = splitCsvLine(lines[0] ?? "");
		if (
			!header[0]?.includes("#") ||
			!header[1]?.toUpperCase().includes("PLAYER") ||
			!header[2]?.toUpperCase().includes("SCORE")
		) {
			return null;
		}
		const rows = [];
		for (let i = 1; i < lines.length; i++) {
			const c = splitCsvLine(lines[i]!);
			if (c.length < 7) continue;
			const rank = parseInt(c[0]!, 10);
			const playerName = c[1]!.trim();
			const score = parseInt(c[2]!.replace(/[^\d-]/g, ""), 10);
			const wins = parseInt(c[3]!.replace(/[^\d-]/g, ""), 10);
			const participation = parseInt(c[4]!.replace(/[^\d-]/g, ""), 10);
			const winRate = c[5]!.replace(/"/g, "").trim();
			const pointsAverage = c[6]!.replace(/"/g, "").trim();
			if (!playerName || Number.isNaN(rank) || Number.isNaN(score)) continue;
			rows.push({
				rank,
				playerName,
				score,
				wins,
				losses: 0,
				participation,
				winRate,
				pointsAverage,
			});
		}
		return rows.length > 0 ? rows : null;
	} catch {
		return null;
	}
}

/**
 * Sync SATR par saison.
 * Priorité : Google Sheet ; fallback : calcul local Ichigo.
 * N'écrase jamais les autres saisons (filtre WHERE season).
 */
export async function syncSatrRanking(season = 2) {
	try {
		let rankings = await fetchSatrRankingFromSheet(season);
		let source = "sheet";

		if (!rankings) {
			const { tournaments } = await loadTournamentData(season);
			if (tournaments.length === 0) {
				return { success: false, error: "No tournament data found" };
			}
			rankings = computeRanking(tournaments);
			source = "compute";
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(schema.satrRankings)
				.where(eq(schema.satrRankings.season, season));
			if (rankings.length > 0) {
				await tx
					.insert(schema.satrRankings)
					.values(rankings.map((r) => ({ ...r, season })));
			}
		});

		revalidatePath("/tournaments/satr");
		return { success: true, count: rankings.length, source };
	} catch (error) {
		console.error("Sync Error:", error);
		return { success: false, error: String(error) };
	}
}

/**
 * Get season stats: tournament count, unique participants, tournament metadata.
 */
export async function getSatrSeasonStats(season = 2) {
	try {
		const { tournaments, metas } = await loadTournamentData(season);
		const uniqueNames = new Set<string>();
		for (const t of tournaments) {
			for (const p of t.participants) {
				uniqueNames.add(p.name.toLowerCase().trim());
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
 */
export async function getPlayerTournamentMatches(
	tournamentSlug: string,
	playerName: string,
) {
	try {
		const path = join(
			process.cwd(),
			"data",
			"satr_history",
			`${tournamentSlug.toLowerCase()}.json`,
		);
		const content = await readFile(path, "utf-8");
		const data: TournamentData = JSON.parse(content);

		const idToName = new Map<number, string>();
		for (const p of data.participants) {
			idToName.set(p.id, p.name);
		}

		const playerId = data.participants.find(
			(p) => p.name.toLowerCase() === playerName.toLowerCase(),
		)?.id;

		if (!playerId) return { success: true, data: [] };

		const matches = (data.matches || [])
			.filter(
				(m) =>
					m.state === "complete" &&
					(m.player1Id === playerId || m.player2Id === playerId),
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
				// Winners bracket first (positive rounds), then losers bracket (negative)
				const aAbs = Math.abs(a.round);
				const bAbs = Math.abs(b.round);
				if (a.round > 0 && b.round > 0) return a.round - b.round;
				if (a.round < 0 && b.round < 0) return bAbs - aAbs;
				return a.round > 0 ? -1 : 1;
			});

		return { success: true, data: matches };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

export async function linkSatrBladers() {
	try {
		const bladers = await db.query.satrBladers.findMany();
		const users = await db.query.users.findMany({
			columns: { id: true, name: true, discordTag: true },
		});

		let linkedCount = 0;
		for (const blader of bladers) {
			const match = users.find(
				(u) =>
					(u.name && u.name.toLowerCase() === blader.name.toLowerCase()) ||
					(u.discordTag &&
						u.discordTag.toLowerCase() === blader.name.toLowerCase()),
			);

			if (match && blader.linkedUserId !== match.id) {
				await db
					.update(schema.satrBladers)
					.set({ linkedUserId: match.id })
					.where(eq(schema.satrBladers.id, blader.id));
				linkedCount++;
			}
		}

		revalidatePath("/tournaments/satr");
		return { success: true, linkedCount };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

export async function getTournamentTop10(slug: string) {
	try {
		const path = join(
			process.cwd(),
			"data",
			"satr_history",
			`${slug.toLowerCase()}.json`,
		);
		const content = await readFile(path, "utf-8");
		const data = JSON.parse(content);

		const top10 = (data.participants as TournamentParticipant[])
			.filter((p) => p.finalRank && p.finalRank <= 10)
			.sort((a, b) => a.finalRank - b.finalRank)
			.slice(0, 10)
			.map((p) => ({
				rank: p.finalRank,
				name: p.name,
			}));

		return { success: true, data: top10 };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

/**
 * Get tournament metadata (participants count, format) for a given slug.
 */
export async function getTournamentMeta(slug: string) {
	try {
		const path = join(
			process.cwd(),
			"data",
			"satr_history",
			`${slug.toLowerCase()}.json`,
		);
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

export async function getSatrBladerByName(name: string) {
	try {
		const blader = await db.query.satrBladers.findFirst({
			where: ilike(schema.satrBladers.name, name),
		});
		return { success: true, data: blader ?? null };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}
