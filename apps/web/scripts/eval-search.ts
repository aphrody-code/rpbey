#!/usr/bin/env bun
/**
 * eval-search.ts — jeu d'évaluation adverse + harnais de métriques retrieval.
 *
 * Best practice #1 (docs/data-pipeline-best-practices.md §D) : mesurer AVANT
 * d'optimiser. Compare le **BM25F seul** au **hybride BM25F⊕dense (RRF)** sur un
 * jeu de requêtes Beyblade incluant des **littéraux** (codes, SKU), des **fautes
 * de frappe**, du **japonais** (cross-lingue) et des **requêtes conceptuelles**
 * (langage naturel — là où le dense doit briller).
 *
 * Métriques par mode : Hit@10 (une cible dans le top-10), MRR@10, nDCG@10.
 * Corpus + vecteurs lus en live (API + VSIM Redis), ranker importé tel quel.
 *
 *   bun apps/web/scripts/eval-search.ts
 */
import { RedisClient } from "bun";
import { fuseHybrid, normalize, rankSearch, type VectorRank } from "../src/lib/search-rank";
import type { GlobalSearchItem } from "@rpbey/api-contract";

const SIDECAR = process.env.EMBED_URL ?? "http://127.0.0.1:7077";
const INDEX_URL = process.env.EMBED_INDEX_URL ?? "http://127.0.0.1:3002/api/v1/search";
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const VEC_KEY = "rpbey:search:vec";
const K = 10;

/**
 * Jeu de requêtes labellisées. `expect` : une cible est pertinente si son titre
 * normalisé contient l'un des fragments, OU si sa catégorie est dans `cats`.
 */
interface EvalQuery {
  q: string;
  kind: "littéral" | "faute" | "japonais" | "concept";
  titleAny?: string[];
  cats?: string[];
}

const QUERIES: EvalQuery[] = [
  // Littéraux : noms exacts, codes, drivers — le dense seul échoue ici.
  { q: "dran sword", kind: "littéral", titleAny: ["dran sword", "dransword"] },
  { q: "wizard rod", kind: "littéral", titleAny: ["wizard rod", "wizard arrow"] },
  { q: "phoenix wing", kind: "littéral", titleAny: ["phoenix wing", "phoenix"] },
  { q: "cobalt drake", kind: "littéral", titleAny: ["cobalt drake", "cobalt dragoon"] },
  { q: "shark edge", kind: "littéral", titleAny: ["shark edge"] },
  { q: "hells scythe", kind: "littéral", titleAny: ["hells scythe", "hells chain"] },
  { q: "leon claw", kind: "littéral", titleAny: ["leon claw", "leon crest"] },
  { q: "knight shield", kind: "littéral", titleAny: ["knight shield", "knight lance"] },
  { q: "tyranno beat", kind: "littéral", titleAny: ["tyranno beat", "tyranno"] },
  { q: "3-60", kind: "littéral", titleAny: ["3-60"] },
  { q: "unicorn sting", kind: "littéral", titleAny: ["unicorn"] },
  { q: "viper tail", kind: "littéral", titleAny: ["viper tail", "viper"] },
  // Fautes de frappe (typo-tolérance).
  { q: "dran swrod", kind: "faute", titleAny: ["dran sword", "dransword"] },
  { q: "wizrd rod", kind: "faute", titleAny: ["wizard rod", "wizard"] },
  { q: "phoneix wing", kind: "faute", titleAny: ["phoenix"] },
  { q: "shrk edge", kind: "faute", titleAny: ["shark edge", "shark"] },
  { q: "tyrano beat", kind: "faute", titleAny: ["tyranno"] },
  // Japonais (cross-lingue).
  { q: "ドランソード", kind: "japonais", titleAny: ["dran sword", "dransword", "dran"] },
  { q: "ウィザードロッド", kind: "japonais", titleAny: ["wizard"] },
  { q: "フェニックスウイング", kind: "japonais", titleAny: ["phoenix"] },
  { q: "シャークエッジ", kind: "japonais", titleAny: ["shark"] },
  { q: "レオンクロー", kind: "japonais", titleAny: ["leon"] },
  // Conceptuel / langage naturel — le dense apporte du recall.
  { q: "meilleur combo attaque", kind: "concept", cats: ["combo", "meta"] },
  { q: "toupie pas chère", kind: "concept", cats: ["product"] },
  { q: "championnat tournoi", kind: "concept", cats: ["tournament"] },
  { q: "où acheter une beyblade", kind: "concept", cats: ["product", "site"] },
  { q: "combinaison défense endurance", kind: "concept", cats: ["combo", "meta", "part"] },
  { q: "lanceur officiel", kind: "concept", cats: ["product", "part", "lexicon"] },
  { q: "meta du moment", kind: "concept", cats: ["meta"] },
  { q: "discussion communauté reddit", kind: "concept", cats: ["discussion"] },
];

function relevant(item: GlobalSearchItem, e: EvalQuery): boolean {
  const t = normalize(item.title);
  if (e.titleAny?.some((frag) => t.includes(normalize(frag)))) return true;
  if (e.cats?.includes(item.category)) return true;
  return false;
}

