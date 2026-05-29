"use server";

import { requireAdmin } from "@/lib/auth-utils";
import * as dal from "@/server/dal/anime";

export async function getAnimeSeries() {
  return dal.listPublishedSeries();
}

export async function getAnimeSeriesByGeneration() {
  return dal.listSeriesByGeneration();
}

export async function getAnimeSeriesBySlug(slug: string) {
  return dal.getSeriesBySlug(slug);
}

export async function getAnimeEpisode(slug: string, episodeNumber: number) {
  return dal.getEpisodeByNumber(slug, episodeNumber);
}

export async function getFeaturedAnimeSeries() {
  return dal.listFeaturedSeries();
}

export async function searchAnime(query: string) {
  return dal.searchPublished(query);
}

// Admin actions
export async function getAllAnimeSeries() {
  return dal.listAllSeriesWithCounts();
}

export async function getAnimeSeriesById(id: string) {
  return dal.getSeriesByIdFull(id);
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
  return dal.upsertSeries(data);
}

export async function deleteAnimeSeries(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  return dal.deleteSeries(id);
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
  return dal.upsertEpisode(data);
}

export async function deleteAnimeEpisode(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  return dal.deleteEpisode(id);
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
  return dal.upsertSource(data);
}

export async function deleteAnimeSource(id: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  return dal.deleteSource(id);
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
  return dal.bulkUpsertEpisodes(seriesId, episodes);
}
