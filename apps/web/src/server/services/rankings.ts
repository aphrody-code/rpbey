import "server-only";
import { getRankings as sdkGetRankings } from "@rpbey/api-client";
import type {
  RankingKind,
  RankingsListResponse,
  RankingsQuery,
  RankingStats,
} from "@rpbey/api-contract";
import { loadJsonSafe } from "@/lib/data-cache";
import {
  computeRankings,
  type EnrichedRankingEntry,
  type MapperEntry,
} from "@/lib/ranking-recompute";
import { isRemote, unwrap } from "@/server/data-source";
import {
  countSeasonRankings,
  getBladerAggregateStats,
  getOrCreateRankingSystem,
  getRankingLastUpdate,
  listAdjustmentUserProfiles,
  listAllPointAdjustments,
  listCareerBladers,
  listGlobalRankings,
  listSeasonRankings,
  listTournamentsForRecalc,
  listUsersForRankingLink,
  rebuildGlobalRankings,
  type SeasonRankingKind,
} from "@/server/dal/rankings";

/**
 * Tournois BTS importés en DB ET déjà pré-agrégés dans le JSON enrichi.
 *
 * ⚠️ Exclus du calcul DB UNIQUEMENT si le JSON enrichi est réellement chargé — sinon on
 * supprimerait ~354 participants réels (les BTS sont désormais des tournois COMPLETE en
 * base). Le JSON `recalculated_ranking_s2_enriched.json` étant un artefact transitoire
 * (gitignored, absent en prod), la voie par défaut agrège DIRECTEMENT les BTS depuis la
 * DB. L'exclusion ne se réactive que si quelqu'un régénère cet enrichi (anti double-compte).
 */
const BTS_EXCLUDE_IDS = [
  "bts1",
  "bts2",
  "bts3",
  "bts4",
  "bts5",
  "cm-fr_b_ts2-auto",
  "cm-fr_b_ts3-auto",
  "cmoq5x3yc000009ro7zq1i3uj", // BTS1
  "cmoq5x49a005r09rosc122fr1", // BTS2
  "cmoq5x4fo00aq09roq2og3ihk", // BTS3
  "cmnukkwyt0000z4ro9fvkcko6", // BTS4
  "cmp019bpax2u1m5idwluippk0", // BTS5
];

/**
 * Recalcul COMPLET du classement global — UNIQUE source de vérité serveur.
 *
 * Charge tout (config, saison, tournois COMPLETE/ARCHIVED/UNDERWAY, ajustements,
 * identités users, JSON BTS) via la DAL, agrège via la fonction PURE `computeRankings`
 * (qui combine les stats de chaque joueur dans chaque tournoi + liaison nom→compte),
 * puis réécrit `global_rankings` + miroir `profiles` (inscrits ET non-inscrits) via
 * `rebuildGlobalRankings`. Idempotent (rebuild = reset+reinsert transactionnel).
 *
 * Appelé par : `recalculateRankings` (action admin), `RankingService.recalculateAll`
 * (wrapper), `/api/admin/ranking` PUT, l'auto-sync post-tournoi et le script CLI.
 */
export async function runFullRecalculation(): Promise<{
  playersRanked: number;
  linkedToUser: number;
}> {
  const config = await getOrCreateRankingSystem();

  let mapper: Record<string, MapperEntry> = {};
  let enrichedData: EnrichedRankingEntry[] = [];
  try {
    // Sur Vercel : fetch CDN (cdn.rpbey.fr). Sur VPS : lecture FS directe.
    const [mapperData, enriched] = await Promise.all([
      loadJsonSafe<typeof mapper>("data/exports/participants_map.json"),
      loadJsonSafe<EnrichedRankingEntry[]>("data/exports/recalculated_ranking_s2_enriched.json"),
    ]);
    if (mapperData) mapper = mapperData;
    if (enriched) enrichedData = enriched;
  } catch {
    // Fichiers JSON BTS indisponibles → on continue avec la DB seule.
  }

  // N'exclure les BTS de la DB QUE si l'enrichi BTS est réellement présent (anti
  // double-compte) ; sinon agréger TOUS les tournois en base (cas par défaut prod).
  // Pas de `startDate` : leaderboard global = ALL-TIME (cross-saison).
  const excludeIds = enrichedData.length > 0 ? BTS_EXCLUDE_IDS : [];
  const [tournaments, adjustments, userLinks] = await Promise.all([
    listTournamentsForRecalc({ excludeIds }),
    listAllPointAdjustments(),
    listUsersForRankingLink(),
  ]);
  const adjustmentProfiles = await listAdjustmentUserProfiles(adjustments.map((a) => a.userId));

  const { rankings, linkedCount } = computeRankings({
    tournaments,
    config,
    adjustments,
    adjustmentProfiles,
    mapper,
    enrichedData,
    userLinks,
  });

  await rebuildGlobalRankings(rankings);

  return { playersRanked: rankings.length, linkedToUser: linkedCount };
}

/**
 * Service classements — assemble la forme contrat `RankingsListResponse`
 * depuis la DAL (lectures DB) + métier (pagination, normalisation ISO).
 * UI-agnostic. Consommé par `/api/v1/rankings` et les RSC marketing.
 *
 * Seam : `getRankings` bascule sur le SDK généré en mode standalone (`isRemote`,
 * `API_BASE` défini) ; en co-localisé (VPS) le chemin DAL ci-dessous reste
 * inchangé. La forme contrat `RankingsListResponse` est identique des deux côtés.
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

  // Standalone (Vercel) : la liste est servie par l'API distante via le SDK généré.
  if (isRemote) {
    return unwrap(
      await sdkGetRankings({
        query: {
          kind,
          view,
          season: season ?? undefined,
          search,
          page,
          pageSize,
        },
      }),
    );
  }

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