async function loadCorpus(redis: RedisClient): Promise<GlobalSearchItem[]> {
  try {
    const res = await fetch(INDEX_URL, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const json = (await res.json()) as { data?: GlobalSearchItem[] };
      if (json.data?.length) return json.data;
    }
  } catch {
    // API down → fallback Redis (même clé que l'indexeur)
  }
  const cached = await redis.get("rpbey:search:corpus:v1");
  if (cached) return JSON.parse(cached) as GlobalSearchItem[];
  throw new Error("corpus introuvable (API + Redis)");
}

async function vecHits(redis: RedisClient, q: string, count = 120): Promise<VectorRank[]> {
  try {
    const r = await fetch(`${SIDECAR}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [q], kind: "query" }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { vectors?: number[][] };
    const v = j.vectors?.[0];
    if (!v) return [];
    const f32 = Float32Array.from(v);
    const blob = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    const reply = (await redis.send("VSIM", [
      VEC_KEY,
      "FP32",
      blob as unknown as string,
      "WITHSCORES",
      "COUNT",
      String(count),
    ])) as unknown;
    const hits: VectorRank[] = [];
    if (reply && typeof reply === "object" && !Array.isArray(reply)) {
      for (const [id, sim] of Object.entries(reply as Record<string, unknown>)) {
        hits.push({ id, sim: Number(sim) });
      }
    } else if (Array.isArray(reply)) {
      for (let i = 0; i + 1 < reply.length; i += 2) {
        hits.push({ id: String(reply[i]), sim: Number(reply[i + 1]) });
      }
    }
    return hits;
  } catch {
    return [];
  }
}

interface Metrics {
  hit: number;
  mrr: number;
  ndcg: number;
}

function score(ranked: GlobalSearchItem[], e: EvalQuery): Metrics {
  let firstRel = -1;
  let dcg = 0;
  for (let i = 0; i < Math.min(K, ranked.length); i++) {
    const item = ranked[i];
    if (item && relevant(item, e)) {
      if (firstRel < 0) firstRel = i;
      dcg += 1 / Math.log2(i + 2);
    }
  }
  // IDCG : on suppose au moins 1 cible (idéal = rang 0).
  const idcg = 1;
  return {
    hit: firstRel >= 0 ? 1 : 0,
    mrr: firstRel >= 0 ? 1 / (firstRel + 1) : 0,
    ndcg: Math.min(1, dcg / idcg),
  };
}

function avg(ms: Metrics[]): Metrics {
  const n = ms.length || 1;
  return {
    hit: ms.reduce((s, m) => s + m.hit, 0) / n,
    mrr: ms.reduce((s, m) => s + m.mrr, 0) / n,
    ndcg: ms.reduce((s, m) => s + m.ndcg, 0) / n,
  };
}

async function main() {
  const redis = new RedisClient(REDIS_URL);
  const corpus = await loadCorpus(redis);
  console.log(`[eval] corpus ${corpus.length} items, ${QUERIES.length} requêtes, K=${K}\n`);

  const lexM: Metrics[] = [];
  const hybM: Metrics[] = [];
  const byKind = new Map<string, { lex: Metrics[]; hyb: Metrics[] }>();

  const lexFull = QUERIES.map((e) => ({ e, full: rankSearch(corpus, e.q, {}) }));
  for (const { e, full } of lexFull) {
    const lexTop = full.slice(0, K);
    const vec = await vecHits(redis, e.q);
    const hybTop = fuseHybrid(corpus, full, vec, { limit: K });
    const lm = score(lexTop, e);
    const hm = score(hybTop, e);
    lexM.push(lm);
    hybM.push(hm);
    const bk = byKind.get(e.kind) ?? { lex: [], hyb: [] };
    bk.lex.push(lm);
    bk.hyb.push(hm);
    byKind.set(e.kind, bk);
    const flag = hm.mrr > lm.mrr ? "↑" : hm.mrr < lm.mrr ? "↓" : "=";
    console.log(
      `  ${flag} [${e.kind.padEnd(9)}] "${e.q}"  lex mrr=${lm.mrr.toFixed(2)} hit=${lm.hit}  | hyb mrr=${hm.mrr.toFixed(2)} hit=${hm.hit}`,
    );
  }
  redis.close();

  const L = avg(lexM);
  const H = avg(hybM);
  console.log("\n=== par type de requête (MRR@10) ===");
  for (const [kind, bk] of byKind) {
    console.log(
      `  ${kind.padEnd(9)}  lex=${avg(bk.lex).mrr.toFixed(3)}  hybride=${avg(bk.hyb).mrr.toFixed(3)}`,
    );
  }
  console.log("\n=== global ===");
  console.log(
    `  BM25F seul :  Hit@${K}=${L.hit.toFixed(3)}  MRR@${K}=${L.mrr.toFixed(3)}  nDCG@${K}=${L.ndcg.toFixed(3)}`,
  );
  console.log(
    `  Hybride RRF:  Hit@${K}=${H.hit.toFixed(3)}  MRR@${K}=${H.mrr.toFixed(3)}  nDCG@${K}=${H.ndcg.toFixed(3)}`,
  );
  const d = (a: number, b: number) =>
    `${b >= a ? "+" : ""}${(((b - a) / (a || 1)) * 100).toFixed(1)}%`;
  console.log(
    `  Δ hybride  :  Hit ${d(L.hit, H.hit)}  MRR ${d(L.mrr, H.mrr)}  nDCG ${d(L.ndcg, H.ndcg)}`,
  );
}

await main();
