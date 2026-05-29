"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, schema, and, eq, inArray, desc } from "@/lib/db";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function getUserContinueWatching() {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await db.query.animeWatchProgress.findMany({
    where: and(
      eq(schema.animeWatchProgress.userId, user.id),
      eq(schema.animeWatchProgress.status, "IN_PROGRESS"),
    ),
    orderBy: desc(schema.animeWatchProgress.updatedAt),
    limit: 20,
    with: {
      animeEpisode: {
        with: {
          animeSery: {
            columns: { slug: true, title: true, posterUrl: true },
          },
        },
      },
    },
  });

  return rows.map((p) => ({
    ...p,
    episode: {
      ...p.animeEpisode,
      series: p.animeEpisode.animeSery,
    },
  }));
}

export async function getSeriesProgress(seriesId: string) {
  const user = await getSessionUser();
  if (!user) return {};

  // Episodes for this series
  const episodes = await db
    .select({ id: schema.animeEpisodes.id })
    .from(schema.animeEpisodes)
    .where(eq(schema.animeEpisodes.seriesId, seriesId));
  const episodeIds = episodes.map((e) => e.id);

  const progress = episodeIds.length
    ? await db.query.animeWatchProgress.findMany({
        where: and(
          eq(schema.animeWatchProgress.userId, user.id),
          inArray(schema.animeWatchProgress.episodeId, episodeIds),
        ),
      })
    : [];

  const map: Record<string, { status: string; progressTime: number; episodeId: string }> = {};
  for (const p of progress) {
    map[p.episodeId] = {
      status: p.status,
      progressTime: p.progressTime,
      episodeId: p.episodeId,
    };
  }
  return map;
}

export async function getEpisodeProgress(episodeId: string) {
  const user = await getSessionUser();
  if (!user) return null;

  const row = await db.query.animeWatchProgress.findFirst({
    where: and(
      eq(schema.animeWatchProgress.userId, user.id),
      eq(schema.animeWatchProgress.episodeId, episodeId),
    ),
  });
  return row ?? null;
}

export async function updateWatchProgress(
  episodeId: string,
  progressTime: number,
  duration: number,
) {
  const user = await getSessionUser();
  if (!user) return null;

  const isCompleted = duration > 0 && progressTime / duration > 0.9;
  const completedAt = isCompleted ? new Date().toISOString() : null;

  const [row] = await db
    .insert(schema.animeWatchProgress)
    .values({
      userId: user.id,
      episodeId,
      progressTime: Math.floor(progressTime),
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      completedAt,
    })
    .onConflictDoUpdate({
      target: [schema.animeWatchProgress.userId, schema.animeWatchProgress.episodeId],
      set: {
        progressTime: Math.floor(progressTime),
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
        completedAt,
      },
    })
    .returning();

  return row ?? null;
}
