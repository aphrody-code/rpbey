/**
 * `@rpbey/api-client` — SDK typé de l'API rpbey.fr (`/api/v1`).
 *
 * Généré par `@hey-api/openapi-ts` depuis le contrat Zod (`bun run gen:api` dans
 * apps/web). N'éditez PAS `src/generated/**`. Le client par défaut pointe sur
 * `https://rpbey.fr` ; surchargez-le via `API_BASE` / `NEXT_PUBLIC_API_BASE`
 * (cutover Vercel, Phase 6) ou `configureApiClient({ baseUrl })`.
 */
import { client } from "./generated/client.gen";

const envBase =
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE)) ||
  undefined;
if (envBase) client.setConfig({ baseUrl: envBase });

/** Reconfigure le client SDK (baseUrl, headers, fetch…) à l'exécution. */
export function configureApiClient(opts: Parameters<typeof client.setConfig>[0]) {
  client.setConfig(opts);
}

export * from "./generated";
export { client };
