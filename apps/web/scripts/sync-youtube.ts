#!/usr/bin/env bun
/**
 * Rafraîchit la table `youtube_videos` depuis les flux RSS YouTube (pas de clé
 * API requise) des chaînes suivies. Alimente /tv (rediffusions) + la homepage
 * (vidéos featured). Le RSS ne fournit pas la durée ni l'avatar de chaîne :
 * on préserve les valeurs existantes en DB et on défaut à "YouTube" sinon.
 *
 *   cd apps/web && bun scripts/sync-youtube.ts
 */
import { parseStringPromise } from "xml2js";
import { db, schema } from "@rpbey/db";
import { sql } from "drizzle-orm";

const RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=";

// Chaînes suivies (id → nom de repli si la chaîne est nouvelle en DB).
const CHANNELS: { id: string; fallbackName: string }[] = [
	{ id: "UCHiDwWI-2uQrsUiJhXt6rng", fallbackName: "RPB" },
	{ id: "UCm3y-lCQUOM6Vj52LSoLTvA", fallbackName: "Sun After the Reign" },
	{ id: "UCu3yEYIoXsNqjGzlAxWRcLw", fallbackName: "Scale Emperors" },
	{ id: "UC7kNAYs7r27OAX0JLjkSt0g", fallbackName: "SKARN" },
	{ id: "UCaGPpRP8MJzc5s8WGOD4jLw", fallbackName: "Le Purgatoire de Ryuk - Beyblade" },
];

interface RssVideo {
	id: string;
	title: string;
	url: string;
	thumbnail: string;
	publishedAt: string; // ISO
	views: number;
	channelId: string;
	channelName: string;
}

async function fetchChannel(channelId: string): Promise<RssVideo[]> {
	const res = await fetch(`${RSS}${channelId}`, {
		signal: AbortSignal.timeout(10_000),
		headers: { "user-agent": "rpbey-sync/1.0" },
	});
	if (!res.ok) throw new Error(`RSS ${channelId} → HTTP ${res.status}`);
	const xml = await res.text();
	// biome-ignore lint: xml2js renvoie any
	const parsed: any = await parseStringPromise(xml);
	const channelName: string = parsed.feed?.author?.[0]?.name?.[0] ?? "";
	const entries: any[] = parsed.feed?.entry ?? [];
	return entries
		.map((e: any): RssVideo | null => {
			const id = e["yt:videoId"]?.[0];
			if (!id) return null;
			const grp = e["media:group"]?.[0];
			const stats =
				grp?.["media:community"]?.[0]?.["media:statistics"]?.[0]?.$;
			return {
				id,
				title: e.title?.[0] ?? grp?.["media:title"]?.[0] ?? "(sans titre)",
				url: e.link?.[0]?.$?.href ?? `https://www.youtube.com/watch?v=${id}`,
				thumbnail:
					grp?.["media:thumbnail"]?.[0]?.$?.url ??
					`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
				publishedAt: new Date(e.published?.[0] ?? Date.now()).toISOString(),
				views: stats?.views ? parseInt(stats.views, 10) : 0,
				channelId,
				channelName,
			};
		})
		.filter((v): v is RssVideo => v !== null);
}

async function main() {
	// Avatar + nom existants par chaîne (préservés sur insert de nouvelles vidéos).
	const existing = await db
		.select({
			channelId: schema.youtubeVideos.channelId,
			channelName: schema.youtubeVideos.channelName,
			channelAvatar: schema.youtubeVideos.channelAvatar,
		})
		.from(schema.youtubeVideos);
	const avatarByChannel = new Map<string, string | null>();
	const nameByChannel = new Map<string, string>();
	for (const r of existing) {
		if (!avatarByChannel.has(r.channelId) && r.channelAvatar)
			avatarByChannel.set(r.channelId, r.channelAvatar);
		if (!nameByChannel.has(r.channelId) && r.channelName)
			nameByChannel.set(r.channelId, r.channelName);
	}

	let inserted = 0;
	let updated = 0;
	const now = new Date().toISOString();

	for (const ch of CHANNELS) {
		let videos: RssVideo[];
		try {
			videos = await fetchChannel(ch.id);
		} catch (err) {
			console.error(`[skip] ${ch.fallbackName}: ${String(err)}`);
			continue;
		}
		const channelName =
			videos[0]?.channelName || nameByChannel.get(ch.id) || ch.fallbackName;

		for (const v of videos) {
			const res = await db
				.insert(schema.youtubeVideos)
				.values({
					id: v.id,
					title: v.title,
					url: v.url,
					thumbnail: v.thumbnail,
					views: v.views,
					duration: "YouTube",
					publishedAt: v.publishedAt,
					channelId: ch.id,
					channelName,
					channelAvatar: avatarByChannel.get(ch.id) ?? null,
					isFeatured: true,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: schema.youtubeVideos.id,
					// Sur conflit : on rafraîchit titre / vues / miniature / date,
					// on garde duration + channelAvatar + isFeatured existants.
					set: {
						title: v.title,
						url: v.url,
						thumbnail: v.thumbnail,
						views: v.views,
						publishedAt: v.publishedAt,
						channelName,
						updatedAt: now,
					},
				})
				.returning({ created: sql<boolean>`(xmax = 0)` });
			if (res[0]?.created) inserted += 1;
			else updated += 1;
		}
		console.log(`[ok] ${channelName}: ${videos.length} vidéos RSS`);
	}

	console.log(`\nTerminé — ${inserted} insérées, ${updated} mises à jour.`);
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
