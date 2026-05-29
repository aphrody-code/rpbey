import "server-only";
import { and, asc, db, desc, eq, gt, ilike, schema as t } from "@/lib/db";
import {
  getGachaLeaderboard,
  getGachaProfile,
  listGachaCards,
  listGachaDrops,
} from "@/server/dal/gacha";
import type { CardRarity } from "@/lib/types";

/**
 * DAL du endpoint GraphQL (Phase 3 — API-first).
 *
 * UNIQUE puits DB du domaine `graphql` : les resolvers de `app/api/graphql/schema.ts`
 * consomment ces fonctions (formes spécifiques au SDL : remap beyblade blade/ratchet/bit,
 * tournament category + participantCount) sans jamais importer `@rpbey/db` / `@/lib/db`
 * en direct. Le SDL reste inchangé.
 *
 * Placé sous `server/dal/` (puits canonique reconnu par check-dal-boundary) — sert
 * EXCLUSIVEMENT le GraphQL : les tables `globalRankings` / `rankingSeasons` /
 * `seasonEntries` / `beyblades` n'ont pas de fonction DAL équivalente côté REST, d'où la
 * mono-propriété de ce fichier (le flip `ENFORCED=["src/"]` pourra ainsi couvrir graphql).
 *
 * Invariant timestamp : `globalRankings` / `rankingSeasons` / `seasonEntries` /
 * `beyblades` sont toutes `mode:"string"` (ISO) — aucune table auth ici, jamais d'objet
 * `Date` à manipuler.
 */

// ── Rankings (globalRankings) ────────────────────────────────────────────────

const MAX_RANKINGS = 100;
const MAX_SEARCH = 25;

/** Top bladers du classement global (points > 0), paginé. */
export function listGlobalRankings(limit: number, offset: number) {
  return db.query.globalRankings.findMany({
    where: gt(t.globalRankings.points, 0),
    orderBy: [desc(t.globalRankings.points), desc(t.globalRankings.wins)],
    limit: Math.min(limit, MAX_RANKINGS),
    offset,
  });
}

/** Un blader du classement global par nom exact. */
export function getGlobalRankingByName(name: string) {
  return db.query.globalRankings.findFirst({
    where: eq(t.globalRankings.playerName, name),
  });
}

/** Recherche de bladers du classement global (nom contient `query`, points > 0). */
export function searchGlobalRankings(query: string, limit: number) {
  return db.query.globalRankings.findMany({
    where: and(ilike(t.globalRankings.playerName, `%${query}%`), gt(t.globalRankings.points, 0)),
    orderBy: desc(t.globalRankings.points),
    limit: Math.min(limit, MAX_SEARCH),
  });
}

// ── Saisons (rankingSeasons / seasonEntries) ─────────────────────────────────

/** Toutes les saisons de classement (récentes d'abord). */
export function listSeasons() {
  return db.query.rankingSeasons.findMany({
    orderBy: desc(t.rankingSeasons.startDate),
  });
}

/** Une saison par slug. */
export function getSeasonBySlug(slug: string) {
  return db.query.rankingSeasons.findFirst({
    where: eq(t.rankingSeasons.slug, slug),
  });
}

const MAX_SEASON_ENTRIES = 100;

/** Entrées (joueurs) d'une saison, triées par points, paginées. */
export function listSeasonEntries(seasonId: string, limit: number, offset: number) {
  return db.query.seasonEntries.findMany({
    where: eq(t.seasonEntries.seasonId, seasonId),
    orderBy: desc(t.seasonEntries.points),
    limit: Math.min(limit, MAX_SEASON_ENTRIES),
    offset,
  });
}

// ── Parts ────────────────────────────────────────────────────────────────────

const MAX_PARTS = 200;

/** Liste des pièces, optionnellement filtrée par type, paginée. */
export function listParts(type: string | undefined, limit: number, offset: number) {
  return db.query.parts.findMany({
    where: type ? eq(t.parts.type, type as never) : undefined,
    orderBy: asc(t.parts.name),
    limit: Math.min(limit, MAX_PARTS),
    offset,
  });
}

/** Une pièce par externalId. */
export function getPartByExternalId(externalId: string) {
  return db.query.parts.findFirst({
    where: eq(t.parts.externalId, externalId),
  });
}

// ── Beyblades (combos pré-construits + leurs 3 pièces) ────────────────────────

const MAX_BEYBLADES = 200;

type RawBeyblade = NonNullable<Awaited<ReturnType<typeof getBeybladeRowByCode>>>;
/** Forme exposée au resolver : combo + ses 3 pièces remappées (blade/ratchet/bit). */
export type GraphqlBeyblade = Omit<
  RawBeyblade,
  "part_bladeId" | "part_ratchetId" | "part_bitId"
> & {
  blade: RawBeyblade["part_bladeId"];
  ratchet: RawBeyblade["part_ratchetId"];
  bit: RawBeyblade["part_bitId"];
};

function getBeybladeRowByCode(code: string) {
  return db.query.beyblades.findFirst({
    where: eq(t.beyblades.code, code),
    with: { part_bladeId: true, part_ratchetId: true, part_bitId: true },
  });
}

