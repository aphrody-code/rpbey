import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// `server.ts` n'exporte AUCUNE fonction : toute la logique (validation des
// requêtes, routing, préfixe E5) vit dans le handler `fetch` d'un `Bun.serve`
// monté au chargement du module, sur le port `EMBED_PORT`. Le seul helper pur
// (`prepare`) est privé.
//
// Pour tester le VRAI handler sans réécrire de copie ni dépendre du réseau :
//   1. on réserve un port libre via `Bun.serve({ port: 0 })` puis on le relâche ;
//   2. on fixe `EMBED_PORT` AVANT d'importer le module (lu à l'évaluation) ;
//   3. on coupe tout téléchargement de modèle (TRANSFORMERS_OFFLINE) — les
//      branches testées (/health, validations 400/413/404) ne touchent jamais
//      l'inférence, donc le test passe hors-ligne que le modèle charge ou non.

let base = "";

beforeAll(async () => {
  // Réserve un port éphémère libre, puis le relâche pour le céder au sidecar.
  const probe = Bun.serve({ port: 0, fetch: () => new Response("probe") });
  const port = probe.port;
  probe.stop(true);

  process.env.EMBED_PORT = String(port);
  process.env.TRANSFORMERS_OFFLINE = "1";
  process.env.HF_HUB_OFFLINE = "1";
  base = `http://127.0.0.1:${port}`;

  await import("./server.ts");
  // Laisse le `Bun.serve` du module se lier avant le premier fetch.
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${base}/health`);
      return;
    } catch {
      await Bun.sleep(20);
    }
  }
  throw new Error("le sidecar embed ne répond pas sur /health");
});

afterAll(() => {
  // Le serveur du module ne s'expose pas ; le runner se termine et libère le port.
});

describe("/health", () => {
  test("renvoie 200 + métadonnées de modèle structurées", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      model: string;
      dim: number;
      ready: boolean;
      rerank: string;
    };
    expect(j.model).toBe("Xenova/multilingual-e5-small");
    expect(j.dim).toBe(384);
    expect(typeof j.ready).toBe("boolean");
    expect(j.rerank).toBe("Xenova/bge-reranker-base");
  });
});

describe("/embed validation (n'atteint jamais le modèle)", () => {
  test("400 sur JSON invalide", async () => {
    const res = await fetch(`${base}/embed`, { method: "POST", body: "{pas du json" });
    expect(res.status).toBe(400);
  });

  test("400 sur texts[] vide", async () => {
    const res = await fetch(`${base}/embed`, {
      method: "POST",
      body: JSON.stringify({ texts: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("400 sur texts manquant", async () => {
    const res = await fetch(`${base}/embed`, {
      method: "POST",
      body: JSON.stringify({ kind: "query" }),
    });
    expect(res.status).toBe(400);
  });

  test("400 au-delà de la borne MAX_TEXTS (256)", async () => {
    const res = await fetch(`${base}/embed`, {
      method: "POST",
      body: JSON.stringify({ texts: Array.from({ length: 257 }, () => "x") }),
    });
    expect(res.status).toBe(400);
  });
});

describe("/rerank validation (n'atteint jamais le modèle)", () => {
  test("400 sur JSON invalide", async () => {
    const res = await fetch(`${base}/rerank`, { method: "POST", body: "<xml/>" });
    expect(res.status).toBe(400);
  });

  test("400 quand query+passages absents", async () => {
    const res = await fetch(`${base}/rerank`, {
      method: "POST",
      body: JSON.stringify({ query: "", passages: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("413 au-delà de la borne MAX_PASSAGES (64)", async () => {
    const res = await fetch(`${base}/rerank`, {
      method: "POST",
      body: JSON.stringify({
        query: "q",
        passages: Array.from({ length: 65 }, () => "p"),
      }),
    });
    expect(res.status).toBe(413);
  });
});

describe("routing", () => {
  test("404 sur une route inconnue", async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
  });

  test("GET /embed (méthode non POST) tombe en 404", async () => {
    const res = await fetch(`${base}/embed`, { method: "GET" });
    expect(res.status).toBe(404);
  });
});
