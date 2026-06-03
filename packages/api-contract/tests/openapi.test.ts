import { describe, expect, test } from "bun:test";

import { buildOpenApiDocument, listRoutes } from "../src/openapi";

// Génération du document OpenAPI 3.1 depuis le registre de routes Zod. ZÉRO réseau.

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument();

  test("émet un document OpenAPI 3.1.x", () => {
    expect(typeof doc.openapi).toBe("string");
    expect(doc.openapi.startsWith("3.1")).toBe(true);
  });

  test("expose des paths non vides sous le préfixe /api/v1", () => {
    const keys = Object.keys(doc.paths);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((p) => p.startsWith("/api/v1"))).toBe(true);
  });

  test("chaque route déclarée se retrouve dans le document", () => {
    for (const r of listRoutes()) {
      const full = `/api/v1${r.path}`;
      expect(doc.paths[full]).toBeDefined();
      expect(doc.paths[full]![r.method]).toBeDefined();
    }
  });

  test("chaque opération a operationId, summary, tags et une réponse 200", () => {
    for (const [, methods] of Object.entries(doc.paths)) {
      for (const op of Object.values(methods) as Record<string, unknown>[]) {
        expect(typeof op.operationId).toBe("string");
        expect(typeof op.summary).toBe("string");
        expect(Array.isArray(op.tags)).toBe(true);
        const responses = op.responses as Record<string, unknown>;
        expect(responses["200"]).toBeDefined();
        expect(responses["4XX"]).toBeDefined();
      }
    }
  });

  test("une route à path param (/users/{id}) déclare un parameter in:path requis", () => {
    const op = doc.paths["/api/v1/users/{id}"]!.get as Record<string, unknown>;
    const params = op.parameters as Array<Record<string, unknown>>;
    const idParam = params.find((p) => p.name === "id" && p.in === "path");
    expect(idParam).toBeDefined();
    expect(idParam!.required).toBe(true);
  });

  test("une route POST avec body (/analytics) déclare un requestBody requis", () => {
    const op = doc.paths["/api/v1/analytics"]!.post as Record<string, unknown>;
    const rb = op.requestBody as Record<string, unknown>;
    expect(rb).toBeDefined();
    expect(rb.required).toBe(true);
  });

  test("le serveur par défaut peut être surchargé via opts", () => {
    const d = buildOpenApiDocument({ servers: [{ url: "http://localhost:3000" }] });
    expect(d.servers[0]!.url).toBe("http://localhost:3000");
  });
});

describe("listRoutes", () => {
  test("retourne un registre figé non vide d'operationIds uniques", () => {
    const routes = listRoutes();
    expect(routes.length).toBeGreaterThan(0);
    const ids = routes.map((r) => r.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
