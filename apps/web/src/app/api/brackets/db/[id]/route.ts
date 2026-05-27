/**
 * GET /api/brackets/db/[id]
 *
 * Renvoie un `ViewerData` (`@rose-griffon/challonge-core`) construit depuis nos
 * tables Postgres `tournament_matches` + `tournament_participants`.
 *
 * V1 : bracket finals double-elimination uniquement (les matches `round=-100`
 * de la phase de poule sont skip — ils seront servis par une V2).
 *
 * Exemples :
 *   GET /api/brackets/db/cmobvakra0001s7rog85nt10h         → T_SS1 par cuid
 *   GET /api/brackets/db/T_SS1                             → T_SS1 par challongeId
 *
 * Cache : 5 min côté serveur, SWR 10 min.
 */

import { NextResponse } from "next/server";

import { challongeToViewerData } from "@/lib/brackets/challonge";
import { bracketDbToViewerData } from "@/lib/brackets/db";
import { loadJsonSafe } from "@/lib/data-cache";
import { db, schema, eq, or } from "@/lib/db";
import type { ScrapedTournament } from "@/lib/brackets/challonge";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

// Mappe les IDs tournois vers leurs exports JSON "Max Data" (BTS)
const JSON_MAPPING: Record<string, string> = {
	bts1: "B_TS1.json",
	bts2: "B_TS2.json",
	bts3: "B_TS3.json",
	bts4: "B_TS4.json",
	bts5: "B_TS5.json",
};

export async function GET(
	_req: Request,
	{ params }: RouteParams,
): Promise<Response> {
	const { id: idOrChallongeId } = await params;

	if (!idOrChallongeId) {
		return NextResponse.json({ error: "id requis" }, { status: 400 });
	}

	// 1. Tenter le chargement via JSON export (Source de vérité riche pour BTS)
	const jsonFile = JSON_MAPPING[idOrChallongeId];
	if (jsonFile) {
		const raw = await loadJsonSafe<ScrapedTournament>(
			`data/exports/${jsonFile}`,
		);
		if (raw && raw.matches && raw.matches.length > 0) {
			const data = challongeToViewerData(raw, {
				tournamentId: idOrChallongeId,
			});
			return NextResponse.json(data, {
				headers: {
					"x-tournament-id": idOrChallongeId,
					"x-bracket-source": "json-export",
					"x-bracket-matches-count": String(data.matches.length),
					"x-bracket-participants-count": String(data.participants.length),
					"cache-control":
						"public, s-maxage=3600, stale-while-revalidate=86400",
				},
			});
		}
	}

	// 2. Fallback DB (Matches sync via scraper ou bot-api)
	const tournament = await db.query.tournaments.findFirst({
		where: or(
			eq(schema.tournaments.id, idOrChallongeId),
			eq(schema.tournaments.challongeId, idOrChallongeId),
		),
		with: {
			tournamentParticipants: true,
			tournamentMatches: true,
		},
	});

	if (!tournament) {
		return NextResponse.json(
			{ error: `tournament '${idOrChallongeId}' introuvable` },
			{ status: 404 },
		);
	}

	// Si on a un export JSON par le nom du tournoi (cas d'un CUID Prisma pointant vers un BTS)
	const nameSlugMatch = Object.entries(JSON_MAPPING).find(([slug, file]) => {
		return (
			tournament.name.toLowerCase().includes(slug) ||
			tournament.challongeUrl?.includes(slug)
		);
	});

	if (nameSlugMatch) {
		const raw = await loadJsonSafe<ScrapedTournament>(
			`data/exports/${nameSlugMatch[1]}`,
		);
		if (raw && raw.matches && raw.matches.length > 0) {
			const data = challongeToViewerData(raw, { tournamentId: tournament.id });
			return NextResponse.json(data, {
				headers: {
					"x-tournament-id": tournament.id,
					"x-bracket-source": "json-export-by-name",
					"x-bracket-matches-count": String(data.matches.length),
					"cache-control": "public, s-maxage=3600",
				},
			});
		}
	}

	const data = bracketDbToViewerData(
		{ id: tournament.id, name: tournament.name, format: tournament.format },
		tournament.tournamentParticipants,
		tournament.tournamentMatches,
	);

	return NextResponse.json(data, {
		headers: {
			"x-tournament-id": tournament.id,
			"x-tournament-name": encodeURIComponent(tournament.name),
			"x-bracket-source": "db",
			"x-bracket-matches-count": String(data.matches.length),
			"x-bracket-participants-count": String(data.participants.length),
			"cache-control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
}
