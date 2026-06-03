/**
 * Sidecar d'embeddings local — service Bun isolé du bundle Next.
 *
 * Pourquoi un service séparé : le moteur d'inférence (`@huggingface/transformers`
 * → ONNX Runtime natif) ne doit JAMAIS entrer dans le bundle webpack de Next
 * (binaire natif, échec « collect page data »). Le web ne parle à ce sidecar
 * qu'en `fetch` HTTP loopback ; aucune dépendance ONNX côté `apps/web`.
 *
 * Modèle : `Xenova/multilingual-e5-small` (384 dims) — multilingue (FR/EN/JP),
 * CPU-friendly, fort en retrieval. Convention E5 : préfixer `query: ` / `passage: `.
 * Poids téléchargés une fois dans `EMBED_CACHE_DIR` puis réutilisés hors-ligne.
 *
 * Endpoints (loopback 127.0.0.1 uniquement) :
 *   GET  /health            -> { ok, model, dim, ready }
 *   POST /embed {texts,kind} -> { dim, vectors: number[][] }   (kind: "query"|"passage")
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { env, pipeline } from "@huggingface/transformers";

const MODEL = process.env.EMBED_MODEL ?? "Xenova/multilingual-e5-small";
const DIM = 384;
const PORT = Number(process.env.EMBED_PORT ?? 7077);
const MAX_TEXTS = 256;
const MAX_CHARS = 1200; // ~ borne tokens e5 (512) avec marge

env.cacheDir =
  process.env.EMBED_CACHE_DIR ?? join(process.env.HOME || homedir(), ".cache/rpbey-embed-models");
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

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 30,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: loadError == null, model: MODEL, dim: DIM, ready, loadError });
    }

    if (url.pathname === "/embed" && req.method === "POST") {
      let body: { texts?: unknown; kind?: unknown };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return new Response("JSON invalide", { status: 400 });
      }
      const texts = body.texts;
      if (!Array.isArray(texts) || texts.length === 0) {
        return new Response("texts[] requis", { status: 400 });
      }
      if (texts.length > MAX_TEXTS) {
        return new Response(`max ${MAX_TEXTS} textes par requête`, { status: 400 });
      }
      const kind = body.kind === "query" ? "query" : "passage";
      try {
        const ex = await getExtractor();
        const out = await ex(prepare(texts as string[], kind), {
          pooling: "mean",
          normalize: true,
        });
        return Response.json({ dim: DIM, vectors: out.tolist() });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(`embed error: ${msg}`, { status: 503 });
      }
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`[embed] sidecar à l'écoute sur http://127.0.0.1:${PORT} (modèle ${MODEL})`);
