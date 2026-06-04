/**
 * Sidecar d'embeddings local — service Bun isolé du bundle Next.
 *
 * Pourquoi un service séparé : le moteur d'inférence (`@huggingface/transformers`
 * → ONNX Runtime natif) ne doit JAMAIS entrer dans le bundle webpack de Next
 * (binaire natif, échec « collect page data »). Le web ne parle à ce sidecar
 * qu'en `fetch` HTTP ; aucune dépendance ONNX côté `apps/web`. Déployé en
 * serverless (Cloud Run) : bind 0.0.0.0:$PORT, cache poids dans os.tmpdir().
 *
 * Modèle : `Xenova/multilingual-e5-small` (384 dims) — multilingue (FR/EN/JP),
 * CPU-friendly, fort en retrieval. Convention E5 : préfixer `query: ` / `passage: `.
 * Poids téléchargés une fois dans `EMBED_CACHE_DIR` puis réutilisés hors-ligne.
 *
 * Reranking : cross-encoder `Xenova/bge-reranker-base` — 2e étage du pipeline
 * RAG (§3 du contrat docs/rag-unified-pattern.md). Chargé paresseusement au 1er
 * /rerank (le sidecar n'embarque pas le modèle de rerank tant qu'aucun appel ne
 * le demande). Scores ∈ [0,1] (sigmoid du logit), un par passage, dans l'ordre.
 *
 * Endpoints (bind 0.0.0.0:$PORT — Cloud Run ; CORS ouvert à toute origine) :
 *   GET  /health             -> { ok, model, dim, ready, rerank }
 *   POST /embed {texts,kind}  -> { dim, vectors: number[][] }   (kind: "query"|"passage")
 *   POST /rerank {query,passages} -> { scores: number[] }       (∈ [0,1], len == passages.length)
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env,
  pipeline,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

const MODEL = process.env.EMBED_MODEL ?? "Xenova/multilingual-e5-small";
const DIM = 384;
// Cross-encoder de reranking (multilingue, scores de pertinence query↔passage).
const RERANK_MODEL = process.env.RERANK_MODEL ?? "Xenova/bge-reranker-base";
// Cloud Run injecte `PORT` ; `EMBED_PORT` reste un override local. Bind 0.0.0.0
// (loopback interdit en serverless : le proxy Cloud Run ne joindrait jamais le
// service). Le port DOIT venir de l'environnement, jamais d'une valeur figée.
const PORT = Number(process.env.PORT ?? process.env.EMBED_PORT ?? 7077);
const HOST = process.env.EMBED_HOST ?? "0.0.0.0";
const MAX_TEXTS = 256;
const MAX_CHARS = 1200; // ~ borne tokens e5 (512) avec marge
const MAX_PASSAGES = 64; // cap §3 du contrat RAG (sinon pic mémoire ONNX)
const RERANK_MAX_CHARS = 2000; // ~512 tokens : la troncature tokenizer fait le reste

// Serverless : le FS est read-only hors `/tmp` (Cloud Run / lambdas). Le cache
// des poids ONNX doit donc atterrir dans un répertoire temporaire inscriptible
// par défaut ; `EMBED_CACHE_DIR` permet de pointer un volume persistant si dispo.
env.cacheDir = process.env.EMBED_CACHE_DIR ?? join(tmpdir(), "rpbey-embed-models");
env.allowRemoteModels = true;

let extractor: ((input: string[], opts: unknown) => Promise<{ tolist(): number[][] }>) | null =
  null;
let ready = false;
let loadError: string | null = null;

async function getExtractor(): Promise<NonNullable<typeof extractor>> {
  if (extractor) return extractor;
  const ex = (await pipeline("feature-extraction", MODEL)) as NonNullable<typeof extractor>;
  extractor = ex;
  ready = true;
  console.log(`[embed] modèle ${MODEL} prêt (${DIM}d)`);
  return ex;
}

// Chargement anticipé (le 1er /embed n'attend pas le download).
getExtractor().catch((e: unknown) => {
  loadError = e instanceof Error ? e.message : String(e);
  console.error(`[embed] échec chargement modèle : ${loadError}`);
});

/** Préfixe E5 + nettoyage + troncature. */
function prepare(texts: string[], kind: "query" | "passage"): string[] {
  const prefix = kind === "query" ? "query: " : "passage: ";
  return texts.map((t) => prefix + (t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS));
}

