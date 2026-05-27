"use server";

import { revalidatePath } from "next/cache";
import { normalizeSets } from "@/lib/challonge-vendor/scores";
import {
	db,
	schema,
	and,
	eq,
	gt,
	ilike,
	isNotNull,
	asc,
	inArray,
} from "@/lib/db";
import { syncStardustRankingsToDb } from "@/lib/stardust-sync-bts";

const STARDUST_CATEGORY = "STARDUST";

export interface StardustTournamentMeta {
	slug: string;
	tournamentId: string;
	label: string;
	date: string;
	participantsCount: number;
	matchesCount: number;
	format: string;
}

interface PlayerStats {
	displayName: string;
	wins: number;
	losses: number;
	setWins: number;
	setLosses: number;
	points: number;
	tournaments: Set<string>;
	tournamentWins: number;
	top3: number;
	top5: number;
}

interface BladerHistoryEntry {
	tournamentSlug: string;
	tournamentLabel: string;
	finalRank: number | null;
	wins: number;
	losses: number;
	date: string;
}

function normalizeName(raw: string): string {
	const [before] = raw.split("/");
	return (before ?? raw).trim();
}

function keyOf(raw: string): string {
	return normalizeName(raw).toLowerCase();
}

function parseScoreToSets(
	score: string | null | undefined,
): Array<[number, number]> {
	if (!score || score === "0-0") return [];
	const segments = score.includes(",") ? score.split(",") : [score];
	const raw = segments.map((seg) => {
		const parts = seg.split("-").map((n) => Number(n.trim()));
		return parts.length === 2 ? (parts as [number, number]) : null;
	});
	return normalizeSets(raw.filter((s): s is [number, number] => s !== null));
}

type LoadedStardustTournament = {
	id: string;
	name: string;
	date: Date;
	format: string;
	participants: (typeof schema.tournamentParticipants.$inferSelect)[];
	matches: (typeof schema.tournamentMatches.$inferSelect)[];
};

async function loadStardustTournaments(): Promise<LoadedStardustTournament[]> {
	const cats = await db
		.select({ id: schema.tournamentCategories.id })
		.from(schema.tournamentCategories)
		.where(ilike(schema.tournamentCategories.name, `%${STARDUST_CATEGORY}%`));
	const catIds = cats.map((c) => c.id);
	if (catIds.length === 0) return [];

	const rows = await db.query.tournaments.findMany({
		where: and(
			inArray(schema.tournaments.categoryId, catIds),
			inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED", "UNDERWAY"]),
		),
		orderBy: asc(schema.tournaments.date),
		with: {
			tournamentParticipants: true,
			tournamentMatches: true,
			tournamentCategory: true,
		},
	});

	return rows.map((t) => ({
		id: t.id,
		name: t.name,
		date: new Date(t.date),
		format: t.format,
		participants: t.tournamentParticipants,
		matches: t.tournamentMatches,
	}));
}

