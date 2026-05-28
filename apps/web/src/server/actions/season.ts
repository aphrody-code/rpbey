"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-utils";
import {
	db,
	schema,
	and,
	or,
	eq,
	gt,
	gte,
	desc,
	count,
	inArray,
} from "@/lib/db";

// Zod Schemas
const CreateSeasonSchema = z.object({
	name: z.string().min(3),
	slug: z
		.string()
		.min(3)
		.regex(/^[a-z0-9-]+$/),
});

const ArchiveSeasonSchema = z.object({
	nextSeasonName: z.string().min(3),
	nextSeasonSlug: z
		.string()
		.min(3)
		.regex(/^[a-z0-9-]+$/),
});

// Cached Data Fetching
export async function getCurrentSeason() {
	const season = await db.query.rankingSeasons.findFirst({
		where: eq(schema.rankingSeasons.isActive, true),
	});
	return season ?? null;
}

export async function getSeasons() {
	return await db.query.rankingSeasons.findMany({
		orderBy: desc(schema.rankingSeasons.startDate),
	});
}

export async function getSeasonStandings(slug: string) {
	const season = await db.query.rankingSeasons.findFirst({
		where: eq(schema.rankingSeasons.slug, slug),
		with: {
			seasonEntries: {
				with: {
					user: {
						with: { profiles: true },
					},
				},
				orderBy: desc(schema.seasonEntries.points),
			},
		},
	});
	if (!season) return null;

	// Per-user tournament participation counts (Prisma _count.tournaments)
	const userIds = season.seasonEntries
		.map((e) => e.userId)
		.filter((id): id is string => id != null);
	const countMap = new Map<string, number>();
	if (userIds.length > 0) {
		const rows = await db
			.select({
				userId: schema.tournamentParticipants.userId,
				value: count(),
			})
			.from(schema.tournamentParticipants)
			.where(inArray(schema.tournamentParticipants.userId, userIds))
			.groupBy(schema.tournamentParticipants.userId);
		for (const r of rows) if (r.userId) countMap.set(r.userId, r.value);
	}

	return {
		...season,
		entries: season.seasonEntries.map((e) => ({
			...e,
			user: e.user
				? {
						...e.user,
						profile: e.user.profiles[0] ?? null,
						_count: {
							tournaments: e.userId ? (countMap.get(e.userId) ?? 0) : 0,
						},
					}
				: null,
		})),
	};
}

// Mutations
export async function createSeason(name: string, slug: string) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	// Validate input
	const result = CreateSeasonSchema.safeParse({ name, slug });
	if (!result.success) {
		throw new Error(`Invalid input: ${result.error.message}`);
	}

	// Deactivate current season if exists
	await db
		.update(schema.rankingSeasons)
		.set({ isActive: false, endDate: new Date().toISOString() })
		.where(eq(schema.rankingSeasons.isActive, true));

	const [season] = await db
		.insert(schema.rankingSeasons)
		.values({
			name,
			slug,
			isActive: true,
			startDate: new Date().toISOString(),
		})
		.returning();

	// revalidateTag('seasons');
	revalidatePath("/admin/rankings");
	return season;
}

export async function archiveCurrentSeason(
	nextSeasonName: string,
	nextSeasonSlug: string,
) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	// Validate input
	const result = ArchiveSeasonSchema.safeParse({
		nextSeasonName,
		nextSeasonSlug,
	});
	if (!result.success) {
		throw new Error(`Invalid input: ${result.error.message}`);
	}

	const currentSeason = await getCurrentSeason();

	if (!currentSeason) {
		throw new Error("Aucune saison active à archiver.");
	}

	// Transaction to ensure atomic operation
	await db.transaction(async (tx) => {
		// 1. Snapshot global rankings to SeasonEntry
		const rankings = await tx.query.globalRankings.findMany({
			where: or(
				gt(schema.globalRankings.points, 0),
				gt(schema.globalRankings.wins, 0),
				gt(schema.globalRankings.losses, 0),
				gt(schema.globalRankings.tournamentWins, 0),
			),
		});

		const entriesData = rankings.map((r) => ({
			seasonId: currentSeason.id,
			userId: r.userId,
			playerName: r.playerName,
			points: r.points,
			wins: r.wins,
			losses: r.losses,
			tournamentWins: r.tournamentWins,
		}));

		if (entriesData.length > 0) {
			await tx
				.insert(schema.seasonEntries)
				.values(entriesData)
				.onConflictDoNothing();
		}

		// 2. Mark old tournaments as ARCHIVED
		await tx
			.update(schema.tournaments)
			.set({ status: "ARCHIVED" })
			.where(
				and(
					eq(schema.tournaments.status, "COMPLETE"),
					gte(schema.tournaments.date, currentSeason.startDate),
				),
			);

		// 3. Reset Rankings & Profiles
		await tx.update(schema.globalRankings).set({
			points: 0,
			wins: 0,
			losses: 0,
			tournamentWins: 0,
		});

		await tx.update(schema.profiles).set({
			rankingPoints: 0,
			wins: 0,
			losses: 0,
			tournamentWins: 0,
		});

		// 4. Create Next Season
		await tx
			.update(schema.rankingSeasons)
			.set({ isActive: false, endDate: new Date().toISOString() })
			.where(eq(schema.rankingSeasons.id, currentSeason.id));

		await tx.insert(schema.rankingSeasons).values({
			name: nextSeasonName,
			slug: nextSeasonSlug,
			isActive: true,
			startDate: new Date().toISOString(),
		});
	});

	// revalidateTag('seasons');
	revalidatePath("/admin/rankings");
	return { success: true };
}
