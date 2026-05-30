/**
 * Réécriture d'URL d'image vers le proxy de détourage `/api/img`.
 *
 * Les images produits scrappées (Shopify, Amazon, Rakuten, boutiques FR…) sont
 * shootées sur **fond de studio blanc/clair**. Le proxy les re-sert en WebP avec
 * le fond rendu transparent (cf. `server/services/image-bg.ts`). Ce module est
 * **pur** (client + serveur, aucun import server-only) : il décide quelles URLs
 * passer par le proxy et porte l'**allowlist d'hôtes** partagée avec la route
 * (défense anti-SSRF — un proxy d'image ouvert laisserait atteindre des cibles
 * internes).
 */

/** Domaines de base autorisés (le sous-domaine `x.<base>` l'est aussi). */
export const ALLOWED_IMAGE_HOSTS: readonly string[] = [
  "shopify.com",
  "media-amazon.com",
  "ssl-images-amazon.com",
  "mercdn.net",
  "mercari-shops-static.com",
  "rakuten.co.jp",
  "zenmarket.jp",
  "mueller.de",
  "toupies-beyblade.fr",
  "beyblade-legend.fr",
  "beyblade-store.fr",
  "zatu.com",
  "wikia.nocookie.net", // visuels cartes gacha (renders perso/bey) souvent sur fond clair
];

/** `true` si `host` est un domaine autorisé (égal ou sous-domaine). */
export function isAllowedImageHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((base) => h === base || h.endsWith(`.${base}`));
}

/**
 * Réécrit une URL d'image distante vers `/api/img?u=…` si son hôte est autorisé.
 * URLs relatives/locales (assets curés `/images/…`) et hôtes hors allowlist :
 * renvoyées **inchangées** (pas de détourage, mais toujours affichables).
 */
export function proxyImage(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return url; // relatif / data: / local → tel quel
  try {
    const { hostname } = new URL(url);
    if (!isAllowedImageHost(hostname)) return url;
    return `/api/img?u=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
