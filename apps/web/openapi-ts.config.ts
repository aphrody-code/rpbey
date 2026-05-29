import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Génère le SDK typé `@rpbey/api-client` depuis le spec OpenAPI 3.1 (`openapi.json`,
 * émis par `scripts/emit-openapi.ts` à partir du contrat Zod). `bun run gen:api`.
 * Client fetch + types + schémas Zod de validation. Sortie commitée (diff = CI rouge).
 */
export default defineConfig({
  input: "./openapi.json",
  output: {
    path: "../../packages/api-client/src/generated",
  },
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    { name: "@hey-api/sdk", validator: true },
    "zod",
  ],
});
