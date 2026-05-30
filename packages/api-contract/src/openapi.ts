import { z } from "zod";
import {
  RecommendQuerySchema,
  RecommendResponseSchema,
  SearchQuerySchema,
  SearchResponseSchema,
} from "./comparateur";
import { MetaResponseSchema } from "./meta";
import { PartsQuerySchema, PartsListResponseSchema } from "./parts";
import { RankingsQuerySchema, RankingsListResponseSchema } from "./rankings";
import {
  PublicUserResponseSchema,
  UserMatchesQuerySchema,
  UserMatchesResponseSchema,
} from "./users";
import {
  TournamentDetailResponseSchema,
  TournamentsListResponseSchema,
  TournamentsQuerySchema,
} from "./tournaments";
import { StreamListResponseSchema, StreamQuerySchema } from "./stream";
import {
  AnimeFramesQuerySchema,
  AnimeFramesResponseSchema,
  AnimeListQuerySchema,
  AnimeSearchQuerySchema,
  AnimeSearchResponseSchema,
  AnimeSeriesByGenerationResponseSchema,
  AnimeSeriesDetailResponseSchema,
  AnimeSeriesListResponseSchema,
} from "./anime";
import { ContentBlockListResponseSchema, ContentQuerySchema, StaffListResponseSchema } from "./cms";
import { AnalyticsTrackInputSchema, AnalyticsTrackResponseSchema } from "./analytics";
import { DeckQuerySchema, DeckResponseSchema } from "./decks";
import {
  GachaCardsQuerySchema,
  GachaCardsResponseSchema,
  GachaDropsResponseSchema,
  GachaLeaderboardQuerySchema,
  GachaLeaderboardResponseSchema,
} from "./gacha";
import {
  BotCommandsResponseSchema,
  BotLogsQuerySchema,
  BotLogsResponseSchema,
  BotStatusResponseSchema,
} from "./bot";
import {
  ModerationSummarySchema,
  WarningCountQuerySchema,
  WarningCountResponseSchema,
} from "./moderation";
import {
  TeamsListQuerySchema,
  TeamsListResponseSchema,
  TeamDetailResponseSchema,
  TeamMembersResponseSchema,
  TeamLeaderboardQuerySchema,
  TeamLeaderboardResponseSchema,
} from "./teams";
import {
  PollsListQuerySchema,
  PollsListResponseSchema,
  PollDetailResponseSchema,
  TierListsListQuerySchema,
  TierListsListResponseSchema,
  TierListDetailResponseSchema,
  AwardsEditionsResponseSchema,
} from "./polls";
import { ErrorEnvelopeSchema, okEnvelope } from "./envelope";

/**
 * Registre de routes minimaliste → document OpenAPI 3.1.
 * Source de vérité = schémas Zod (v4 `z.toJSONSchema`). Aucune dépendance externe.
 * Consommé par `@hey-api/openapi-ts` pour générer le SDK typé.
 */
export interface RouteDef {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string; // ex. "/recommend", "/users/{id}"
  operationId: string;
  summary: string;
  tags: string[];
  query?: z.ZodObject;
  /** Paramètres de chemin (ex. `id` pour `/users/{id}`) — tous typés `string`. */
  pathParams?: string[];
  body?: z.ZodType;
  /** Schéma du payload (hors enveloppe) ; enveloppé en `{ ok, data }`. */
  response: z.ZodType;
}

type JsonSchema = Record<string, unknown>;

function toSchema(s: z.ZodType, io: "input" | "output" = "output"): JsonSchema {
  const out = z.toJSONSchema(s, {
    target: "draft-2020-12",
    io,
    // coerce/transform (ex. availableOnly, poids coercés) non représentables :
    // émettre un schéma permissif plutôt que de throw.
    unrepresentable: "any",
  }) as JsonSchema;
  delete out.$schema; // composants OpenAPI 3.1 = JSON Schema 2020-12 sans $schema
  return out;
}

function queryParameters(schema: z.ZodObject): JsonSchema[] {
  const json = toSchema(schema, "input") as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([name, propSchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: propSchema,
  }));
}

