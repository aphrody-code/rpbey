#!/usr/bin/env bun
/**
 * Émet le document OpenAPI 3.1 de `/api/v1` (dérivé du contrat Zod) dans un fichier
 * statique, consommé par `@hey-api/openapi-ts` pour générer le SDK `@rpbey/api-client`.
 * Source de vérité = `buildOpenApiDocument()` (packages/api-contract).
 */
import { buildOpenApiDocument } from "@rpbey/api-contract/openapi";

const doc = buildOpenApiDocument({
  servers: [{ url: "https://rpbey.fr", description: "production" }],
});
const out = new URL("../openapi.json", import.meta.url).pathname;
await Bun.write(out, JSON.stringify(doc, null, 2));
console.log(`✓ OpenAPI 3.1 → ${out} (${Object.keys(doc.paths).length} paths)`);