function buildRankings(tournaments: LoadedStardustTournament[]) {
	const playerStats = new Map<string, PlayerStats>();
	const canonicalNames = new Map<string, string>();
	const bladerHistory = new Map<string, BladerHistoryEntry[]>();
	const nbTournois = tournaments.length;

	const init = (name: string): PlayerStats => ({
		displayName: name,
		wins: 0,
		losses: 0,
		setWins: 0,
		setLosses: 0,
		points: 0,
		tournaments: new Set(),
		tournamentWins: 0,
		top3: 0,
		top5: 0,
	});

	const register = (raw: string): string => {
		const display = normalizeName(raw);
		const key = display.toLowerCase();
		if (!canonicalNames.has(key)) canonicalNames.set(key, display);
		if (!playerStats.has(key))
			playerStats.set(key, init(canonicalNames.get(key)!));
		return key;
	};

	for (let tIdx = 0; tIdx < tournaments.length; tIdx++) {
		const t = tournaments[tIdx]!;
		const recency = nbTournois > 1 ? 0.6 + (0.4 * tIdx) / (nbTournois - 1) : 1;
		const slug = t.id;
		const label = t.name;
		const dateIso = t.date.toISOString();

		const perTournamentMatches = new Map<string, { w: number; l: number }>();

		for (const m of t.matches) {
			if (m.state !== "complete" || !m.winnerName) continue;
			const loserName =
				m.player1Name && m.player1Name !== m.winnerName
					? m.player1Name
					: m.player2Name && m.player2Name !== m.winnerName
						? m.player2Name
						: null;
			if (!loserName) continue;

			const wKey = register(m.winnerName);
			const lKey = register(loserName);
			const w = playerStats.get(wKey)!;
			const l = playerStats.get(lKey)!;

			const sets = parseScoreToSets(m.score);
			if (sets.length > 0) {
				let wSets = 0;
				let lSets = 0;
				for (const [a, b] of sets) {
					if (a > b) wSets++;
					else if (b > a) lSets++;
				}
				w.setWins += wSets;
				w.setLosses += lSets;
				l.setWins += lSets;
				l.setLosses += wSets;
				w.points += Math.round(wSets * recency * 100) / 100;
				l.points += Math.round(lSets * recency * 100) / 100;
			} else {
				w.points += Math.round(4 * recency * 100) / 100;
			}
			w.wins++;
			l.losses++;

			for (const [key, isWinner] of [
				[wKey, true],
				[lKey, false],
			] as const) {
				const acc = perTournamentMatches.get(key) ?? { w: 0, l: 0 };
				if (isWinner) acc.w++;
				else acc.l++;
				perTournamentMatches.set(key, acc);
			}
		}

		for (const p of t.participants) {
			if (!p.playerName) continue;
			const key = register(p.playerName);
			const stats = playerStats.get(key)!;
			stats.tournaments.add(slug);
			if (p.finalPlacement === 1) {
				stats.tournamentWins++;
				stats.top3++;
				stats.top5++;
			} else if (p.finalPlacement && p.finalPlacement <= 3) {
				stats.top3++;
				stats.top5++;
			} else if (p.finalPlacement && p.finalPlacement <= 5) {
				stats.top5++;
			}

			const hist = bladerHistory.get(key) ?? [];
			const tm = perTournamentMatches.get(key) ?? { w: 0, l: 0 };
			hist.push({
				tournamentSlug: slug,
				tournamentLabel: label,
				finalRank: p.finalPlacement ?? null,
				wins: tm.w,
				losses: tm.l,
				date: dateIso,
			});
			bladerHistory.set(key, hist);
		}
	}

	type RankingOut = {
		rank: number;
		playerName: string;
		score: number;
		wins: number;
		losses: number;
		participation: number;
		winRate: string;
		pointsAverage: string;
	};

	const ranked: Array<RankingOut & { _tw: number; _t3: number; _t5: number }> =
		[];
	for (const stats of playerStats.values()) {
		const total = stats.wins + stats.losses;
		if (total === 0) continue;
		const winRate = stats.wins / total;
		const pointsAvg = stats.points / total;
		const winscore = winRate + pointsAvg / 100;
		const participationRate =
			nbTournois > 0 ? stats.tournaments.size / nbTournois : 1;
		const punish = participationRate ** 0.6;
		const placementBonus =
			1 +
			stats.tournamentWins * 0.15 +
			(stats.top3 - stats.tournamentWins) * 0.05 +
			(stats.top5 - stats.top3) * 0.02;
		const score = Math.round(punish * winscore * placementBonus * 100000);

		ranked.push({
			rank: 0,
			playerName: stats.displayName,
			score,
			wins: stats.wins,
			losses: stats.losses,
			participation: stats.tournaments.size,
			winRate: `${(winRate * 100).toFixed(1)}%`,
			pointsAverage: pointsAvg.toFixed(2),
			_tw: stats.tournamentWins,
			_t3: stats.top3,
			_t5: stats.top5,
		});
	}

	ranked.sort(
		(a, b) =>
			b.score - a.score ||
			parseFloat(b.pointsAverage) - parseFloat(a.pointsAverage) ||
			b.participation - a.participation,
	);
	ranked.forEach((r, i) => {
		r.rank = i + 1;
	});

	return { ranked, playerStats, bladerHistory };
}

