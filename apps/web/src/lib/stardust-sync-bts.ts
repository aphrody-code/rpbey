/**
 * Stardust ranking sync — pure (no Next.js deps), formule BTS canonique.
 *
 * Calcul aligné sur src/server/actions/bts.ts:
 *   points = participation
 *          + finalRank bucket  (rank 1 → firstPlace, 2 → secondPlace, 3 → thirdPlace, 4-8 → top8)
 *          + Σ matchWinWinner par victoire
 *          + Σ matchWinLoser  par défaite
 *
 * Source de vérité des barèmes : table `ranking_system` (RankingConfig).
 *
 * Trustworthy gate : on ne crédite les placements que si :
 *   - challongeState === 'complete' (ou status DB = COMPLETE/ARCHIVED)
 *   - rank distribution diverse (≥ 2 buckets distincts).
 * Sinon, on garde participation + W/L mais on droppe les bonus placement et
 * la comptabilité tournamentWins/top3/top5 (pour ne pas crédite 70 champions
 * fake si l'export Challonge est pré-tournament).
 *
 * Tri identique BTS : score desc, tournamentWins desc, wins desc.
 */

import { db, schema, and, eq, asc, ilike, inArray } from "@/lib/db";

type Db = typeof db;

interface StardustTournament {
	id: string;
	name: string;
	date: Date;
	status: string;
	challongeState: string | null;
	participants: Array<{
		playerName: string | null;
		finalPlacement: number | null;
		wins: number;
		losses: number;
	}>;
	matches: Array<{
		state: string;
		round: number;
		player1Name: string | null;
		player2Name: string | null;
		winnerName: string | null;
		score: string | null;
	}>;
}

/**
 * Barème de points par victoire selon la phase du match (canon stardust) :
 *
 *   - Win en Winner Bracket (`round > 0`)       → 1 000 pts
 *   - Win en Loser  Bracket (`round < 0`)       →   500 pts
 *   - Win en phase de Poule (`round === -100`)  →   250 pts (moitié du LB,
 *                                                  car la poule sert à qualifier)
 *
 * Les défaites **ne rapportent aucun point** (qu'importe le bracket).
 *
 * Le sentinel `-100` est posé par `scripts/scrape-pool-matches.ts` lors de
 * l'import des matches `/log` Challonge qui n'ont pas de champ `groupId`.
 */
const POOL_ROUND_SENTINEL = -100;
const POINTS_WB_WIN = 1000;
const POINTS_LB_WIN = 500;
const POINTS_POOL_WIN = 250;

function pointsForWin(round: number): number {
	if (round === POOL_ROUND_SENTINEL) return POINTS_POOL_WIN;
	if (round > 0) return POINTS_WB_WIN;
	return POINTS_LB_WIN;
}

interface RankingConfig {
	participation: number;
	firstPlace: number;
	secondPlace: number;
	thirdPlace: number;
	top8: number;
	matchWinWinner: number;
	matchWinLoser: number;
}

const POINTS_BY_FINISH: ReadonlyMap<number, keyof RankingConfig> = new Map([
	[1, "firstPlace"],
	[2, "secondPlace"],
	[3, "thirdPlace"],
	[4, "top8"],
	[5, "top8"],
	[6, "top8"],
	[7, "top8"],
	[8, "top8"],
]);

function normalizeName(raw: string): string {
	const [before] = raw.split("/");
	return (before ?? raw).trim();
}

function keyOf(raw: string): string {
	return normalizeName(raw).toLowerCase();
}

/**
 * Trustworthy = state === 'complete' (ou statut DB COMPLETE/ARCHIVED) AND
 * rank distribution shows ≥ 2 distinct placement buckets.
 */
function isTrustworthyForPlacements(t: StardustTournament): boolean {
	const okStatus =
		t.status === "COMPLETE" ||
		t.status === "ARCHIVED" ||
		t.challongeState === "complete";
	if (!okStatus) return false;
	const ranks = t.participants
		.map((p) => p.finalPlacement)
		.filter((r): r is number => r != null && r > 0);
	if (ranks.length === 0) return false;
	return new Set(ranks).size > 1;
}

