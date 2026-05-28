"use server";

import { requireAdmin } from "@/lib/auth-utils";
import {
	db,
	schema,
	and,
	or,
	eq,
	lt,
	gt,
	ilike,
	isNotNull,
	asc,
	desc,
	count,
} from "@/lib/db";

export async function getAnimeSeries() {
	return db.query.animeSeries.findMany({
		where: eq(schema.animeSeries.isPublished, true),
		orderBy: asc(schema.animeSeries.sortOrder),
	});
}

export async function getAnimeSeriesByGeneration() {
	const series = await db.query.animeSeries.findMany({
		where: eq(schema.animeSeries.isPublished, true),
		orderBy: asc(schema.animeSeries.sortOrder),
	});

	const grouped: Record<string, typeof series> = {};
	for (const s of series) {
		if (!grouped[s.generation]) grouped[s.generation] = [];
		grouped[s.generation]?.push(s);
	}
	return grouped;
}

export async function getAnimeSeriesBySlug(slug: string) {
	const series = await db.query.animeSeries.findFirst({
		where: eq(schema.animeSeries.slug, slug),
		with: {
			animeEpisodes: {
				where: eq(schema.animeEpisodes.isPublished, true),
				orderBy: asc(schema.animeEpisodes.number),
				with: {
					animeEpisodeSources: {
						where: eq(schema.animeEpisodeSources.isActive, true),
						orderBy: desc(schema.animeEpisodeSources.priority),
					},
				},
			},
		},
	});
	if (!series) return null;
	return {
		...series,
		episodes: series.animeEpisodes.map((e) => ({
			...e,
			sources: e.animeEpisodeSources,
		})),
	};
}

export async function getAnimeEpisode(slug: string, episodeNumber: number) {
	const series = await db.query.animeSeries.findFirst({
		where: eq(schema.animeSeries.slug, slug),
	});

	if (!series) return null;

	const episodeRow = await db.query.animeEpisodes.findFirst({
		where: and(
			eq(schema.animeEpisodes.seriesId, series.id),
			eq(schema.animeEpisodes.number, episodeNumber),
		),
		with: {
			animeEpisodeSources: {
				where: eq(schema.animeEpisodeSources.isActive, true),
				orderBy: desc(schema.animeEpisodeSources.priority),
			},
			animeSery: true,
		},
	});

	if (!episodeRow) return null;

	const episode = {
		...episodeRow,
		sources: episodeRow.animeEpisodeSources,
		series: episodeRow.animeSery,
	};

	// Get prev/next episodes + all episodes for sidebar
	const [prev, next, allEpisodes] = await Promise.all([
		db.query.animeEpisodes.findFirst({
			where: and(
				eq(schema.animeEpisodes.seriesId, series.id),
				lt(schema.animeEpisodes.number, episodeNumber),
				eq(schema.animeEpisodes.isPublished, true),
			),
			orderBy: desc(schema.animeEpisodes.number),
			columns: { number: true, title: true, titleFr: true },
		}),
		db.query.animeEpisodes.findFirst({
			where: and(
				eq(schema.animeEpisodes.seriesId, series.id),
				gt(schema.animeEpisodes.number, episodeNumber),
				eq(schema.animeEpisodes.isPublished, true),
			),
			orderBy: asc(schema.animeEpisodes.number),
			columns: { number: true, title: true, titleFr: true },
		}),
		db.query.animeEpisodes.findMany({
			where: and(
				eq(schema.animeEpisodes.seriesId, series.id),
				eq(schema.animeEpisodes.isPublished, true),
			),
			orderBy: asc(schema.animeEpisodes.number),
			columns: {
				id: true,
				number: true,
				title: true,
				titleFr: true,
				thumbnailUrl: true,
				duration: true,
			},
		}),
	]);

	return {
		episode,
		series,
		prev: prev ?? null,
		next: next ?? null,
		allEpisodes,
	};
}

export async function getFeaturedAnimeSeries() {
	return db.query.animeSeries.findMany({
		where: and(
			eq(schema.animeSeries.isPublished, true),
			isNotNull(schema.animeSeries.bannerUrl),
		),
		orderBy: asc(schema.animeSeries.sortOrder),
		limit: 5,
	});
}

export async function searchAnime(query: string) {
	const pattern = `%${query}%`;
	const [series, episodeRows] = await Promise.all([
		db.query.animeSeries.findMany({
			where: and(
				eq(schema.animeSeries.isPublished, true),
				or(
					ilike(schema.animeSeries.title, pattern),
					ilike(schema.animeSeries.titleFr, pattern),
					ilike(schema.animeSeries.titleJp, pattern),
				),
			),
			limit: 10,
		}),
		db.query.animeEpisodes.findMany({
			where: and(
				eq(schema.animeEpisodes.isPublished, true),
				or(
					ilike(schema.animeEpisodes.title, pattern),
					ilike(schema.animeEpisodes.titleFr, pattern),
				),
			),
			with: { animeSery: { columns: { slug: true, title: true } } },
			limit: 10,
		}),
	]);
	const episodes = episodeRows.map((e) => ({
		...e,
		series: e.animeSery,
	}));
	return { series, episodes };
}

