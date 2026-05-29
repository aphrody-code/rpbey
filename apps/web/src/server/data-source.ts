import "server-only";

/**
 * Seam d'accès données DAL↔SDK (migration API-first, Phase 1c).
 *
 * Unique point de bascule entre les deux modes de déploiement :
 *
 * - **Co-localisé** (VPS, Postgres en socket local) : `isRemote === false` →
 *   les services tapent la DAL (`@/server/dal/**`) en direct, zéro round-trip HTTP.
 * - **Standalone** (Vercel, sans DB) : `API_BASE` / `NEXT_PUBLIC_API_BASE` défini →
 *   `isRemote === true`, les services lisent l'API distante (`https://rpbey.fr/api/v1`)
 *   via le SDK généré `@rpbey/api-client`.
 *
 * Un service écrit donc : `if (isRemote) return unwrap(await sdkFn())` sinon le chemin DAL.
 * Le reste du code (RSC, routes, actions) ignore ce détail.
 */

/** `true` dès qu'une base API distante est configurée (cutover Vercel). */
export const isRemote = Boolean(process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE);

/** Forme d'une réponse du SDK `@rpbey/api-client` (client-fetch). */
interface SdkResult<T> {
  data?: { ok: boolean; data: T } | undefined;
  error?: unknown;
}

/**
 * Déballe l'enveloppe `{ ok, data }` d'une réponse SDK et renvoie le payload.
 * Lève si la requête a échoué ou si l'enveloppe est en erreur.
 */
export function unwrap<T>(res: SdkResult<T>): T {
  if (res.error || !res.data?.ok) {
    throw new Error(
      `[data-source] appel SDK distant échoué : ${JSON.stringify(res.error ?? res.data)}`,
    );
  }
  return res.data.data;
}