function remapBeyblade(b: RawBeyblade): GraphqlBeyblade {
  const { part_bladeId, part_ratchetId, part_bitId, ...rest } = b;
  return {
    ...rest,
    blade: part_bladeId,
    ratchet: part_ratchetId,
    bit: part_bitId,
  };
}

/** Liste de beyblades (combos) avec leurs pièces, paginée. */
export async function listBeyblades(limit: number, offset: number): Promise<GraphqlBeyblade[]> {
  const rows = await db.query.beyblades.findMany({
    with: { part_bladeId: true, part_ratchetId: true, part_bitId: true },
    orderBy: asc(t.beyblades.name),
    limit: Math.min(limit, MAX_BEYBLADES),
    offset,
  });
  return rows.map(remapBeyblade);
}

/** Un beyblade par code, avec ses pièces. */
export async function getBeybladeByCode(code: string): Promise<GraphqlBeyblade | null> {
  const b = await getBeybladeRowByCode(code);
  return b ? remapBeyblade(b) : null;
}

// ── Tournaments (lecture relationnelle propre au GraphQL) ─────────────────────

const MAX_TOURNAMENTS = 50;

type RawTournament = NonNullable<Awaited<ReturnType<typeof getTournamentRowById>>>;
/** Forme resolver : tournoi + catégorie remappée + compteur de participants. */
export type GraphqlTournament = Omit<
  RawTournament,
  "tournamentCategory" | "tournamentParticipants"
> & {
  category: RawTournament["tournamentCategory"];
  participantCount: number;
};

function getTournamentRowById(id: string) {
  return db.query.tournaments.findFirst({
    where: eq(t.tournaments.id, id),
    with: {
      tournamentCategory: true,
      tournamentParticipants: { columns: { id: true } },
    },
  });
}

function remapTournament(tr: RawTournament): GraphqlTournament {
  const { tournamentCategory, tournamentParticipants, ...rest } = tr;
  return {
    ...rest,
    category: tournamentCategory,
    participantCount: tournamentParticipants.length,
  };
}

/** Tournois (optionnellement filtrés par statut), récents d'abord, paginés. */
export async function listTournaments(
  status: string | undefined,
  limit: number,
  offset: number,
): Promise<GraphqlTournament[]> {
  const rows = await db.query.tournaments.findMany({
    where: status ? eq(t.tournaments.status, status as never) : undefined,
    with: {
      tournamentCategory: true,
      tournamentParticipants: { columns: { id: true } },
    },
    orderBy: desc(t.tournaments.date),
    limit: Math.min(limit, MAX_TOURNAMENTS),
    offset,
  });
  return rows.map(remapTournament);
}

/** Un tournoi par id, avec catégorie + compteur. */
export async function getTournamentById(id: string): Promise<GraphqlTournament | null> {
  const tr = await getTournamentRowById(id);
  return tr ? remapTournament(tr) : null;
}

// ── Profile (public, colonnes restreintes) ───────────────────────────────────

/** Profil public d'un blader par userId (colonnes user limitées au SDL `PublicUser`). */
export function getProfileByUserId(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(t.profiles.userId, userId),
    with: {
      user: {
        columns: { id: true, name: true, image: true, discordTag: true },
      },
    },
  });
}

// ── Anime ─────────────────────────────────────────────────────────────────────

/** Séries d'anime publiées (génération puis ordre de tri). */
export function listPublishedAnimeSeries() {
  return db.query.animeSeries.findMany({
    where: eq(t.animeSeries.isPublished, true),
    orderBy: [asc(t.animeSeries.generation), asc(t.animeSeries.sortOrder)],
  });
}

// ── Gacha (cartes / drops / leaderboard / profil) ─────────────────────────────
// Réutilise les puits DAL gacha (server/dal/gacha) — pas de requête DB dupliquée.
// Ces wrappers existent pour que les resolvers GraphQL n'importent QUE ce module.

const MAX_GACHA_CARDS = 200;

/** Cartes gacha actives, filtrables (rareté/drop/série/recherche). */
export async function gqlGachaCards(args: {
  rarity?: string;
  dropId?: string;
  series?: string;
  search?: string;
  limit: number;
}) {
  const { cards } = await listGachaCards({
    // `rarity` provient de l'enum SDL `GachaRarity` (validé par GraphQL) →
    // toujours une `CardRarity` valide à l'exécution.
    rarity: args.rarity as CardRarity | undefined,
    dropId: args.dropId,
    series: args.series,
    search: args.search,
    activeOnly: true,
    limit: Math.min(args.limit, MAX_GACHA_CARDS),
  });
  return cards;
}

/** Collections (drops) gacha + compteur de cartes. */
export function gqlGachaDrops() {
  return listGachaDrops();
}

/** Classement gacha (BeyCoins / collection / duels). */
export function gqlGachaLeaderboard(limit: number) {
  return getGachaLeaderboard(Math.min(limit, 100));
}

/** Profil gacha public d'un joueur (currency, streak, duels, nb de cartes). */
export function gqlGachaProfile(userId: string) {
  return getGachaProfile(userId);
}
