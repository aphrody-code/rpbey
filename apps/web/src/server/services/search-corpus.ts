import "server-only";
import type { RedisClient } from "bun";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import { buildGlobalSearchIndex } from "./global-search";

/**
 * Corpus de recherche unifié, CONSOLIDÉ dans Redis.
 *
 * `buildGlobalSearchIndex()` assemble ~15 sources hétérogènes (catalogue, DB,
 * WBO, X, métagame, frames, staff, pages…) — coûteux à refaire à chaque requête
 * (`force-dynamic`). On consolide le résultat dans **une seule clé Redis**
 * (`rpbey:search:corpus`), source unique servie à tous les conscommateurs, avec
 * deux couches de cache :
 *   1. **in-process** : on renvoie la MÊME référence de tableau pendant 60 s → le
 *      cache BM25F du ranker (`WeakMap` par référence) est réutilisé entre frappes.
 *   2. **Redis** : corpus sérialisé partagé entre process / persistant (TTL 1 h).
 *
 * Tout est best-effort : Redis indisponible ⇒ fallback assemblage live (aucune
 * panne). Le builtin `bun` ne peut PAS être importé statiquement dans le bundle
 * Next (échec « collect page data ») → `Bun.RedisClient` est résolu via le global
 * au runtime (le serveur tourne sous Bun), comme dans `api/events/route.ts`.
 */

const KEY = "rpbey:search:corpus:v1";
const REDIS_TTL_S = 3600; // 1 h
const MEMO_TTL_MS = 60_000; // 60 s

let memo: { items: GlobalSearchItem[]; at: number } | null = null;
let client: RedisClient | null = null;

function redis(): RedisClient | null {
  try {
    const ctor = (
      globalThis as unknown as {
        Bun?: { RedisClient: new (url: string) => RedisClient };
      }
    ).Bun?.RedisClient;
    if (!ctor) return null;
    client ??= new ctor(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
    return client;
  } catch {
    return null;
  }
}

/** Corpus unifié consolidé (Redis read-through + memo in-process, fallback live). */
export async function getSearchCorpus(): Promise<GlobalSearchItem[]> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.items;

  const r = redis();
  if (r) {
    try {
      const cached = await r.get(KEY);
      if (cached) {
        const items = JSON.parse(cached) as GlobalSearchItem[];
        memo = { items, at: Date.now() };
        return items;
      }
    } catch {
      // Redis indisponible / payload corrompu → on reconstruit en live.
    }
  }

  const items = await buildGlobalSearchIndex();
  memo = { items, at: Date.now() };
  if (r) {
    try {
      await r.set(KEY, JSON.stringify(items));
      await r.expire(KEY, REDIS_TTL_S);
    } catch {
      // best-effort : l'absence de consolidation Redis n'est pas fatale.
    }
  }
  return items;
}

/** Invalide le corpus consolidé (à appeler après un refresh de data : X, catalogue…). */
export async function invalidateSearchCorpus(): Promise<void> {
  memo = null;
  const r = redis();
  if (r) {
    try {
      await r.del(KEY);
    } catch {
      // ignore
    }
  }
}
