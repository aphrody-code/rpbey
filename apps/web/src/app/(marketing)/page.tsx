import {
	type MetaPartPreview,
	type RankingBoard,
} from "@/components/marketing";
import { type TournamentShowcaseItem } from "@/components/marketing/TournamentShowcase";
import { loadJsonSafe } from "@/lib/data-cache";
import {
	db,
	schema,
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
} from "@/lib/db";
import { getBtsRanking } from "@/server/actions/bts";
import { getContent } from "@/server/actions/cms";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CATEGORY_ORDER = ["Blade", "Ratchet", "Bit"];
const TOP_PER_CATEGORY = 3;

const MANUAL_MAPPINGS: Record<string, string> = {
	blast: "pegasusblast",
	shark: "sharkedge",
	wizardrod: "wizardrod",
	heavy: "hheavy",
	wheel: "wwheel",
	bumper: "bbumper",
	charge: "ccharge",
	assault: "aassault",
	dual: "ddual",
	erase: "eerase",
	slash: "sslash",
	round: "rround",
	turn: "tturn",
	jaggy: "jjaggy",
	zillion: "zzillion",
	free: "ffree",
	level: "l",
	ball: "b",
	taper: "t",
	needle: "n",
	flat: "f",
	rush: "r",
	point: "p",
	orb: "o",
	spike: "s",
	jolt: "j",
	kick: "k",
	quattro: "q",
};

function normalizeName(name: string): string {
	const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
	return MANUAL_MAPPINGS[norm] || norm;
}

async function getTopMetaParts(): Promise<MetaPartPreview[]> {
	try {
		const data = await loadJsonSafe<{
			periods: {
				"4weeks": {
					categories: {
						category: string;
						components: {
							name: string;
							score: number;
							position_change: number | "NEW";
							imageUrl?: string;
						}[];
					}[];
				};
			};
		}>("data/bbx-weekly.json");

		const period = data?.periods["4weeks"];
		if (!period?.categories) return [];

		// Fetch part images from DB
		const dbParts = await db.query.parts.findMany({
			columns: { name: true, imageUrl: true },
		});
		const imageMap = new Map<string, string>();
		for (const p of dbParts) {
			if (p.imageUrl) {
				imageMap.set(normalizeName(p.name), p.imageUrl);
			}
		}

		const results: MetaPartPreview[] = [];

		for (const catName of CATEGORY_ORDER) {
			const category = period.categories.find((c) => c.category === catName);
			if (!category?.components) continue;

			const top = category.components.slice(0, TOP_PER_CATEGORY);
			for (const comp of top) {
				const normName = normalizeName(comp.name);
				results.push({
					name: comp.name,
					score: comp.score,
					category: catName,
					imageUrl: comp.imageUrl || imageMap.get(normName) || null,
					position_change: comp.position_change,
				});
			}
		}

		return results;
	} catch {
		return [];
	}
}

const RANKING_TOP = 12;

// Tous les classements RPB pour le carrousel de la homepage. Mêmes sources que
// les pages dédiées : BTS (getBtsRanking), WB/SATR/Stardust (tables synchronisées).
async function getRankingBoards(): Promise<RankingBoard[]> {
	const normalizeDbRow = (r: {
		id: string;
		playerName: string;
		score: number;
		wins: number;
		losses: number;
	}) => ({
		id: r.id,
		userId: null,
		playerName: r.playerName,
		points: r.score,
		wins: r.wins,
		losses: r.losses,
		tournamentWins: 0,
		avatarUrl: null,
	});

	const [bts, wb, satr, stardust] = await Promise.all([
		getBtsRanking(2, { pageSize: RANKING_TOP })
			.then((res) =>
				res.entries.slice(0, RANKING_TOP).map((e) => ({
					id: `bts-${e.rank}-${e.playerName}`,
					userId: null,
					playerName: e.playerName,
					points: e.points,
					wins: e.wins,
					losses: e.losses,
					tournamentWins: e.tournamentWins,
					avatarUrl: e.avatarUrl,
				})),
			)
			.catch(() => []),
		db.query.wbRankings
			.findMany({
				where: eq(schema.wbRankings.season, 2),
				orderBy: asc(schema.wbRankings.rank),
				limit: RANKING_TOP,
			})
			.then((rows) => rows.map(normalizeDbRow))
			.catch(() => []),
		db.query.satrRankings
			.findMany({
				where: eq(schema.satrRankings.season, 2),
				orderBy: asc(schema.satrRankings.rank),
				limit: RANKING_TOP,
			})
			.then((rows) => rows.map(normalizeDbRow))
			.catch(() => []),
		db.query.stardustRankings
			.findMany({
				orderBy: asc(schema.stardustRankings.rank),
				limit: RANKING_TOP,
			})
			.then((rows) => rows.map(normalizeDbRow))
			.catch(() => []),
	]);

	return [
		{
			key: "global",
			label: "Global",
			sublabel: "Classement officiel BTS · Saison 2",
			color: "var(--rpb-primary)",
			href: "/rankings",
			entries: bts,
		},
		{
			key: "wb",
			label: "Wild Breakers",
			sublabel: "Circuit Wild Breakers · Saison 2",
			color: "#a78bfa",
			href: "/tournaments/wb",
			entries: wb,
		},
		{
			key: "satr",
			label: "SATR",
			sublabel: "Circuit SATR · Saison 2",
			color: "var(--rpb-secondary)",
			href: "/tournaments/satr",
			entries: satr,
		},
		{
			key: "stardust",
			label: "Stardust",
			sublabel: "Circuit Stardust",
			color: "#60A5FA",
			href: "/tournaments/stardust",
			entries: stardust,
		},
	];
}