interface PlayerAccum {
	displayName: string;
	wins: number;
	losses: number;
	points: number;
	tournaments: Set<string>;
	tournamentWins: number;
	top3: number;
	top5: number;
	bestFinish: number | null;
}

interface BuildResult {
	ranked: Array<{
		rank: number;
		playerName: string;
		score: number;
		wins: number;
		losses: number;
		participation: number;
		winRate: string;
		pointsAverage: string;
	}>;
	playerStats: Map<string, PlayerAccum>;
	bladerHistory: Map<
		string,
		Array<{
			tournamentSlug: string;
			tournamentLabel: string;
			finalRank: number | null;
			wins: number;
			losses: number;
			date: string;
		}>
	>;
}

export function buildStardustRankings(
	tournaments: StardustTournament[],
	config: RankingConfig,
): BuildResult {
	const players = new Map<string, PlayerAccum>();
	const canonical = new Map<string, string>();
	const bladerHistory = new Map<
		string,
		BuildResult["bladerHistory"] extends Map<string, infer V> ? V : never
	>();

	const init = (name: string): PlayerAccum => ({
		displayName: name,
		wins: 0,
		losses: 0,
		points: 0,
		tournaments: new Set(),
		tournamentWins: 0,
		top3: 0,
		top5: 0,
		bestFinish: null,
	});

	const register = (raw: string): string => {
		const display = normalizeName(raw);
		const k = display.toLowerCase();
		if (!canonical.has(k)) canonical.set(k, display);
		if (!players.has(k)) players.set(k, init(canonical.get(k)!));
		return k;
	};

	for (const t of tournaments) {
		const slug = t.id;
		const label = t.name;
		const dateIso = t.date.toISOString();
		const trustPlacements = isTrustworthyForPlacements(t);
		const perTM = new Map<string, { w: number; l: number }>();

		// Participation + finalRank bucket
		for (const p of t.participants) {
			if (!p.playerName) continue;
			const k = register(p.playerName);
			const acc = players.get(k)!;
			acc.tournaments.add(slug);
			acc.points += config.participation;

			const rank = trustPlacements ? p.finalPlacement : null;
			if (rank != null && rank > 0) {
				const bucket = POINTS_BY_FINISH.get(rank);
				if (bucket) acc.points += config[bucket];
				if (rank === 1) {
					acc.tournamentWins += 1;
					acc.top3 += 1;
					acc.top5 += 1;
				} else if (rank <= 3) {
					acc.top3 += 1;
					acc.top5 += 1;
				} else if (rank <= 5) {
					acc.top5 += 1;
				}
				if (acc.bestFinish === null || rank < acc.bestFinish) {
					acc.bestFinish = rank;
				}
			}
		}

		// W/L + match points — les défaites ne rapportent rien, les wins sont
		// pondérées par la phase (WB=1000, LB=500, Pool=250) via `pointsForWin`.
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
			const w = players.get(wKey)!;
			const l = players.get(lKey)!;

			w.wins += 1;
			w.points += pointsForWin(m.round);
			l.losses += 1;
			// loss = 0 pts (pas de loserPts ajouté)

			for (const [k, isWin] of [
				[wKey, true],
				[lKey, false],
			] as const) {
				const acc = perTM.get(k) ?? { w: 0, l: 0 };
				if (isWin) acc.w++;
				else acc.l++;
				perTM.set(k, acc);
			}
		}

		// Blader history per tournament
		for (const p of t.participants) {
			if (!p.playerName) continue;
			const k = register(p.playerName);
			const tm = perTM.get(k) ?? { w: 0, l: 0 };
			const hist = bladerHistory.get(k) ?? [];
			hist.push({
				tournamentSlug: slug,
				tournamentLabel: label,
				finalRank: p.finalPlacement ?? null,
				wins: tm.w,
				losses: tm.l,
				date: dateIso,
			});
			bladerHistory.set(k, hist);
		}
	}

	// Sort: points desc, tournamentWins desc, wins desc
	const sorted = [...players.entries()].sort(([, a], [, b]) => {
		if (b.points !== a.points) return b.points - a.points;
		if (b.tournamentWins !== a.tournamentWins)
			return b.tournamentWins - a.tournamentWins;
		return b.wins - a.wins;
	});

	const nbT = tournaments.length;
	const ranked = sorted.map(([, p], i) => {
		const total = p.wins + p.losses;
		const winRate = total > 0 ? `${((p.wins / total) * 100).toFixed(1)}%` : "—";
		const pointsAverage =
			p.tournaments.size > 0
				? (p.points / p.tournaments.size).toFixed(2)
				: "0.00";
		void nbT;
		return {
			rank: i + 1,
			playerName: p.displayName,
			score: p.points,
			wins: p.wins,
			losses: p.losses,
			participation: p.tournaments.size,
			winRate,
			pointsAverage,
		};
	});

	return { ranked, playerStats: players, bladerHistory };
}