// --- Reranking (cross-encoder, chargé paresseusement au 1er /rerank) ---

let rerankerPromise: Promise<{
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
}> | null = null;

/** Charge (une seule fois) le cross-encoder de reranking. */
function getReranker() {
  rerankerPromise ??= (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(RERANK_MODEL);
    const model = await AutoModelForSequenceClassification.from_pretrained(RERANK_MODEL, {
      dtype: "q8",
    });
    console.log(`[embed] reranker ${RERANK_MODEL} prêt`);
    return { tokenizer, model };
  })();
  return rerankerPromise;
}

/**
 * Score de pertinence cross-encoder pour une requête vs chaque passage.
 * Renvoie un score ∈ [0,1] (sigmoid du logit) par passage, dans l'ordre fourni.
 * Plus précis que le cosinus bi-encoder → 2e étage du pipeline RAG (rerank).
 */
async function rerankTexts(query: string, passages: string[]): Promise<number[]> {
  if (passages.length === 0) return [];
  const { tokenizer, model } = await getReranker();
  const q = (query ?? "").replace(/\s+/g, " ").trim();
  const docs = passages.map((p) =>
    (p ?? "").replace(/\s+/g, " ").trim().slice(0, RERANK_MAX_CHARS),
  );
  const inputs = tokenizer(
    Array.from({ length: docs.length }, () => q),
    { text_pair: docs, padding: true, truncation: true },
  );
  const output = (await model(inputs)) as { logits: { sigmoid(): { tolist(): number[][] } } };
  return output.logits
    .sigmoid()
    .tolist()
    .map((row) => row[0]);
}

// CORS « ouvert partout » : ces endpoints sont non-credentialed (aucun cookie),
// donc `Access-Control-Allow-Origin: *` admet TOUTE origine. Aucune allow-list,
// aucun gating par origine — rien n'est rejeté sur ce critère.
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400",
};

/** Injecte les en-têtes CORS sur chaque réponse sortante. */
function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  idleTimeout: 30,
  async fetch(req): Promise<Response> {
    // Préflight CORS : 204 sans corps, en-têtes permissifs, pour toute origine.
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return withCors(
        Response.json({
          ok: loadError == null,
          model: MODEL,
          dim: DIM,
          ready,
          rerank: RERANK_MODEL,
          loadError,
        }),
      );
    }

    if (url.pathname === "/rerank" && req.method === "POST") {
      let body: { query?: unknown; passages?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return withCors(new Response("JSON invalide", { status: 400 }));
      }
      const query = typeof body.query === "string" ? body.query : "";
      const passages = Array.isArray(body.passages)
        ? body.passages.filter((p): p is string => typeof p === "string")
        : [];
      if (!query || passages.length === 0) {
        return withCors(new Response("query + passages[] requis", { status: 400 }));
      }
      if (passages.length > MAX_PASSAGES) {
        return withCors(new Response(`max ${MAX_PASSAGES} passages par requête`, { status: 413 }));
      }
      try {
        const scores = await rerankTexts(query, passages);
        return withCors(Response.json({ scores }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return withCors(new Response(`rerank error: ${msg}`, { status: 503 }));
      }
    }

    if (url.pathname === "/embed" && req.method === "POST") {
      let body: { texts?: unknown; kind?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return withCors(new Response("JSON invalide", { status: 400 }));
      }
      const texts = body.texts;
      if (!Array.isArray(texts) || texts.length === 0) {
        return withCors(new Response("texts[] requis", { status: 400 }));
      }
      if (texts.length > MAX_TEXTS) {
        return withCors(new Response(`max ${MAX_TEXTS} textes par requête`, { status: 400 }));
      }
      const kind = body.kind === "query" ? "query" : "passage";
      try {
        const ex = await getExtractor();
        const out = await ex(prepare(texts as string[], kind), {
          pooling: "mean",
          normalize: true,
        });
        return withCors(Response.json({ dim: DIM, vectors: out.tolist() }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return withCors(new Response(`embed error: ${msg}`, { status: 503 }));
      }
    }

    return withCors(new Response("not found", { status: 404 }));
  },
});

// Arrêt gracieux : Cloud Run envoie SIGTERM avant de recycler l'instance.
function shutdown(signal: string): void {
  console.log(`[embed] ${signal} reçu — arrêt gracieux du sidecar`);
  server.stop();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(`[embed] sidecar à l'écoute sur http://${HOST}:${PORT} (modèle ${MODEL})`);
