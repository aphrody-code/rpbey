import { GetUserPosts } from "@tobyg74/tiktok-api-dl";
import { unstable_cache } from "next/cache";
import { type TikTokVideo } from "@/lib/tiktok-types";

export { type TikTokVideo };

async function fetchTikTokVideos(username: string): Promise<TikTokVideo[]> {
  // TikTok API is highly unstable and often blocks cloud IPs (like Hetzner)
  // We use a very short timeout and aggressive error handling
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TikTok Timeout")), 2000),
    );

    // We only attempt to fetch if not in a known "blocked" environment or for specific users
    const fetchPromise = GetUserPosts(username).catch((e) => {
      console.warn(`[TikTok] Fetch error for ${username}:`, e.message || e);
      return { status: "error", result: [] };
    });

    const result = (await Promise.race([fetchPromise, timeout])) as {
      status: string;
      result?: Record<string, unknown>[];
    };

    if (!result || result.status !== "success" || !result.result || !Array.isArray(result.result)) {
      return getFallbackVideos(username);
    }

    interface TikTokPost {
      id: string;
      desc?: string;
      createTime?: number;
      video?: { dynamicCover?: string; cover?: string; playAddr?: string };
      author?: { username?: string; nickname?: string; avatarThumb?: string };
      stats?: { playCount?: number; diggCount?: number };
    }
    return result.result.slice(0, 12).map((post: unknown) => {
      const p = post as TikTokPost;
      return {
        id: p.id,
        desc: p.desc || "",
        createTime: p.createTime || Math.floor(Date.now() / 1000),
        cover: p.video?.dynamicCover || p.video?.cover || "/logo.webp",
        playUrl: p.video?.playAddr || "",
        author: {
          username: p.author?.username || username,
          nickname: p.author?.nickname || username,
          avatarThumb: p.author?.avatarThumb || "/logo.webp",
        },
        stats: {
          playCount: p.stats?.playCount || 0,
          diggCount: p.stats?.diggCount || 0,
        },
        url: `https://www.tiktok.com/@${username}/video/${p.id}`,
      };
    });
  } catch {
    return getFallbackVideos(username);
  }
}

// Aucun fallback fabriqué : si l'API TikTok échoue (les IP cloud sont souvent
// bloquées), on renvoie une liste vide et la section TikTok se masque d'elle-même
// (TvFeed : `if (videos.length === 0) return null`). Jamais de fausses métriques.
function getFallbackVideos(_username: string): TikTokVideo[] {
  return [];
}

const getCachedTikTokVideos = unstable_cache(
  async (username: string) => fetchTikTokVideos(username),
  ["tiktok-videos-v1"],
  { revalidate: 3600, tags: ["tiktok"] },
);

export const getTikTokVideos = (username: string) => getCachedTikTokVideos(username);