/**
 * Sync stardust rankings to DB. Pure: no `revalidatePath` here — caller
 * handles cache invalidation.
 */
export async function syncStardustRankingsToDb(
	dbClient: Db,
): Promise<
	| { success: true; count: number; tournamentCount: number }
	| { success: false; error: string }
> {
	try {
		const stardustCategories = await dbClient
			.select({ id: schema.tournamentCategories.id })
			.from(schema.tournamentCategories)
			.where(ilike(schema.tournamentCategories.name, "%STARDUST%"));
		const categoryIds = stardustCategories.map((c) => c.id);

		const rows = categoryIds.length
			? await dbClient.query.tournaments.findMany({
					where: and(
						inArray(schema.tournaments.categoryId, categoryIds),
						inArray(schema.tournaments.status, [
							"COMPLETE",
							"ARCHIVED",
							"UNDERWAY",
						]),
					),
					orderBy: asc(schema.tournaments.date),
					with: {
						tournamentParticipants: true,
						tournamentMatches: true,
						tournamentCategory: true,
					},
				})
			: [];

		const tournaments: StardustTournament[] = rows.map((t) => ({
			id: t.id,
			name: t.name,
			date: new Date(t.date),
			status: t.status,
			challongeState: t.challongeState,
			participants: t.tournamentParticipants.map((p) => ({
				playerName: p.playerName,
				finalPlacement: p.finalPlacement,
				wins: p.wins,
				losses: p.losses,
			})),
			matches: t.tournamentMatches.map((m) => ({
				state: m.state,
				round: m.round,
				player1Name: m.player1Name,
				player2Name: m.player2Name,
				winnerName: m.winnerName,
				score: m.score,
			})),
		}));

		if (tournaments.length === 0) {
			return {
				success: false,
				error: "Aucun tournoi Stardust trouvé en base",
			};
		}

		const config = (await dbClient.query.rankingSystem.findFirst()) ?? {
			participation: 500,
			firstPlace: 15000,
			secondPlace: 7000,
			thirdPlace: 5000,
			top8: 500,
			matchWinWinner: 1000,
			matchWinLoser: 500,
		};

		const { ranked, playerStats, bladerHistory } = buildStardustRankings(
			tournaments,
			config,
		);

		await dbClient.transaction(async (tx) => {
			await tx.delete(schema.stardustRankings);
			if (ranked.length > 0) {
				await tx.insert(schema.stardustRankings).values(ranked);
			}
		});

		for (const [k, stats] of playerStats.entries()) {
			const hist = (bladerHistory.get(k) ?? []) as unknown as object[];
			await dbClient
				.insert(schema.stardustBladers)
				.values({
					name: stats.displayName,
					totalWins: stats.wins,
					totalLosses: stats.losses,
					tournamentWins: stats.tournamentWins,
					tournamentsCount: stats.tournaments.size,
					history: hist as never,
				})
				.onConflictDoUpdate({
					target: schema.stardustBladers.name,
					set: {
						totalWins: stats.wins,
						totalLosses: stats.losses,
						tournamentWins: stats.tournamentWins,
						tournamentsCount: stats.tournaments.size,
						history: hist as never,
					},
				});
		}

		return {
			success: true,
			count: ranked.length,
			tournamentCount: tournaments.length,
		};
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

export { keyOf, normalizeName, isTrustworthyForPlacements };
