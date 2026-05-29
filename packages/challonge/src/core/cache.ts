/**
 * core/cache.ts — interface `Cache<V>` + `LruCache<V>` (M5).
 *
 * Logique LRU EXTRAITE de `transports/bxc.ts` (qui historiquement instanciait
 * `LRUCache` (npm `lru-cache`) inline). On la promeut ici derrière une interface
 * neutre `Cache<V>` pour que `BxcTransport` — et tout futur consommateur — puisse
 * l'injecter sans dépendre directement de `lru-cache`.
 *
 * Le comportement par défaut est STRICTEMENT identique à l'ancien inline :
 *   - éviction par taille (octets) : `maxBytes` défaut 50 MB
 *   - éviction par âge (TTL) : `ttlMs` défaut 15 min
 *
 * `set()` accepte un `{ ttlMs }` par entrée (override du TTL global) et un
 * `{ bytes }` (poids de l'entrée pour le calcul de taille). Sans `bytes`, le
 * poids vaut 1 (l'éviction reste alors purement par TTL / cardinalité).
 */

import { LRUCache } from "lru-cache";

// ---------------------------------------------------------------------------
// Constantes (défauts historiques de bxc.ts)
// ---------------------------------------------------------------------------

/** TTL par défaut : 15 minutes. */
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
/** Taille max par défaut : 50 MB. */
export const DEFAULT_CACHE_MAX_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Options par appel `set()`. */
export interface CacheSetOptions {
  /** TTL spécifique à cette entrée (ms). Override du TTL global. */
  ttlMs?: number;
  /** Poids de l'entrée en octets (pour l'éviction par taille). Défaut 1. */
  bytes?: number;
}

/** Contrat minimal d'un cache clé→valeur, compatible LRU + TTL. */
export interface Cache<V> {
  get(k: string): V | undefined;
  set(k: string, v: V, opts?: CacheSetOptions): void;
  has(k: string): boolean;
  clear(): void;
}

/** Options de construction de `LruCache`. */
export interface LruCacheOptions {
  /** Taille max en octets. Défaut 50 MB. */
  maxBytes?: number;
  /** TTL global en ms. Défaut 15 min. */
  ttlMs?: number;
}

// ---------------------------------------------------------------------------
// LruCache
// ---------------------------------------------------------------------------

/**
 * Cache LRU borné par taille (octets) et TTL. Implémente `Cache<V>` au-dessus
 * de `lru-cache` (npm) — comportement identique à l'ancien inline de bxc.ts.
 */
export class LruCache<V extends {}> implements Cache<V> {
  readonly #lru: LRUCache<string, V>;

  constructor(opts: LruCacheOptions = {}) {
    this.#lru = new LRUCache<string, V>({
      maxSize: opts.maxBytes ?? DEFAULT_CACHE_MAX_BYTES,
      ttl: opts.ttlMs ?? DEFAULT_CACHE_TTL_MS,
      // Poids par défaut 1 ; surchargé par `set(..., { bytes })`.
      sizeCalculation: () => 1,
    });
  }

  get(k: string): V | undefined {
    return this.#lru.get(k);
  }

  set(k: string, v: V, opts?: CacheSetOptions): void {
    this.#lru.set(k, v, {
      size: Math.max(1, opts?.bytes ?? 1),
      ...(opts?.ttlMs != null ? { ttl: opts.ttlMs } : {}),
    });
  }

  has(k: string): boolean {
    return this.#lru.has(k);
  }

  clear(): void {
    this.#lru.clear();
  }

  // ─── Diagnostics (au-delà du contrat `Cache<V>`) ─────────────────────────

  /** Nombre d'entrées actuellement stockées. */
  get size(): number {
    return this.#lru.size;
  }

  /** Taille calculée (somme des poids) en octets. */
  get calculatedSize(): number {
    return this.#lru.calculatedSize ?? 0;
  }
}
