import { z } from "zod";
import { RecommendQuerySchema, RecommendResponseSchema, SearchResponseSchema } from "./comparateur";
import { MetaResponseSchema } from "./meta";
import { PartsQuerySchema, PartsListResponseSchema } from "./parts";
import { ErrorEnvelopeSchema, okEnvelope } from "./envelope";

/**
 * Registre de routes minimaliste → document OpenAPI 3.1.
 * Source de vérité = schémas Zod (v4 `z.toJSONSchema`). Aucune dépendance externe.
 * Consommé par `@hey-api/openapi-ts` pour générer le SDK typé.
 */
export interface RouteDef {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string; // ex. "/recommend"
  operationId: string;
  summary: string;
  tags: string[];
  query?: z.ZodObject;
  body?: z.ZodType;
  /** Schéma du payload (hors enveloppe) ; enveloppé en `{ ok, data }`. */
  response: z.ZodType;
}

type JsonSchema = Record<string, unknown>;

function toSchema(s: z.ZodType, io: "input" | "output" = "output"): JsonSchema {
  const out = z.toJSONSchema(s, {
    target: "draft-2020-12",
    io,
    // coerce/transform (ex. availableOnly, poids coercés) non représentables :
    // émettre un schéma permissif plutôt que de throw.
    unrepresentable: "any",
  }) as JsonSchema;
  delete out.$schema; // composants OpenAPI 3.1 = JSON Schema 2020-12 sans $schema
  return out;
}

function queryParameters(schema: z.ZodObject): JsonSchema[] {
  const json = toSchema(schema, "input") as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([name, propSchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: propSchema,
  }));
}

const ROUTES: RouteDef[] = [
  {
    method: "get",
    path: "/recommend",
    operationId: "getRecommendations",
    summary: "Recommandations produits pondérées (méta-relevance / hype / prix).",
    tags: ["comparateur"],
    query: RecommendQuerySchema,
    response: RecommendResponseSchema,
  },
  {
    method: "get",
    path: "/search",
    operationId: "globalSearch",
    summary: "Index de recherche globale (produits, pièces, tournois, bladers, lexique).",
    tags: ["comparateur"],
    response: SearchResponseSchema,
  },
  {
    method: "get",
    path: "/meta",
    operationId: "getMeta",
    summary:
      "Méta-analyse hebdomadaire des pièces Beyblade X (tournois WBO), enrichie stats/images.",
    tags: ["meta"],
    response: MetaResponseSchema,
  },
  {
    method: "get",
    path: "/parts",
    operationId: "listParts",
    summary: "Catalogue public des pièces Beyblade X (filtres + pagination).",
    tags: ["parts"],
    query: PartsQuerySchema,
    response: PartsListResponseSchema,
  },
];

export function listRoutes(): readonly RouteDef[] {
  return ROUTES;
}

const BASE_PATH = "/api/v1";

export interface OpenApiOptions {
  servers?: Array<{ url: string; description?: string }>;
}

/** Assemble le document OpenAPI 3.1 complet de la surface `/api/v1`. */
export function buildOpenApiDocument(opts: OpenApiOptions = {}) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of ROUTES) {
    const fullPath = `${BASE_PATH}${r.path}`;
    const op: Record<string, unknown> = {
      operationId: r.operationId,
      summary: r.summary,
      tags: r.tags,
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": { schema: toSchema(okEnvelope(r.response)) },
          },
        },
        "4XX": {
          description: "Erreur de requête ou de validation",
          content: {
            "application/json": { schema: toSchema(ErrorEnvelopeSchema) },
          },
        },
        "5XX": {
          description: "Erreur serveur",
          content: {
            "application/json": { schema: toSchema(ErrorEnvelopeSchema) },
          },
        },
      },
    };
    if (r.query) op.parameters = queryParameters(r.query);
    if (r.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: toSchema(r.body) } },
      };
    }
    paths[fullPath] ??= {};
    paths[fullPath][r.method] = op;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "RPBey API",
      version: "1.0.0",
      description:
        "Surface REST versionnée de rpbey.fr — contrat source de vérité (Zod). Consommée par le SDK généré (@rpbey/api-client).",
    },
    servers: opts.servers ?? [{ url: "https://rpbey.fr" }],
    paths,
  };
}