const ROUTES: RouteDef[] = [
  {
    method: "get",
    path: "/recommend",
    operationId: "getRecommendations",
    summary: "Recommandations produits pondérées (méta-relevance / hype / prix).",
    tags: ["comparateur"],
    query: RecommendQuerySchema,
    response: RecommendResponseSchema,
  },
  {
    method: "get",
    path: "/search",
    operationId: "globalSearch",
    summary:
      "Recherche globale Beyblade toutes saisons (produits, beys, pièces, combos, tournois, bladers, anime, lexique, sites). `q` absent = index complet ; sinon classement BM25F + facettes.",
    tags: ["comparateur"],
    query: SearchQuerySchema,
    response: SearchResponseSchema,
  },
  {
    method: "get",
    path: "/meta",
    operationId: "getMeta",
    summary:
      "Méta-analyse hebdomadaire des pièces Beyblade X (tournois WBO), enrichie stats/images.",
    tags: ["meta"],
    response: MetaResponseSchema,
  },
  {
    method: "get",
    path: "/parts",
    operationId: "listParts",
    summary: "Catalogue public des pièces Beyblade X (filtres + pagination).",
    tags: ["parts"],
    query: PartsQuerySchema,
    response: PartsListResponseSchema,
  },
  {
    method: "get",
    path: "/rankings",
    operationId: "getRankings",
    summary:
      "Classements RPB (SATR / Wild Breakers / Stardust par saison ou carrière, ou leaderboard global pondéré).",
    tags: ["rankings"],
    query: RankingsQuerySchema,
    response: RankingsListResponseSchema,
  },
  {
    method: "get",
    path: "/users/{id}",
    operationId: "getPublicUser",
    summary: "Profil joueur public (compte + profil agrégé) par identifiant.",
    tags: ["users"],
    pathParams: ["id"],
    response: PublicUserResponseSchema,
  },
  {
    method: "get",
    path: "/users/{id}/matches",
    operationId: "getUserMatches",
    summary: "Historique de matchs paginé d'un joueur.",
    tags: ["users"],
    pathParams: ["id"],
    query: UserMatchesQuerySchema,
    response: UserMatchesResponseSchema,
  },
  {
    method: "get",
    path: "/tournaments",
    operationId: "listTournaments",
    summary:
      "Liste publique des tournois RPB (cartes avec catégorie + compteurs), filtrable par statut et paginable.",
    tags: ["tournaments"],
    query: TournamentsQuerySchema,
    response: TournamentsListResponseSchema,
  },
  {
    method: "get",
    path: "/tournaments/{id}",
    operationId: "getTournament",
    summary: "Détail d'un tournoi (ligne + participants + matches) par id, challongeId ou slug.",
    tags: ["tournaments"],
    pathParams: ["id"],
    response: TournamentDetailResponseSchema,
  },
  {
    method: "get",
    path: "/stream",
    operationId: "listStreamVideos",
    summary: "Feed BeyTube de la communauté (vidéos mises en avant, triées par date).",
    tags: ["stream"],
    query: StreamQuerySchema,
    response: StreamListResponseSchema,
  },
  {
    method: "get",
    path: "/anime",
    operationId: "listAnimeSeries",
    summary:
      "Séries d'anime Beyblade publiées (lecture publique), filtrables par génération et `featured`.",
    tags: ["anime"],
    query: AnimeListQuerySchema,
    response: AnimeSeriesListResponseSchema,
  },
  {
    method: "get",
    path: "/anime/by-generation",
    operationId: "listAnimeSeriesByGeneration",
    summary: "Séries d'anime regroupées par génération (ORIGINAL / METAL / BURST / X).",
    tags: ["anime"],
    response: AnimeSeriesByGenerationResponseSchema,
  },
  {
    method: "get",
    path: "/anime/search",
    operationId: "searchAnime",
    summary: "Recherche de séries et épisodes d'anime publiés par texte libre.",
    tags: ["anime"],
    query: AnimeSearchQuerySchema,
    response: AnimeSearchResponseSchema,
  },
  {
    method: "get",
    path: "/anime/frames",
    operationId: "listAnimeFrames",
    summary:
      "Galerie publique de frames d'anime (captures), filtrable par série, épisode, personnage, « marquant » ou recherche libre. Pagination par curseur.",
    tags: ["anime"],
    query: AnimeFramesQuerySchema,
    response: AnimeFramesResponseSchema,
  },
  {
    method: "get",
    path: "/anime/{slug}",
    operationId: "getAnimeSeries",
    summary: "Détail d'une série d'anime par slug (épisodes publiés + sources actives).",
    tags: ["anime"],
    pathParams: ["slug"],
    response: AnimeSeriesDetailResponseSchema,
  },
  {
    method: "get",
    path: "/cms/content",
    operationId: "listContentBlocks",
    summary: "Blocs de contenu éditorial (lecture publique) ; `?slug=` filtre sur un bloc précis.",
    tags: ["cms"],
    query: ContentQuerySchema,
    response: ContentBlockListResponseSchema,
  },
  {
    method: "get",
    path: "/cms/staff",
    operationId: "listStaffMembers",
    summary: "Membres du staff actifs (page « notre équipe »).",
    tags: ["cms"],
    response: StaffListResponseSchema,
  },
  {
    method: "get",
    path: "/decks",
    operationId: "getSharedDeck",
    summary: "Lecture publique d'un deck partageable par identifiant (`?id=`), read-only.",
    tags: ["decks"],
    query: DeckQuerySchema,
    response: DeckResponseSchema,
  },
  {
    method: "post",
    path: "/analytics",
    operationId: "trackAnalyticsEvent",
    summary:
      "Ingestion publique anonyme d'un événement analytics (pageview / événement métier), best-effort.",
    tags: ["analytics"],
    body: AnalyticsTrackInputSchema,
    response: AnalyticsTrackResponseSchema,
  },
  {
    method: "get",
    path: "/gacha/cards",
    operationId: "gachaCards",
    summary: "Catalogue public des cartes gacha TCG (filtres rareté/série/drop + recherche).",
    tags: ["gacha"],
    query: GachaCardsQuerySchema,
    response: GachaCardsResponseSchema,
  },
  {
    method: "get",
    path: "/gacha/drops",
    operationId: "gachaDrops",
    summary: "Collections (drops) gacha saisonnières publiques, avec compteur de cartes.",
    tags: ["gacha"],
    response: GachaDropsResponseSchema,
  },
  {
    method: "get",
    path: "/gacha/leaderboard",
    operationId: "gachaLeaderboard",
    summary: "Classement public gacha (BeyCoins / collection / duels), paginable.",
    tags: ["gacha"],
    query: GachaLeaderboardQuerySchema,
    response: GachaLeaderboardResponseSchema,
  },
  {
    method: "get",
    path: "/bot/status",
    operationId: "botStatus",
    summary: "Statut du bot Discord (proxy server-to-server `:3001`) ; `null` si injoignable.",
    tags: ["bot"],
    response: BotStatusResponseSchema,
  },
  {
    method: "get",
    path: "/bot/logs",
    operationId: "botLogs",
    summary: "Derniers logs du bot Discord (`tail` borné 1..2000, curseur ISO `since` optionnel).",
    tags: ["bot"],
    query: BotLogsQuerySchema,
    response: BotLogsResponseSchema,
  },
  {
    method: "get",
    path: "/bot/commands",
    operationId: "botCommands",
    summary: "Commandes applicatives enregistrées par le bot Discord.",
    tags: ["bot"],
    response: BotCommandsResponseSchema,
  },
  {
    method: "get",
    path: "/moderation/summary",
    operationId: "moderationSummary",
    summary:
      "Cliché agrégé ANONYMISÉ de la modération (warnings/tickets/reminders, distributions).",
    tags: ["moderation"],
    response: ModerationSummarySchema,
  },
  {
    method: "get",
    path: "/moderation/warnings/count",
    operationId: "moderationWarningCount",
    summary: "Compteur de warnings d'un membre Discord (`discordId`), sans PII.",
    tags: ["moderation"],
    query: WarningCountQuerySchema,
    response: WarningCountResponseSchema,
  },
  {
    method: "get",
    path: "/teams",
    operationId: "listTeams",
    summary:
      "Annuaire public des équipes communautaires (clans) — recherche, filtre région/recrutement, tri (points/membres/récent/victoires), paginé.",
    tags: ["teams"],
    query: TeamsListQuerySchema,
    response: TeamsListResponseSchema,
  },
  {
    method: "get",
    path: "/teams/leaderboard",
    operationId: "teamsLeaderboard",
    summary: "Classement des équipes par points cumulés (membres agrégés).",
    tags: ["teams"],
    query: TeamLeaderboardQuerySchema,
    response: TeamLeaderboardResponseSchema,
  },
  {
    method: "get",
    path: "/teams/{slug}",
    operationId: "getTeam",
    summary: "Détail public d'une équipe par slug (profil + membres + stats agrégées).",
    tags: ["teams"],
    pathParams: ["slug"],
    response: TeamDetailResponseSchema,
  },
  {
    method: "get",
    path: "/teams/{slug}/members",
    operationId: "getTeamMembers",
    summary: "Roster d'une équipe (membres + rôles + stats compétitives).",
    tags: ["teams"],
    pathParams: ["slug"],
    response: TeamMembersResponseSchema,
  },
  {
    method: "get",
    path: "/polls",
    operationId: "listPolls",
    summary: "Sondages communautaires publics (filtres catégorie/saison/featured, paginé).",
    tags: ["polls"],
    query: PollsListQuerySchema,
    response: PollsListResponseSchema,
  },
  {
    method: "get",
    path: "/polls/{slug}",
    operationId: "getPoll",
    summary: "Détail d'un sondage par slug (options + résultats agrégés + votes du visiteur).",
    tags: ["polls"],
    pathParams: ["slug"],
    response: PollDetailResponseSchema,
  },
  {
    method: "get",
    path: "/tier-lists",
    operationId: "listTierLists",
    summary: "Tier lists communautaires publiques (filtres type/saison/featured, paginé).",
    tags: ["polls"],
    query: TierListsListQuerySchema,
    response: TierListsListResponseSchema,
  },
  {
    method: "get",
    path: "/tier-lists/{slug}",
    operationId: "getTierList",
    summary: "Détail d'une tier list (sujets + tier communautaire agrégé + placement du visiteur).",
    tags: ["polls"],
    pathParams: ["slug"],
    response: TierListDetailResponseSchema,
  },
  {
    method: "get",
    path: "/awards",
    operationId: "listAwardsEditions",
    summary: "Éditions publiées des Beyblade Awards (vidéo de résultats + catégories).",
    tags: ["polls"],
    response: AwardsEditionsResponseSchema,
  },
];

