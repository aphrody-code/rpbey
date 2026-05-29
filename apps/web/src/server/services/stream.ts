import "server-only";
import { client } from "@rpbey/api-client";
import type {
  BeyTubeVideo,
  OkEnvelope,
  StreamInfo,
  StreamListResponse,
  TikTokVideo,
  TvFeedResponse,
  TwitchVideo,
  YoutubeVideo,
} from "@rpbey/api-contract";
import { getBeyTubeFeatured, getRpbYoutubeVideos } from "@/server/dal/stream";
import { isRemote } from "@/server/data-source";
import { getTikTokVideos } from "@/lib/tiktok";
import { getLatestRPBVideo, getRPBClips, getRPBStreamInfo } from "@/lib/twitch";

/**
 * Service stream / média (RPB TV). UI-agnostic : assemble les sources DB (DAL)
 * et les flux externes Twitch / TikTok en formes contrat (timestamps ISO).
 *
 * Seam co-localisé / standalone : la liste BeyTube (DB) bascule sur le SDK distant
 * quand `isRemote`. Les flux Twitch / TikTok sont des APIs tierces appelées
 * server-side dans les deux modes (pas de round-trip interne pertinent).
 */

const RPB_YT_CHANNEL_ID = "UCHiDwWI-2uQrsUiJhXt6rng";

/**
 * Liste de vidéos BeyTube mises en avant (forme contrat) — `/api/v1/stream`.
 *
 * Seam : en standalone (`isRemote`), lit l'API distante `/api/v1/stream` via le
 * client SDK générique (typé contre `StreamListResponse`) ; sinon DAL en direct.
 */
export async function listBeyTubeFeed(limit = 20): Promise<BeyTubeVideo[]> {
  if (isRemote) {
    const res = await client.get({
      url: "/api/v1/stream",
      query: { featured: "true", limit },
    });
    const env = res.data as OkEnvelope<StreamListResponse> | undefined;
    if (res.error || !env?.ok) {
      throw new Error(`[stream] appel SDK distant échoué : ${JSON.stringify(res.error)}`);
    }
    return env.data.videos;
  }
  return getBeyTubeFeatured(limit);
}

/** Tolère l'échec d'une source externe sans casser le feed entier. */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/** Normalise une `VideoInfo` Twitch (objet `Date`) en forme contrat (ISO). */
function toTwitchVideo(v: {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: Date;
  viewCount: number;
  channelLogo?: string;
  channelName?: string;
  channelAvatar?: string | null;
}): TwitchVideo {
  return {
    id: v.id,
    title: v.title,
    url: v.url,
    thumbnailUrl: v.thumbnailUrl,
    duration: v.duration,
    publishedAt: v.publishedAt.toISOString(),
    viewCount: v.viewCount,
    channelLogo: v.channelLogo ?? null,
    channelName: v.channelName ?? null,
    channelAvatar: v.channelAvatar ?? null,
  };
}

/** Normalise l'info de live Twitch (objet `Date`) en forme contrat (ISO). */
function toStreamInfo(s: StreamInfoRaw | null): StreamInfo | null {
  if (!s) return null;
  return {
    isLive: s.isLive,
    title: s.title ?? null,
    gameName: s.gameName ?? null,
    viewerCount: s.viewerCount ?? null,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    thumbnailUrl: s.thumbnailUrl ?? null,
    userName: s.userName,
    avatarUrl: s.avatarUrl ?? null,
  };
}

interface StreamInfoRaw {
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: Date;
  thumbnailUrl?: string;
  userName: string;
  avatarUrl?: string;
}

/** Live Twitch courant en forme contrat. */
export async function getLiveStreamInfo(): Promise<StreamInfo | null> {
  return toStreamInfo(await safe(getRPBStreamInfo(), null));
}

/** Dernière VOD Twitch en forme contrat. */
export async function getLatestVideo(): Promise<TwitchVideo | null> {
  const v = await safe(getLatestRPBVideo(), null);
  return v ? toTwitchVideo(v) : null;
}

/** Feed RPB TV complet — assemble live + clips + rediffusions + BeyTube + TikTok. */
export async function getTvFeed(): Promise<TvFeedResponse> {
  const [stream, clips, rpbVideos, beyTubeVideos, tikTokVideos] = await Promise.all([
    getLiveStreamInfo(),
    safe(getRPBClips(20), []).then((cs) => cs.map(toTwitchVideo)),
    safe(getRpbYoutubeVideos(RPB_YT_CHANNEL_ID, 20), []) as Promise<YoutubeVideo[]>,
    safe(getBeyTubeFeatured(20), []) as Promise<BeyTubeVideo[]>,
    getAllTikTok(),
  ]);

  return { stream, clips, rpbVideos, beyTubeVideos, tikTokVideos };
}

/** Agrège et trie les TikTok des comptes RPB suivis. */
async function getAllTikTok(): Promise<TikTokVideo[]> {
  const [rpb, skarn, sun] = await Promise.all([
    safe(getTikTokVideos("rpbeyblade1"), []),
    safe(getTikTokVideos("skarngamemaster"), []),
    safe(getTikTokVideos("sunafterthereign"), []),
  ]);
  return [...rpb, ...skarn, ...sun].sort((a, b) => b.createTime - a.createTime).slice(0, 20);
}
