#!/usr/bin/env bun
/**
 * build-search-vectors.ts — construit l'index vectoriel du corpus de recherche.
 *
 * Récupère le corpus unifié (API web `/api/v1/search` sans `q`, fallback clé Redis
 * `rpbey:search:corpus:v1`), embed chaque item via le **sidecar** (`/embed`,
 * multilingual-e5-small 384d) par lots, et pousse les vecteurs dans le vector set
 * Redis **`rpbey:search:vec`** (VADD FP32, élément = `item.id`). Le ranker hybride
 * (`/api/v1/search`) fait ensuite du VSIM dessus et fusionne en RRF avec le BM25F.
 *
 * Rebuild complet idempotent : DEL de la clé puis ré-insertion. Best-effort —
 * échoue proprement si le sidecar ou Redis sont absents.
 *
 *   bun apps/web/scripts/build-search-vectors.ts
 *   EMBED_INDEX_URL=… EMBED_URL=… REDIS_URL=… bun apps/web/scripts/build-search-vectors.ts
 */
import { RedisClient } from "bun";

const SIDECAR_URL = process.env.EMBED_URL ?? "http://127.0.0.1:7077";
const INDEX_URL = process.env.EMBED_INDEX_URL ?? "http://127.0.0.1:3002/api/v1/search";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const CORPUS_KEY = "rpbey:search:corpus:v1";
const VEC_KEY = "rpbey:search:vec";
const BATCH = 64; // textes par appel /embed
const WRITE_CONCURRENCY = 100; // VADD en vol

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  details?: string;
  badge?: string;
}

/** Texte à embedder pour un item (titre + champs secondaires). */
function itemText(it: Item): string {
  return [it.title, it.subtitle, it.details, it.badge]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Corpus depuis l'API web (source de vérité), fallback clé Redis. */
async function loadCorpus(redis: RedisClient): Promise<Item[]> {
  try {
    const res = await fetch(INDEX_URL, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const json = (await res.json()) as { data?: Item[] };
      if (Array.isArray(json.data) && json.data.length > 0) {
        console.log(`[vec] corpus via API (${json.data.length} items)`);
        return json.data;
      }
    }
  } catch {
    // API down → fallback Redis
  }
  const cached = await redis.get(CORPUS_KEY);
  if (cached) {
    const items = JSON.parse(cached) as Item[];
    console.log(`[vec] corpus via Redis ${CORPUS_KEY} (${items.length} items)`);
    return items;
  }
  throw new Error("corpus introuvable (API + Redis indisponibles)");
}

/** Embeddings d'un lot de textes via le sidecar. */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${SIDECAR_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, kind: "passage" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`sidecar /embed HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { vectors?: number[][] };
  if (!json.vectors || json.vectors.length !== texts.length) {
    throw new Error("réponse /embed incohérente");
  }
  return json.vectors;
}

function toBlob(vec: number[]): Buffer {
  const f32 = Float32Array.from(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

async function main() {
  // Sidecar prêt ?
  try {
    const h = (await (
      await fetch(`${SIDECAR_URL}/health`, { signal: AbortSignal.timeout(5000) })
    ).json()) as {
      ready?: boolean;
      dim?: number;
    };
    if (!h.ready) throw new Error("sidecar pas prêt (modèle en cours de chargement ?)");
    console.log(`[vec] sidecar OK (dim=${h.dim})`);
  } catch (e) {
    console.error(`[vec] sidecar injoignable sur ${SIDECAR_URL} : ${(e as Error).message}`);
    process.exit(1);
  }

  const redis = new RedisClient(REDIS_URL);
  const items = (await loadCorpus(redis)).filter((it) => it && it.id && it.title);
  const texts = items.map(itemText);

  // Rebuild propre.
  try {
    await redis.send("DEL", [VEC_KEY]);
  } catch {
    // pas grave si la clé n'existait pas
  }

  let done = 0;
  let pending: Promise<unknown>[] = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const vectors = await embedBatch(texts.slice(i, i + BATCH));
    for (let j = 0; j < slice.length; j++) {
      const item = slice[j];
      const vec = vectors[j];
      if (!item || !vec) continue;
      pending.push(
        redis.send("VADD", [VEC_KEY, "FP32", toBlob(vec) as unknown as string, item.id]),
      );
      if (pending.length >= WRITE_CONCURRENCY) {
        await Promise.all(pending);
        pending = [];
      }
    }
    done += slice.length;
    if (done % 512 < BATCH) console.log(`[vec] ${done}/${items.length} embeddés`);
  }
  await Promise.all(pending);

  const card = await redis.send("VCARD", [VEC_KEY]);
  const dim = await redis.send("VDIM", [VEC_KEY]);
  console.log(
    `[vec] OK — vector set ${VEC_KEY}: VCARD=${card}, VDIM=${dim} (sur ${items.length} items)`,
  );
  redis.close();
}

await main();
