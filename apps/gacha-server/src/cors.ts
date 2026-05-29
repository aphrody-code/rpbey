/**
 * CORS du serveur gacha.
 *
 * Colyseus pose son propre CORS au niveau du serveur HTTP brut (un
 * `prependListener('request')` dans @colyseus/core qui s'exécute AVANT
 * express). Ses défauts sont permissifs : `Access-Control-Allow-Origin: *`
 * et `getCorsHeaders()` reflète n'importe quelle origine, avec
 * `Allow-Credentials: true`. Un middleware express ne peut donc pas restreindre
 * l'origine — il faut overrider le controller du matchmaker (méthode
 * documentée par Colyseus).
 *
 * On reflète l'origine UNIQUEMENT si elle est autorisée (cf. isAllowedOrigin) ;
 * sinon on renvoie une origine canonique fixe (`rpbey.fr`) qui ne matchera pas
 * celle d'un site tiers → le navigateur bloque la réponse cross-origin.
 */
import { matchMaker } from "@colyseus/core";
import { ALLOWED_HEADERS, ALLOWED_METHODS, FALLBACK_ORIGIN, isAllowedOrigin } from "./config";

export function configureCors(): void {
  const ctrl = matchMaker.controller as unknown as {
    DEFAULT_CORS_HEADERS: Record<string, string>;
    getCorsHeaders: (headers: Headers) => Record<string, string>;
  };

  // Durcit les défauts (méthodes/headers explicites, plus de `*`).
  ctrl.DEFAULT_CORS_HEADERS = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": FALLBACK_ORIGIN,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  // Reflet conditionnel : origine autorisée → reflet ; sinon origine fixe.
  ctrl.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get("origin") ?? undefined;
    return {
      "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : FALLBACK_ORIGIN,
    };
  };
}