export async function syncStardustRanking() {
	// Formule BTS canonique (participation + finalRank bucket + matchWin) —
	// logique unique factorisée dans `@/lib/stardust-sync-bts`.
	const result = await syncStardustRankingsToDb(db);
	if (result.success) {
		revalidatePath("/tournaments/stardust");
		revalidatePath("/rankings");
		return {
			success: true as const,
			count: result.count,
			tournamentCount: result.tournamentCount,
		};
	}
	console.error("Stardust sync error:", result.error);
	return { success: false as const, error: result.error };
}

export async function getStardustSeasonStats() {
	try {
		const tournaments = await loadStardustTournaments();
		const uniqueNames = new Set<string>();
		const metas: StardustTournamentMeta[] = [];
		for (const t of tournaments) {
			metas.push({
				slug: t.id,
				tournamentId: t.id,
				label: t.name,
				date: t.date.toISOString(),
				participantsCount: t.participants.length,
				matchesCount: t.matches.length,
				format: t.format || "double elimination",
			});
			for (const p of t.participants) {
				if (p.playerName) uniqueNames.add(keyOf(p.playerName));
			}
		}
		return {
			success: true as const,
			data: {
				tournamentCount: tournaments.length,
				uniqueParticipants: uniqueNames.size,
				metas,
			},
		};
	} catch (error) {
		return { success: false as const, error: String(error) };
	}
}

export async function getStardustBladerByName(name: string) {
	try {
		const blader = await db.query.stardustBladers.findFirst({
			where: ilike(schema.stardustBladers.name, name),
		});
		return { success: true as const, data: blader ?? null };
	} catch (error) {
		return { success: false as const, error: String(error) };
	}
}

/**
 * Top 10 d'un tournoi Stardust depuis la DB.
 * Accepte soit l'id, soit un slug/label — résout d'abord par id, puis
 * fallback sur recherche `name ILIKE` dans les tournois Stardust.
 */
export async function getStardustTournamentTop10(idOrSlug: string): Promise<{
	success: boolean;
	data?: Array<{ rank: number; name: string }>;
	error?: string;
}> {
	try {
		let tournament = await db.query.tournaments.findFirst({
			where: eq(schema.tournaments.id, idOrSlug),
			columns: { id: true },
		});
		if (!tournament) {
			const cats = await db
				.select({ id: schema.tournamentCategories.id })
				.from(schema.tournamentCategories)
				.where(
					ilike(schema.tournamentCategories.name, `%${STARDUST_CATEGORY}%`),
				);
			const catIds = cats.map((c) => c.id);
			tournament = catIds.length
				? ((await db.query.tournaments.findFirst({
						where: and(
							inArray(schema.tournaments.categoryId, catIds),
							ilike(schema.tournaments.name, `%${idOrSlug}%`),
						),
						columns: { id: true },
					})) ?? undefined)
				: undefined;
		}
		if (!tournament) return { success: true, data: [] };

		const participants = await db.query.tournamentParticipants.findMany({
			where: and(
				eq(schema.tournamentParticipants.tournamentId, tournament.id),
				isNotNull(schema.tournamentParticipants.finalPlacement),
				gt(schema.tournamentParticipants.finalPlacement, 0),
			),
			orderBy: asc(schema.tournamentParticipants.finalPlacement),
			limit: 10,
			columns: { playerName: true, finalPlacement: true },
		});

		const top10 = participants.map((p, i) => ({
			rank: p.finalPlacement ?? i + 1,
			name: p.playerName ?? "—",
		}));

		return { success: true, data: top10 };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

export async function linkStardustBladers() {
	try {
		const bladers = await db.query.stardustBladers.findMany();
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
					.update(schema.stardustBladers)
					.set({ linkedUserId: match.id })
					.where(eq(schema.stardustBladers.id, blader.id));
				linkedCount++;
			}
		}
		revalidatePath("/tournaments/stardust");
		return { success: true as const, linkedCount };
	} catch (error) {
		return { success: false as const, error: String(error) };
	}
}
