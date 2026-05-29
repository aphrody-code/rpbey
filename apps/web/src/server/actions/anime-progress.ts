"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import * as dal from "@/server/dal/anime";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function getUserContinueWatching() {
  const user = await getSessionUser();
  if (!user) return [];
  return dal.listContinueWatching(user.id);
}

export async function getSeriesProgress(seriesId: string) {
  const user = await getSessionUser();
  if (!user) return {};
  return dal.getSeriesProgressMap(user.id, seriesId);
}

export async function getEpisodeProgress(episodeId: string) {
  const user = await getSessionUser();
  if (!user) return null;
  return dal.getEpisodeProgressFor(user.id, episodeId);
}

export async function updateWatchProgress(
  episodeId: string,
  progressTime: number,
  duration: number,
) {
  const user = await getSessionUser();
  if (!user) return null;
  return dal.saveWatchProgress(user.id, episodeId, progressTime, duration);
}
