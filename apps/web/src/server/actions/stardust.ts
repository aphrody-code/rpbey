"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
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

function normalizeName(raw: string): string {
	const [before] = raw.split("/");
	return (before ?? raw).trim();
}

function keyOf(raw: string): string {
	return normalizeName(raw).toLowerCase();
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

export async function syncStardustRanking() {
	if (!(await requireAdmin())) throw new Error("Forbidden");
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
	if (!(await requireAdmin())) throw new Error("Forbidden");
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