const BTS_EDITIONS = [
	{
		id: "bts3",
		file: "B_TS3.json",
		name: "Bey-Tamashii Séries #3",
		date: "2026-03-01",
		poster: "/tournaments/BTS3_poster.webp",
		fallbackCount: 73,
	},
	{
		id: "bts2",
		file: "B_TS2.json",
		name: "Bey-Tamashii Séries #2",
		date: "2026-02-08",
		poster: "/tournaments/BTS2.webp",
		fallbackCount: 60,
	},
	{
		id: "bts1",
		file: "B_TS1.json",
		name: "Bey-Tamashii Séries #1",
		date: "2026-01-11",
		poster: "/tournaments/BTS1_poster.webp",
		fallbackCount: 69,
	},
];

async function getBtsTournaments(): Promise<TournamentShowcaseItem[]> {
	type BtsExport = {
		participants?: {
			name: string;
			rank: number;
			exactWins?: number;
			exactLosses?: number;
		}[];
		participantsCount?: number;
		matchesCount?: number;
	};

	const loaded = await Promise.all(
		BTS_EDITIONS.map(async (edition) => ({
			edition,
			data: await loadJsonSafe<BtsExport>(`data/exports/${edition.file}`),
		})),
	);

	const cards: TournamentShowcaseItem[] = [];
	for (const { edition, data } of loaded) {
		if (!data) continue;
		const participants = data.participants || [];
		const podium = participants
			.filter((p) => p.rank <= 3)
			.sort((a, b) => a.rank - b.rank)
			.map((p) => ({
				name: p.name.replace(/✅|✔️/g, "").trim(),
				rank: p.rank,
				wins: p.exactWins || 0,
				losses: p.exactLosses || 0,
			}));
		cards.push({
			id: edition.id,
			name: edition.name,
			date: edition.date,
			poster: edition.poster,
			participants: data.participantsCount || edition.fallbackCount,
			matchesCount: data.matchesCount || 0,
			podium,
		});
	}
	return cards;
}

export default async function HomePage() {
	const [
		activeTournament,
		heroContent,
		rankingBoards,
		metaParts,
		recentVideos,
		btsTournaments,
		nextBts,
		nextStardust,
	] = await Promise.all([
		db.query.tournaments.findFirst({
			where: and(
				inArray(schema.tournaments.status, [
					"UNDERWAY",
					"CHECKIN",
					"REGISTRATION_OPEN",
				]),
				isNotNull(schema.tournaments.challongeUrl),
			),
			orderBy: desc(schema.tournaments.date),
			columns: {
				id: true,
				challongeUrl: true,
				name: true,
				standings: true,
				stations: true,
				activityLog: true,
			},
		}),
		getContent("home-hero-text"),
		// Tous les classements RPB (BTS + WB + SATR + Stardust) pour le carrousel.
		getRankingBoards(),
		getTopMetaParts(),
		db.query.youtubeVideos
			.findMany({
				where: and(
					eq(schema.youtubeVideos.isFeatured, true),
					eq(schema.youtubeVideos.channelId, "UCHiDwWI-2uQrsUiJhXt6rng"),
				),
				orderBy: desc(schema.youtubeVideos.publishedAt),
				limit: 12,
				columns: {
					id: true,
					title: true,
					channelName: true,
					channelAvatar: true,
					thumbnail: true,
					views: true,
					duration: true,
					publishedAt: true,
				},
			})
			.then((vids) =>
				vids.map((v) => ({
					...v,
					videoId: v.id,
					publishedAt: new Date(v.publishedAt).toISOString(),
				})),
			)
			.catch(() => []),
		getBtsTournaments(),
		db.query.tournaments.findFirst({
			where: and(
				ilike(schema.tournaments.name, "%BEY-TAMASHII%"),
				inArray(schema.tournaments.status, [
					"UPCOMING",
					"REGISTRATION_OPEN",
					"CHECKIN",
					"UNDERWAY",
				]),
			),
			orderBy: asc(schema.tournaments.date),
			columns: {
				id: true,
				name: true,
				date: true,
				location: true,
				challongeUrl: true,
			},
		}),
		(async () => {
			const rows = await db.query.tournaments.findMany({
				where: inArray(schema.tournaments.status, [
					"UPCOMING",
					"REGISTRATION_OPEN",
					"CHECKIN",
					"UNDERWAY",
				]),
				orderBy: asc(schema.tournaments.date),
				columns: { id: true, name: true, date: true, posterUrl: true },
				with: { tournamentCategory: { columns: { name: true } } },
			});
			return (
				rows.find((t) =>
					(t.tournamentCategory?.name ?? "").toUpperCase().includes("STARDUST"),
				) ?? null
			);
		})(),
	]);

	if (nextBts) {
		const edition = nextBts.name.match(/#(\d+)/)?.[1];
		btsTournaments.unshift({
			id: nextBts.id,
			name: nextBts.name,
			date: new Date(nextBts.date).toISOString(),
			poster: edition ? `/tournaments/BTS${edition}_poster.webp` : "/logo.webp",
			participants: 0,
			matchesCount: 0,
			podium: [],
		});
	}

	if (nextStardust) {
		btsTournaments.unshift({
			id: nextStardust.id,
			name: nextStardust.name,
			date: new Date(nextStardust.date).toISOString(),
			poster: nextStardust.posterUrl ?? "/stardust-logo.webp",
			participants: 0,
			matchesCount: 0,
			podium: [],
		});
	}

	return (
		<HomeClient
			activeTournament={activeTournament}
			heroContent={heroContent?.content}
			rankingBoards={rankingBoards}
			metaParts={metaParts}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			recentVideos={recentVideos as any}
			tournaments={btsTournaments}
		/>
	);
}
