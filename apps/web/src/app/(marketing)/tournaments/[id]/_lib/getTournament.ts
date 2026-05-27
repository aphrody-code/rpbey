import { redirect } from "next/navigation";
import { loadJsonSafe } from "@/lib/data-cache";
import { db, schema, eq, ilike, or } from "@/lib/db";

const tournamentColumns = {
	id: true,
	name: true,
	status: true,
	description: true,
	date: true,
	location: true,
	format: true,
	maxPlayers: true,
	challongeId: true,
	challongeUrl: true,
	posterUrl: true,
	standings: true,
	stations: true,
	activityLog: true,
	updatedAt: true,
} as const;

const tournamentWith = {
	tournamentCategory: {
		columns: { id: true, name: true, color: true, logoUrl: true },
	},
} as const;

function remapTournament<
	T extends {
		tournamentCategory: {
			id: string;
			name: string;
			color: string | null;
			logoUrl: string | null;
		} | null;
	},
>(t: T | null | undefined) {
	if (!t) return null;
	const { tournamentCategory, ...rest } = t;
	return { ...rest, category: tournamentCategory ?? null };
}

const BTS_META: Record<
	string,
	{ file: string; name: string; desc: string; date: string }
> = {
	bts1: {
		file: "B_TS1.json",
		name: "Bey-Tamashii Séries #1",
		desc: "Première édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
		date: "2026-01-11",
	},
	bts2: {
		file: "B_TS2.json",
		name: "Bey-Tamashii Séries #2",
		desc: "Deuxième édition des Bey-Tamashii Séries.",
		date: "2026-02-08",
	},
	bts3: {
		file: "B_TS3.json",
		name: "Bey-Tamashii Séries #3",
		desc: "Troisième édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
		date: "2026-03-01",
	},
	bts4: {
		file: "B_TS4.json",
		name: "Bey-Tamashii Séries #4",
		desc: "Quatrième édition des Bey-Tamashii Séries au Dernier Bar avant la Fin du Monde.",
		date: "2026-04-12",
	},
	bts5: {
		file: "B_TS5.json",
		name: "Bey-Tamashii Séries #5",
		desc: "Cinquième édition des Bey-Tamashii Séries, première de la saison 2.",
		date: "2026-05-10",
	},
};

export type ResolvedTournament = NonNullable<
	Awaited<ReturnType<typeof getTournamentById>>
>;

export async function getTournamentById(id: string) {
	const meta = BTS_META[id];
	if (meta) {
		const data = await loadJsonSafe<any>(`data/exports/${meta.file}`);
		if (data) {
			const isMaxData = !!data.metadata;
			const participants = isMaxData
				? data.participants
				: data.participants || [];
			const standings = participants
				.map((p: any) => ({
					rank: p.finalRank || p.rank || 0,
					name: p.name,
				}))
				.filter((p: any) => p.rank > 0)
				.sort((a: any, b: any) => a.rank - b.rank);

			const updatedAt = isMaxData
				? data.metadata.completedAt || data.metadata.startedAt
				: data.scrapedAt || meta.date;

			return {
				id,
				name: meta.name,
				status: "COMPLETE" as const,
				description: meta.desc,
				date: new Date(meta.date),
				location: "Dernier Bar avant la Fin du Monde, Paris",
				format: isMaxData ? data.metadata.type : "3on3 Double Elimination",
				maxPlayers: isMaxData ? data.metadata.participantsCount : 128,
				challongeId: isMaxData ? String(data.metadata.id) : id,
				challongeUrl: (isMaxData ? data.metadata.url : data.url) ?? null,
				posterUrl: null as string | null,
				standings,
				stations: [] as unknown[],
				activityLog: [] as unknown[],
				updatedAt: new Date(updatedAt),
				category: null as null | {
					id: string;
					name: string;
					color: string | null;
					logoUrl: string | null;
				},
			};
		}
	}

	const dbTournament =
		remapTournament(
			await db.query.tournaments.findFirst({
				where: eq(schema.tournaments.id, id),
				columns: tournamentColumns,
				with: tournamentWith,
			}),
		) ??
		remapTournament(
			await db.query.tournaments.findFirst({
				where: or(
					eq(schema.tournaments.challongeId, id),
					ilike(schema.tournaments.challongeUrl, `%${id}%`),
				),
				columns: tournamentColumns,
				with: tournamentWith,
			}),
		);

	// Si le record DB est un BTS dont on a déjà l'export JSON (slug bts<N>),
	// rediriger vers le slug canonique (évite doublon CUID + bracket vide).
	if (dbTournament) {
		const dbName = dbTournament.name.toLowerCase();
		for (const [slug, meta] of Object.entries(BTS_META)) {
			if (meta.name.toLowerCase() === dbName && slug !== id) {
				redirect(`/tournaments/${slug}`);
			}
		}
	}

	return dbTournament;
}
