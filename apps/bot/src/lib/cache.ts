import { logger } from "./logger.js";

/**
 * Cache générique in-process pour le bot (lectures chaudes + rendus canvas).
 *
 * Sur Cloud Run le bot est un singleton (min=1 / max=1) : une seule instance →
 * un cache mémoire local suffit, plus aucun Redis. Les valeurs sont stockées dans
 * une `Map` avec TTL (expiration paresseuse à la lecture + balayage périodique).
 * Le cache est *best-effort* : toute erreur est avalée et journalisée, jamais
 * propagée — une panne de cache dégrade la latence mais ne casse jamais une commande.
 * Au redémarrage de l'instance le cache repart vide (sans conséquence : il se
 * reremplit à la première lecture).
 *
 * Conventions de clé : `<domaine>:<id>[:<variante>]`
 *   ex. `rank:global:1234`, `seasons:wb`, `card:profile:<userId>:<hash>`.
 */

const PREFIX = "rpb:cache:";

const k = (key: string): string => PREFIX + key;

interface Entry {
  value: string;
  expiresAt: number; // epoch ms
}

const store = new Map<string, Entry>();

// Balayage périodique des clés expirées pour borner la mémoire (le bot tourne
// 24/7 ; sans GC la Map croîtrait sans fin). `unref()` pour ne pas retenir l'event loop.
const SWEEP_INTERVAL_MS = 60_000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, SWEEP_INTERVAL_MS);
if (typeof sweeper.unref === "function") sweeper.unref();

/** Lecture brute (string) — `null` si absent ou expiré. */
export async function cacheGet(key: string): Promise<string | null> {
  try {
    const entry = store.get(k(key));
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(k(key));
      return null;
    }
    return entry.value;
  } catch (err) {
    logger.warn(`[cache] get ${key} failed: ${(err as Error).message}`);
    return null;
  }
}

/** Écriture avec TTL (secondes). Best-effort. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    store.set(k(key), { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  } catch (err) {
    logger.warn(`[cache] set ${key} failed: ${(err as Error).message}`);
  }
}

/** Invalide une ou plusieurs clés. Best-effort. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    for (const key of keys) store.delete(k(key));
  } catch (err) {
    logger.warn(`[cache] del failed: ${(err as Error).message}`);
  }
}

/**
 * Get-or-compute mémoïsé pour des valeurs JSON-sérialisables.
 * En cas de miss, exécute `compute()` et met en cache le résultat. Une valeur
 * `undefined` retournée par `compute()` n'est pas mise en cache.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // valeur corrompue → on recalcule
    }
  }
  const value = await compute();
  if (value !== undefined) {
    await cacheSet(key, JSON.stringify(value), ttlSeconds);
  }
  return value;
}

/**
 * Cache binaire (PNG canvas, etc.) encodé base64.
 * Note : contrairement à l'ancien backend Redis, il ne survit pas au redémarrage
 * de l'instance (mémoire process) — sans conséquence, le rendu se régénère au miss.
 */
export async function cacheGetBuffer(key: string): Promise<Buffer | null> {
  const b64 = await cacheGet(`bin:${key}`);
  return b64 ? Buffer.from(b64, "base64") : null;
}

export async function cacheSetBuffer(
  key: string,
  buffer: Buffer,
  ttlSeconds: number,
): Promise<void> {
  await cacheSet(`bin:${key}`, buffer.toString("base64"), ttlSeconds);
}

/**
 * Variante buffer de `cached` : sert un PNG mémoïsé, le régénère au miss.
 */
export async function cachedBuffer(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<Buffer>,
): Promise<Buffer> {
  const hit = await cacheGetBuffer(key);
  if (hit) return hit;
  const buffer = await compute();
  await cacheSetBuffer(key, buffer, ttlSeconds);
  return buffer;
}

/** TTL conventionnels (secondes) — à réutiliser pour rester cohérent. */
export const TTL = {
  /** Données quasi-statiques (parts, items, listes de saisons). */
  STATIC: 60 * 60 * 24,
  /** Classements / rangs — rafraîchis par les crons. */
  RANKING: 60 * 5,
  /** Cartes canvas (profil, deck, leaderboard). */
  CARD: 60 * 60,
  /** Lectures chaudes courtes (autocomplete, lookups). */
  SHORT: 60,
} as const;
