/**
 * Configuration build-time (lue via `import.meta.env`, jamais de secret en dur).
 *
 * Toutes les variables sont préfixées `VITE_` pour être exposées au bundle par
 * Vite. Les défauts pointent vers la prod (api.rpbey.fr / rpbey.fr) afin que le
 * build fonctionne sans `.env` ; un `.env.local` peut surcharger pour le dev.
 *
 *   VITE_DISCORD_CLIENT_ID   — Application (Client) ID du Dev Portal Discord.
 *   VITE_GACHA_WS_URL        — endpoint Colyseus (WSS prod / ws local).
 *   VITE_GACHA_REST_URL      — base REST économie (serveur gacha).
 *   VITE_WEB_BASE            — base du web (frames anime + image carte OG).
 *
 * Note Discord Activity : à l'intérieur du client Discord, tout le trafic réseau
 * passe par le proxy `/.proxy/<mapping>`. On détecte ce contexte au runtime et
 * on réécrit les URL absolues vers le chemin proxifié (voir `proxifyUrl`).
 */

const env = import.meta.env as Record<string, string | undefined>;

function pick(key: string, fallback: string): string {
  const v = env[key];
  return v && v.length > 0 ? v : fallback;
}

export const DISCORD_CLIENT_ID = pick("VITE_DISCORD_CLIENT_ID", "");

/** Endpoint temps réel Colyseus. */
export const GACHA_WS_URL = pick("VITE_GACHA_WS_URL", "wss://api.rpbey.fr/gacha");

/** Base REST économie (sans slash final). */
export const GACHA_REST_URL = pick("VITE_GACHA_REST_URL", "https://api.rpbey.fr/gacha").replace(
  /\/+$/,
  "",
);

/** Base du web (frames anime + image carte OG, sans slash final). */
export const WEB_BASE = pick("VITE_WEB_BASE", "https://rpbey.fr").replace(/\/+$/, "");

/** `true` si on tourne dans le client Discord (Activity), embarqué en iframe. */
export const IS_DISCORD = isDiscordEmbedded();

function isDiscordEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  // Discord injecte `frame_id` dans la query au lancement d'une Activity, et
  // l'iframe est servie depuis *.discordsays.com.
  const params = new URLSearchParams(window.location.search);
  if (params.has("frame_id")) return true;
  return /\.discordsays\.com$/.test(window.location.hostname);
}

/**
 * À l'intérieur de Discord, les requêtes externes doivent passer par le proxy
 * de l'Activity (`/.proxy/<mapping>/...`) pour respecter la CSP. Hors Discord on
 * renvoie l'URL absolue telle quelle.
 *
 * Le mapping `/.proxy/api` → `api.rpbey.fr` et `/.proxy/web` → `rpbey.fr` doit
 * être déclaré dans le Dev Portal (URL Mappings). Voir docs/gacha/activity-client.md.
 */
export function proxifyUrl(absolute: string, mapping: string): string {
  if (!IS_DISCORD) return absolute;
  try {
    const u = new URL(absolute);
    return `${window.location.origin}/.proxy/${mapping}${u.pathname}${u.search}`;
  } catch {
    return absolute;
  }
}
