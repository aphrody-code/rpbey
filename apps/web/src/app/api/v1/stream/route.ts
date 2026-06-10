import { StreamListResponseSchema, StreamQuerySchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getBeyTubeFeatured, getRpbYoutubeVideos } from "@/server/dal/stream";

/**
 * `/api/v1/stream` — feed vidéo de la communauté RPB TV.
 * Sans `channelId` (ou `featured=true`) : vidéos BeyTube mises en avant.
 * Avec `channelId` : rediffusions d'une chaîne YouTube (forme BeyTube compatible).
 */
export const GET = getRoute({
  query: StreamQuerySchema,
  response: StreamListResponseSchema,
  async handle({ query }) {
    const limit = query.limit ?? 20;
    if (query.channelId) {
      const vids = await getRpbYoutubeVideos(query.channelId, limit);
      return {
        videos: vids.map((v) => ({
          id: v.id,
          title: v.title,
          channelName: v.channelName,
          channelAvatar: v.channelAvatar,
          views: v.viewCount,
          thumbnail: v.thumbnailUrl,
          url: v.url,
          duration: v.duration,
          ago: null,
        })),
      };
    }
    return { videos: await getBeyTubeFeatured(limit) };
  },
});
