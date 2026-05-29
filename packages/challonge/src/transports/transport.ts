/**
 * Transport — interface neutre extraite de BxcTransport (additif, M1).
 *
 * Décrit la forme publique stable d'un transport HTTP impersonating tel que
 * `BxcTransport` l'expose déjà : `fetch(url, opts?)` + `close?()`. Aucun
 * comportement n'est introduit ici ; cette interface re-décrit l'existant pour
 * permettre une injection par interface (P2, hors scope ici).
 *
 * Les types ne sont PAS dupliqués : ils sont ré-exportés sous des noms neutres
 * depuis la couche bxc (`./bxc` pour les options de requête,
 * `./curl-impersonate-types` pour la forme de réponse).
 */

import type { BxcFetchOptions } from "./bxc";
import type { CurlImpersonateResponse, RedirectInfo } from "./curl-impersonate-types";

/** Options de requête par appel (alias neutre de `BxcFetchOptions`). */
export type TransportRequest = BxcFetchOptions;

/**
 * Retour d'un `fetch` de transport : réponse complète, ou information de
 * redirection cross-host quand `safeRedirects` est actif (alias neutre de
 * l'union `CurlImpersonateResponse | RedirectInfo`).
 */
export type TransportResponse = CurlImpersonateResponse | RedirectInfo;

/** Contrat structurel d'un transport HTTP (matche `BxcTransport`). */
export interface Transport {
  fetch(url: string, opts?: TransportRequest): Promise<TransportResponse>;
  close?(): void;
}
