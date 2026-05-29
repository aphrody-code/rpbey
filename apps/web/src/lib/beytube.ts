"use server";

import { db, schema, eq, desc } from "@/lib/db";

export interface BeyTubeVideo {
  id: string;
  title: string;
  channelName: string;
  channelAvatar?: string;
  views: number;
  thumbnail: string;
  url: string;
  duration?: string;
  ago?: string;
}

export async function getBeyTubeFeatured(): Promise<BeyTubeVideo[]> {
  try {
    const videos = await db.query.youtubeVideos.findMany({
      where: eq(schema.youtubeVideos.isFeatured, true),
      orderBy: desc(schema.youtubeVideos.publishedAt),
      limit: 20,
    });

    return videos.map((v) => ({
      id: v.id,
      title: v.title,
      channelName: v.channelName,
      channelAvatar: v.channelAvatar || undefined,
      views: v.views,
      thumbnail: v.thumbnail,
      url: v.url,
      duration: v.duration,
      ago: formatTimeAgo(new Date(v.publishedAt)),
    }));
  } catch (e) {
    console.error("[BeyTube] DB Error:", e);
    return [];
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "À l'instant";
  if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
  if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
  return `Il y a ${Math.floor(diffInSeconds / 604800)} sem`;
}
