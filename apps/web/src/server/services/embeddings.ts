import "server-only";
import type { RedisClient } from "bun";

/**
 * Pont de recherche sémantique (couche dense de l'hybride).
 *
 * - `embedQuery` : embedding d'une requête via le **sidecar** loopback
 *   (`apps/embed-sidecar`, multilingual-e5-small 384d). Aucune dépendance ONNX
 *   ici — uniquement un `fetch` — donc rien n'entre dans le bundle Next.
 * - `searchVectorIds` : voisins sémantiques du corpus via `VSIM` sur le vector
 *   set Redis `rpbey:search:vec` (alimenté par `scripts/build-search-vectors.ts`).
 *
 * **Best-effort total** : sidecar éteint, Redis absent, modèle pas prêt → renvoie
 * `null`/`[]`. La recherche dégrade alors proprement vers le BM25F lexical seul.
 * `Bun.RedisClient` résolu via `globalThis.Bun` au runtime (le builtin `bun` ne
 * s'importe pas dans le bundle Next — cf. `search-corpus.ts`).
 */

const SIDECAR_URL = process.env.EMBED_URL ?? "http://127.0.0.1:7077";
const VEC_KEY = "rpbey:search:vec";
const QUERY_TIMEOUT_MS = 1500; // au-delà → on laisse tomber le dense, BM25F suffit

let client: RedisClient | null = null;

function redis(): RedisClient | null {
  try {
    const ctor = (
      globalThis as unknown as { Bun?: { RedisClient: new (url: string) => RedisClient } }
    ).Bun?.RedisClient;
    if (!ctor) return null;
    client ??= new ctor(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
    return client;
  } catch {
    return null;
  }
}

/** Embedding L2-normalisé d'une requête (384d) ; `null` si sidecar indisponible. */
export async function embedQuery(text: string): Promise<Float32Array | null> {
  const t = text.trim();
  if (!t) return null;
  try {
    const res = await fetch(`${SIDECAR_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [t], kind: "query" }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { vectors?: number[][] };
    const v = json.vectors?.[0];
    if (!v || v.length === 0) return null;
    return Float32Array.from(v);
  } catch {
    return null;
  }
}

export interface VectorHit {
  id: string;
  sim: number;
}

/**
 * Voisins sémantiques (ids du corpus triés par similarité décroissante).
 * Renvoie `[]` si la requête n'a pas pu être embeddée ou si Redis/vector set
 * est indisponible — l'appelant retombe alors sur le seul BM25F.
 */
export async function searchVectorIds(query: string, count = 120): Promise<VectorHit[]> {
  const vec = await embedQuery(query);
  if (!vec) return [];
  const r = redis();
  if (!r) return [];
  try {
    const blob = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
    const reply = (await r.send("VSIM", [
      VEC_KEY,
      "FP32",
      blob as unknown as string,
      "WITHSCORES",
      "COUNT",
      String(count),
    ])) as unknown;
    return parseVsim(reply);
  } catch {
    return [];
  }
}

/**
 * Voisins sémantiques d'un **élément déjà indexé** (par son id de corpus), via
 * `VSIM … ELE`. Contrairement à `searchVectorIds`, aucun embedding de requête
 * n'est calculé (le vecteur est déjà stocké) → **aucune dépendance au sidecar**,
 * utilisable au build SSG. Sert le « produits liés / vous aimerez aussi ».
 * L'élément lui-même est exclu du résultat. `[]` si Redis/vector set absent.
 */
export async function vectorNeighborsById(elementId: string, count = 12): Promise<VectorHit[]> {
  const id = elementId.trim();
  if (!id) return [];
  const r = redis();
  if (!r) return [];
  try {
    const reply = (await r.send("VSIM", [
      VEC_KEY,
      "ELE",
      id,
      "WITHSCORES",
      "COUNT",
      String(count + 1), // +1 car l'élément lui-même revient en tête
    ])) as unknown;
    return parseVsim(reply).filter((h) => h.id !== id);
  } catch {
    return [];
  }
}

/** Parse une réponse `VSIM ... WITHSCORES` (flat, paires, ou map selon RESP2/3). */
function parseVsim(reply: unknown): VectorHit[] {
  const hits: VectorHit[] = [];
  const push = (id: unknown, sim: unknown) => {
    const s = String(id);
    const n = Number(sim);
    if (s && Number.isFinite(n)) hits.push({ id: s, sim: n });
  };
  if (Array.isArray(reply)) {
    if (reply.length > 0 && Array.isArray(reply[0])) {
      for (const pair of reply as unknown[][]) push(pair[0], pair[1]);
    } else {
      for (let i = 0; i + 1 < reply.length; i += 2) push(reply[i], reply[i + 1]);
    }
  } else if (reply && typeof reply === "object") {
    for (const [id, sim] of Object.entries(reply as Record<string, unknown>)) push(id, sim);
  }
  return hits;
}