// Admin actions
export async function getAllAnimeSeries() {
	const series = await db.query.animeSeries.findMany({
		orderBy: asc(schema.animeSeries.sortOrder),
	});
	const counts = await db
		.select({
			seriesId: schema.animeEpisodes.seriesId,
			value: count(),
		})
		.from(schema.animeEpisodes)
		.groupBy(schema.animeEpisodes.seriesId);
	const countMap = new Map(counts.map((c) => [c.seriesId, c.value]));
	return series.map((s) => ({
		...s,
		_count: { episodes: countMap.get(s.id) ?? 0 },
	}));
}

export async function getAnimeSeriesById(id: string) {
	const series = await db.query.animeSeries.findFirst({
		where: eq(schema.animeSeries.id, id),
		with: {
			animeEpisodes: {
				orderBy: asc(schema.animeEpisodes.number),
				with: {
					animeEpisodeSources: {
						orderBy: desc(schema.animeEpisodeSources.priority),
					},
				},
			},
		},
	});
	if (!series) return null;
	return {
		...series,
		episodes: series.animeEpisodes.map((e) => ({
			...e,
			sources: e.animeEpisodeSources,
			_count: { sources: e.animeEpisodeSources.length },
		})),
	};
}

export async function upsertAnimeSeries(data: {
	id?: string;
	slug: string;
	title: string;
	titleJp?: string;
	titleFr?: string;
	generation: "ORIGINAL" | "METAL" | "BURST" | "X";
	synopsis?: string;
	posterUrl?: string;
	bannerUrl?: string;
	year: number;
	episodeCount: number;
	sortOrder: number;
	isPublished: boolean;
}) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const { id, ...rest } = data;
	if (id) {
		const [row] = await db
			.update(schema.animeSeries)
			.set(rest)
			.where(eq(schema.animeSeries.id, id))
			.returning();
		return row;
	}
	const [row] = await db.insert(schema.animeSeries).values(rest).returning();
	return row;
}

export async function deleteAnimeSeries(id: string) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const [row] = await db
		.delete(schema.animeSeries)
		.where(eq(schema.animeSeries.id, id))
		.returning();
	return row;
}

export async function upsertAnimeEpisode(data: {
	id?: string;
	seriesId: string;
	number: number;
	title: string;
	titleFr?: string;
	titleJp?: string;
	synopsis?: string;
	thumbnailUrl?: string;
	duration: number;
	isPublished: boolean;
}) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const { id, ...rest } = data;
	if (id) {
		const [row] = await db
			.update(schema.animeEpisodes)
			.set(rest)
			.where(eq(schema.animeEpisodes.id, id))
			.returning();
		return row;
	}
	const [row] = await db.insert(schema.animeEpisodes).values(rest).returning();
	return row;
}

export async function deleteAnimeEpisode(id: string) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const [row] = await db
		.delete(schema.animeEpisodes)
		.where(eq(schema.animeEpisodes.id, id))
		.returning();
	return row;
}

export async function upsertAnimeSource(data: {
	id?: string;
	episodeId: string;
	type: "YOUTUBE" | "DAILYMOTION" | "MP4" | "HLS" | "IFRAME";
	url: string;
	quality: string;
	language: string;
	priority: number;
	isActive: boolean;
}) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const { id, ...rest } = data;
	if (id) {
		const [row] = await db
			.update(schema.animeEpisodeSources)
			.set(rest)
			.where(eq(schema.animeEpisodeSources.id, id))
			.returning();
		return row;
	}
	const [row] = await db
		.insert(schema.animeEpisodeSources)
		.values(rest)
		.returning();
	return row;
}

export async function deleteAnimeSource(id: string) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const [row] = await db
		.delete(schema.animeEpisodeSources)
		.where(eq(schema.animeEpisodeSources.id, id))
		.returning();
	return row;
}

export async function bulkImportEpisodes(
	seriesId: string,
	episodes: Array<{
		number: number;
		title: string;
		titleFr?: string;
		duration?: number;
	}>,
) {
	if (!(await requireAdmin())) throw new Error("Forbidden");
	const results = [];
	for (const ep of episodes) {
		const [result] = await db
			.insert(schema.animeEpisodes)
			.values({
				seriesId,
				number: ep.number,
				title: ep.title,
				titleFr: ep.titleFr,
				duration: ep.duration ?? 0,
			})
			.onConflictDoUpdate({
				target: [schema.animeEpisodes.seriesId, schema.animeEpisodes.number],
				set: {
					title: ep.title,
					titleFr: ep.titleFr,
					duration: ep.duration ?? 0,
				},
			})
			.returning();
		results.push(result);
	}
	return results;
}
