import { buildOpenApiDocument } from "@rpbey/api-contract/openapi";

export const dynamic = "force-static";
export const runtime = "nodejs";

/**
 * Spec OpenAPI 3.1 de la surface `/api/v1`, dérivé du contrat Zod.
 * Consommé par `@hey-api/openapi-ts` pour générer le SDK typé `@rpbey/api-client`.
 */
export function GET() {
  return Response.json(
    buildOpenApiDocument({
      servers: [{ url: "https://rpbey.fr", description: "production" }],
    }),
  );
}
