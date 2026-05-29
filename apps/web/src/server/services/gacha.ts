import "server-only";
import type {
  GachaCardsResponse,
  GachaDropsResponse,
  GachaLeaderboardResponse,
} from "@rpbey/api-contract";
import { isRemote, unwrap } from "@/server/data-source";
import {
  getGachaLeaderboard,
  listGachaCards,
  listGachaDrops,
  type GachaCardsFilter,
} from "@/server/dal/gacha";

/**
 * Service Gacha — orchestre la DAL et porte le seam DAL↔SDK (`isRemote`).
 * N'expose que les LECTURES PUBLIQUES (sans session) consommées par `/api/v1/gacha`.
 * Les mutations authentifiées restent côté actions/routes legacy.
 *
 * Note seam : en mode distant (`isRemote`), on lit via le SDK généré
 * `@rpbey/api-client`. Les fonctions `gachaCards`/`gachaDrops`/`gachaLeaderboard`
 * sont produites par `bun run gen:api` une fois le contrat câblé (lane integration).
 * Tant que la regénération n'a pas eu lieu, l'accès est résolu dynamiquement pour
 * ne pas casser le type-check des autres lanes ; le chemin DAL (VPS) reste statique.
 */

type SdkFn<R> = (opts?: { query?: Record<string, unknown> }) => Promise<R>;

async function sdk<R>(name: string): Promise<SdkFn<R>> {
  const mod = (await import("@rpbey/api-client")) as Record<string, unknown>;
  const fn = mod[name];
  if (typeof fn !== "function") {
    throw new Error(`[services/gacha] SDK function "${name}" introuvable (gen:api requis).`);
  }
  return fn as SdkFn<R>;
}

/** Catalogue public de cartes (filtres + limite). */
export async function getGachaCards(filter: GachaCardsFilter): Promise<GachaCardsResponse> {
  if (isRemote) {
    const gachaCards = await sdk<{
      data?: { ok: boolean; data: GachaCardsResponse };
    }>("gachaCards");
    return unwrap(
      await gachaCards({
        query: {
          rarity: filter.rarity,
          dropId: filter.dropId,
          series: filter.series,
          search: filter.search,
          activeOnly: filter.activeOnly,
          limit: filter.limit,
        },
      }),
    );
  }
  const { cards, total } = await listGachaCards(filter);
  return { cards, total };
}

/** Liste des drops + nombre de cartes par drop. */
export async function getGachaDrops(): Promise<GachaDropsResponse> {
  if (isRemote) {
    const gachaDrops = await sdk<{
      data?: { ok: boolean; data: GachaDropsResponse };
    }>("gachaDrops");
    return unwrap(await gachaDrops());
  }
  const drops = await listGachaDrops();
  return { drops };
}

/** Classement gacha public (par BeyCoins). */
export async function getGachaLeaderboardEntries(
  limit?: number,
): Promise<GachaLeaderboardResponse> {
  if (isRemote) {
    const gachaLeaderboard = await sdk<{
      data?: { ok: boolean; data: GachaLeaderboardResponse };
    }>("gachaLeaderboard");
    return unwrap(await gachaLeaderboard({ query: { limit } }));
  }
  const entries = await getGachaLeaderboard(limit);
  return { entries };
}
