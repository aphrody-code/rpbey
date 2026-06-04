/**
 * CORS OUVERT du serveur gacha — toute origine est admise.
 *
 * Colyseus pose son propre CORS au niveau du serveur HTTP brut (un
 * `prependListener('request')` dans @colyseus/core qui s'exécute AVANT
 * express). On override le controller du matchmaker (méthode documentée par
 * Colyseus) pour **refléter inconditionnellement** l'origine de la requête.
 *
 * Comme Colyseus envoie des cookies (auth de Room), `Allow-Credentials: true`
 * est requis — et `Access-Control-Allow-Origin: *` est alors illégal. On
 * reflète donc l'`Origin` reçue (+ `Vary: Origin`) ce qui admet TOUTES les
 * origines tout en restant compatible credentials. En l'absence d'`Origin`
 * (client non-navigateur / same-origin), on renvoie `FALLBACK_ORIGIN` (`*` par
 * défaut) — sans `Origin`, le navigateur ne fait aucune vérification CORS.
 */
import { matchMaker } from "@colyseus/core";
import { ALLOWED_HEADERS, ALLOWED_METHODS, FALLBACK_ORIGIN } from "./config";

export function configureCors(): void {
  const ctrl = matchMaker.controller as unknown as {
    DEFAULT_CORS_HEADERS: Record<string, string>;
    getCorsHeaders: (headers: Headers) => Record<string, string>;
  };

  ctrl.DEFAULT_CORS_HEADERS = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": FALLBACK_ORIGIN,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  // Reflet inconditionnel : toute origine reçue est renvoyée telle quelle.
  ctrl.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get("origin");
    return {
      "Access-Control-Allow-Origin": origin ?? FALLBACK_ORIGIN,
    };
  };
}