export function listRoutes(): readonly RouteDef[] {
  return ROUTES;
}

const BASE_PATH = "/api/v1";

export interface OpenApiOptions {
  servers?: Array<{ url: string; description?: string }>;
}

/** Assemble le document OpenAPI 3.1 complet de la surface `/api/v1`. */
export function buildOpenApiDocument(opts: OpenApiOptions = {}) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of ROUTES) {
    const fullPath = `${BASE_PATH}${r.path}`;
    const op: Record<string, unknown> = {
      operationId: r.operationId,
      summary: r.summary,
      tags: r.tags,
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": { schema: toSchema(okEnvelope(r.response)) },
          },
        },
        "4XX": {
          description: "Erreur de requête ou de validation",
          content: {
            "application/json": { schema: toSchema(ErrorEnvelopeSchema) },
          },
        },
        "5XX": {
          description: "Erreur serveur",
          content: {
            "application/json": { schema: toSchema(ErrorEnvelopeSchema) },
          },
        },
      },
    };
    const parameters: JsonSchema[] = [];
    if (r.pathParams) {
      for (const name of r.pathParams) {
        parameters.push({
          name,
          in: "path",
          required: true,
          schema: { type: "string" },
        });
      }
    }
    if (r.query) parameters.push(...queryParameters(r.query));
    if (parameters.length > 0) op.parameters = parameters;
    if (r.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: toSchema(r.body) } },
      };
    }
    paths[fullPath] ??= {};
    paths[fullPath][r.method] = op;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "RPBey API",
      version: "1.0.0",
      description:
        "Surface REST versionnée de rpbey.fr — contrat source de vérité (Zod). Consommée par le SDK généré (@rpbey/api-client).",
    },
    servers: opts.servers ?? [{ url: "https://rpbey.fr" }],
    paths,
  };
}
