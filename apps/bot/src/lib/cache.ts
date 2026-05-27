import { redis } from "./redis.js";
import { logger } from "./logger.js";

/**
 * Cache Redis générique pour le bot (lectures chaudes + rendus canvas).
 *
 * Toutes les clés sont préfixées `rpb:cache:` pour rester isolées des autres
 * usages Redis (mentions, sessions). Le cache est *best-effort* : toute erreur
 * Redis est avalée et journalisée, jamais propagée — une panne Redis dégrade la
 * latence mais ne casse jamais une commande.
 *
 * Conventions de clé : `<domaine>:<id>[:<variante>]`
 *   ex. `rank:global:1234`, `seasons:wb`, `card:profile:<userId>:<hash>`.
 */

const PREFIX = "rpb:cache:";

const k = (key: string): string => PREFIX + key;

/** Lecture brute (string) — `null` si absent ou erreur Redis. */
export async function cacheGet(key: string): Promise<string | null> {
	try {
		return await redis.get(k(key));
	} catch (err) {
		logger.warn(`[cache] get ${key} failed: ${(err as Error).message}`);
		return null;
	}
}

/** Écriture avec TTL (secondes) via SETEX atomique. Best-effort. */
export async function cacheSet(
	key: string,
	value: string,
	ttlSeconds: number,
): Promise<void> {
	try {
		await redis.send("SETEX", [k(key), String(Math.max(1, ttlSeconds)), value]);
	} catch (err) {
		logger.warn(`[cache] set ${key} failed: ${(err as Error).message}`);
	}
}

/** Invalide une ou plusieurs clés. Best-effort. */
export async function cacheDel(...keys: string[]): Promise<void> {
	if (keys.length === 0) return;
	try {
		await Promise.all(keys.map((key) => redis.del(k(key))));
	} catch (err) {
		logger.warn(`[cache] del failed: ${(err as Error).message}`);
	}
}

/**
 * Get-or-compute mémoïsé en Redis pour des valeurs JSON-sérialisables.
 * En cas de miss (ou panne Redis), exécute `compute()` et met en cache le
 * résultat. Une valeur `undefined` retournée par `compute()` n'est pas mise en
 * cache.
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
 * Cache binaire (PNG canvas, etc.) encodé base64 en Redis.
 * Survit aux redémarrages du process (contrairement à un cache mémoire ETag).
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
