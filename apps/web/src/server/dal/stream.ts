import "server-only";
import { and, asc, db, desc, eq, gte, ilike, or, schema } from "@/lib/db";

/**
 * Data Access Layer — stream / média (RPB TV).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Sources : table `youtubeVideos` (BeyTube / rediffusions RPB) et lectures de
 * tournois (`tournaments` / `tournamentMatches` / `tournamentParticipants`) pour
 * l'endpoint TSH `/api/stream/:id`. Tous les timestamps sont `mode:"string"` (ISO).
 */

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

export interface RpbYoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
  viewCount: number;
  channelName: string;
  channelAvatar: string | null;
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

/** Vidéos BeyTube mises en avant (table `youtubeVideos`, isFeatured). */
export async function getBeyTubeFeatured(limit = 20): Promise<BeyTubeVideo[]> {
  try {
    const videos = await db.query.youtubeVideos.findMany({
      where: eq(schema.youtubeVideos.isFeatured, true),
      orderBy: desc(schema.youtubeVideos.publishedAt),
      limit,
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
      // publishedAt est mode:"string" (ISO) — wrap via `new Date(...)` avant calcul.
      ago: formatTimeAgo(new Date(v.publishedAt)),
    }));
  } catch (e) {
    console.error("[stream/dal] BeyTube DB error:", e);
    return [];
  }
}

/** Rediffusions RPB : vidéos YouTube d'une chaîne donnée (page /tv). */
export async function getRpbYoutubeVideos(
  channelId: string,
  limit = 20,
): Promise<RpbYoutubeVideo[]> {
  try {
    const vids = await db.query.youtubeVideos.findMany({
      where: eq(schema.youtubeVideos.channelId, channelId),
      orderBy: desc(schema.youtubeVideos.publishedAt),
      limit,
    });
    return vids.map((v) => ({
      id: v.id,
      title: v.title,
      url: v.url,
      thumbnailUrl: v.thumbnail,
      duration: v.duration,
      // publishedAt est mode:"string" (ISO) — déjà au format attendu par le contrat.
      publishedAt: v.publishedAt,
      viewCount: v.views,
      channelName: v.channelName,
      channelAvatar: v.channelAvatar,
    }));
  } catch (e) {
    console.error("[stream/dal] RPB YouTube DB error:", e);
    return [];
  }
}

// ─── Lectures tournois pour l'endpoint TSH `/api/stream/:id` ─────────────────

/** Tournois diffusables : UNDERWAY / CHECKIN, ou COMPLETE des dernières 24 h. */
export async function listStreamableTournaments() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return db.query.tournaments.findMany({
    where: or(
      eq(schema.tournaments.status, "UNDERWAY"),
      eq(schema.tournaments.status, "CHECKIN"),
      and(eq(schema.tournaments.status, "COMPLETE"), gte(schema.tournaments.updatedAt, oneDayAgo)),
    ),
    columns: {
      id: true,
      name: true,
      status: true,
      format: true,
      date: true,
      location: true,
      challongeUrl: true,
      updatedAt: true,
    },
    with: {
      tournamentParticipants: { columns: { id: true } },
      tournamentMatches: { columns: { id: true } },
    },
    orderBy: desc(schema.tournaments.updatedAt),
  });
}

/** Tournoi + participants + matchs (résolu par id, challongeId ou URL) pour TSH. */
export async function getTournamentForStream(id: string) {
  return db.query.tournaments.findFirst({
    where: or(
      eq(schema.tournaments.id, id),
      eq(schema.tournaments.challongeId, id),
      ilike(schema.tournaments.challongeUrl, `%${id}%`),
    ),
    with: {
      tournamentParticipants: {
        with: { user: { with: { profiles: true } } },
        orderBy: [
          asc(schema.tournamentParticipants.finalPlacement),
          asc(schema.tournamentParticipants.seed),
        ],
      },
      tournamentMatches: {
        with: {
          user_player1Id: { with: { profiles: true } },
          user_player2Id: { with: { profiles: true } },
          user_winnerId: { with: { profiles: true } },
        },
        orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
      },
    },
  });
}
