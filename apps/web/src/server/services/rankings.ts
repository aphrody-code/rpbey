import "server-only";
import type {
  RankingKind,
  RankingsListResponse,
  RankingsQuery,
  RankingStats,
} from "@rpbey/api-contract";
import {
  countSeasonRankings,
  getBladerAggregateStats,
  getRankingLastUpdate,
  listCareerBladers,
  listGlobalRankings,
  listSeasonRankings,
  type SeasonRankingKind,
} from "@/server/dal/rankings";

/**
 * Service classements — assemble la forme contrat `RankingsListResponse`
 * depuis la DAL (lectures DB) + métier (pagination, normalisation ISO).
 * UI-agnostic. Consommé par `/api/v1/rankings` et les RSC marketing.
 *
 * Seam : aucun appel SDK distant ici pour l'instant (les RSC tapent la DAL
 * en co-localisé). Le point de bascule `isRemote`/`unwrap` est introduit dans
 * la route `/api/v1/rankings` si/quand le front passe au SDK.
 */

const SEASON_KINDS: ReadonlySet<RankingKind> = new Set(["satr", "wb", "stardust"]);

function isSeasonKind(kind: RankingKind): kind is SeasonRankingKind {
  return SEASON_KINDS.has(kind);
}

/**
 * Liste un classement selon `kind`/`view`/`season` + pagination.
 * - `global` : leaderboard RPB par points (vue `ranking` implicite).
 * - `satr|wb|stardust` + `view=ranking` : classement de saison.
 * - `satr|wb|stardust` + `view=career` : profils de carrière (bladers).
 */
export async function getRankings(query: RankingsQuery): Promise<RankingsListResponse> {
  const { kind, view, season, search, page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  if (kind === "global") {
    const rows = await listGlobalRankings();
    const items = rows.map((r) => ({
      id: r.id,
      playerName: r.playerName,
      userId: r.userId,
      points: r.points,
      wins: r.wins,
      losses: r.losses,
      tournamentWins: r.tournamentWins,
      tournamentsCount: r.tournamentsCount,
      avatarUrl: r.avatarUrl,
      updatedAt: r.updatedAt,
    }));
    const paged = items.slice(offset, offset + pageSize);
    return {
      kind,
      view: "ranking",
      season: null,
      items: paged,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
      lastUpdate: null,
    };
  }

  if (!isSeasonKind(kind)) {
    return {
      kind,
      view,
      season: season ?? null,
      items: [],
      total: 0,
      totalPages: 0,
      lastUpdate: null,
    };
  }

  // Stardust n'a pas de saison ; les autres défaut sur la saison courante (2).
  const effectiveSeason = kind === "stardust" ? null : (season ?? 2);

  if (view === "career") {
    const { items, total } = await listCareerBladers({
      kind,
      search,
      limit: pageSize,
      offset,
    });
    const lastUpdate = await getRankingLastUpdate(kind);
    return {
      kind,
      view,
      season: effectiveSeason,
      items,
      total,
      totalPages: Math.ceil(total / pageSize),
      lastUpdate,
    };
  }

  const { items, total } = await listSeasonRankings({
    kind,
    season: effectiveSeason ?? undefined,
    search,
    limit: pageSize,
    offset,
  });
  const lastUpdate = await getRankingLastUpdate(kind);
  return {
    kind,
    view,
    season: effectiveSeason,
    items,
    total,
    totalPages: Math.ceil(total / pageSize),
    lastUpdate,
  };
}

/** Stats agrégées d'une famille de saison (totaux carrière + tournois/participants). */
export async function getRankingStats(
  kind: SeasonRankingKind,
  seasonMeta: { tournamentCount: number; uniqueParticipants: number },
): Promise<RankingStats> {
  const { totalBladers, totalMatches } = await getBladerAggregateStats(kind);
  return {
    totalBladers,
    totalMatches,
    tournamentCount: seasonMeta.tournamentCount,
    uniqueParticipants: seasonMeta.uniqueParticipants,
  };
}

/** Compte d'entrées de saison (admin) — délègue à la DAL. */
export async function getSeasonRankingCount(kind: SeasonRankingKind) {
  return countSeasonRankings(kind);
}
