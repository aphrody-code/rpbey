import { z } from "zod";
import { IsoDateSchema } from "./envelope";

// Stream / média — RPB TV : vidéos BeyTube (table `youtubeVideos`, @rpbey/db,
// timestamps mode:"string" → ISO), plus les flux externes Twitch & TikTok (APIs
// tierces, pas de DB). Le contrat normalise tout en string ISO sur le fil.

/** Vidéo communautaire BeyTube (reflet partiel de la table `youtubeVideos`). */
export const BeyTubeVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channelName: z.string(),
  channelAvatar: z.string().nullish(),
  views: z.number().int(),
  thumbnail: z.string(),
  url: z.string(),
  duration: z.string().nullish(),
  ago: z.string().nullish(),
});
export type BeyTubeVideo = z.infer<typeof BeyTubeVideoSchema>;

/** Vidéo YouTube RPB (rediffusion) — timestamps ISO sur le fil. */
export const YoutubeVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  duration: z.string().nullish(),
  publishedAt: IsoDateSchema,
  viewCount: z.number().int(),
  channelName: z.string().nullish(),
  channelAvatar: z.string().nullish(),
});
export type YoutubeVideo = z.infer<typeof YoutubeVideoSchema>;

/** Info de live Twitch (API tierce, publishedAt/startedAt normalisés ISO). */
export const StreamInfoSchema = z.object({
  isLive: z.boolean(),
  title: z.string().nullish(),
  gameName: z.string().nullish(),
  viewerCount: z.number().int().nullish(),
  startedAt: IsoDateSchema.nullish(),
  thumbnailUrl: z.string().nullish(),
  userName: z.string(),
  avatarUrl: z.string().nullish(),
});
export type StreamInfo = z.infer<typeof StreamInfoSchema>;

/** Clip / VOD Twitch normalisé (publishedAt ISO sur le fil). */
export const TwitchVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  duration: z.string(),
  publishedAt: IsoDateSchema,
  viewCount: z.number().int(),
  channelLogo: z.string().nullish(),
  channelName: z.string().nullish(),
  channelAvatar: z.string().nullish(),
});
export type TwitchVideo = z.infer<typeof TwitchVideoSchema>;

/** Post TikTok normalisé (createTime epoch-seconds tel que renvoyé par l'API). */
export const TikTokVideoSchema = z.object({
  id: z.string(),
  desc: z.string(),
  createTime: z.number(),
  cover: z.string(),
  playUrl: z.string(),
  author: z.object({
    username: z.string(),
    nickname: z.string(),
    avatarThumb: z.string(),
  }),
  stats: z.object({
    playCount: z.number(),
    diggCount: z.number(),
  }),
  url: z.string(),
});
export type TikTokVideo = z.infer<typeof TikTokVideoSchema>;

/** Query du feed BeyTube `/api/v1/stream` (featured = vitrine triée par date). */
export const StreamQuerySchema = z.object({
  channelId: z.string().optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type StreamQuery = z.infer<typeof StreamQuerySchema>;

/** Réponse `/api/v1/stream` — liste de vidéos BeyTube/YouTube de la communauté. */
export const StreamListResponseSchema = z.object({
  videos: z.array(BeyTubeVideoSchema),
});
export type StreamListResponse = z.infer<typeof StreamListResponseSchema>;

/** Agrégat complet du feed RPB TV — consommé par la page `/tv` (RSC). */
export const TvFeedResponseSchema = z.object({
  stream: StreamInfoSchema.nullable(),
  clips: z.array(TwitchVideoSchema),
  rpbVideos: z.array(YoutubeVideoSchema),
  beyTubeVideos: z.array(BeyTubeVideoSchema),
  tikTokVideos: z.array(TikTokVideoSchema),
});
export type TvFeedResponse = z.infer<typeof TvFeedResponseSchema>;
