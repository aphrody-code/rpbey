/**
 * Constantes d'équilibre du serveur gacha. Alignées sur ce que le bot affiche
 * (apps/bot/src/commands/General/EconomyGroup.ts) et le client
 * (apps/bot/src/lib/gacha-api.ts).
 */

export const PORT = Number(process.env.GACHA_PORT ?? process.env.PORT ?? "5050") || 5050;

/**
 * Adresse de bind. Défaut `127.0.0.1` : le serveur reste en loopback et n'est
 * exposé que via nginx (TLS + upgrade WS sur 443). Mettre `0.0.0.0` seulement
 * pour un accès direct (tests réseau local).
 */
export const HOST = process.env.GACHA_HOST ?? "127.0.0.1";

/** Base web pour rediriger les images de carte vers le rendu OG existant. */
export const WEB_BASE = process.env.WEB_BASE ?? "https://rpbey.fr";

/**
 * Origines autorisées en CORS. Le bot tape le serveur server-side (pas de
 * CORS), mais le **client Discord Activity** (navigateur dans l'iframe
 * `*.discordsays.com`) et la PWA `bot.rpbey.fr/play` font des fetch cross-origin.
 * Aligné sur l'allowlist du bot (apps/bot/src/lib/discord-activity.ts).
 *
 * - origines exactes : liste ci-dessous (+ `GACHA_EXTRA_ORIGINS` séparées par `,`)
 * - patterns dynamiques : tout sous-domaine `*.discordsays.com` (proxy Discord)
 *   et `*.vercel.app` (previews du site).
 */
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    "https://rpbey.fr",
    "https://www.rpbey.fr",
    "https://bot.rpbey.fr",
    "https://play.rpbey.fr",
    "https://discord.com",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    ...(process.env.GACHA_EXTRA_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].filter(Boolean),
);

/** Sous-domaines acceptés dynamiquement (proxy Discord Activity + previews Vercel). */
export const ALLOWED_ORIGIN_PATTERNS: readonly RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.discordsays\.com$/i,
  // Previews Vercel DU PROJET uniquement (pas tout `*.vercel.app` tiers).
  /^https:\/\/rpbey-[a-z0-9-]+\.vercel\.app$/i,
];

/** True si l'origine HTTP est autorisée (exacte ou pattern). */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/** Méthodes / headers CORS exposés. */
export const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With";

/**
 * Origine renvoyée quand l'origine de la requête n'est pas autorisée. Fixe et
 * canonique : un navigateur tiers reçoit un ACAO qui ne correspond pas à sa
 * propre origine → la réponse cross-origin est bloquée.
 */
export const FALLBACK_ORIGIN = "https://rpbey.fr";

export const PULL_COST = 50;
export const MULTI_PULL_COST = 450; // 10 tirages, ~10 % d'économie
export const MULTI_PULL_COUNT = 10;

export type Rarity = "COMMON" | "RARE" | "SUPER_RARE" | "LEGENDARY" | "SECRET";
export const SR_PLUS: Rarity[] = ["SUPER_RARE", "LEGENDARY", "SECRET"];
export const RARITY_ORDER: Rarity[] = ["COMMON", "RARE", "SUPER_RARE", "LEGENDARY", "SECRET"];

/** Table de tirage (somme = 100). `MISS` = aucune carte (tirage raté). */
export const RATES: { MISS: number } & Record<Rarity, number> = {
  MISS: 30,
  COMMON: 39,
  RARE: 18,
  SUPER_RARE: 9,
  LEGENDARY: 3,
  SECRET: 1,
};

/** Pity : après N tirages sans SR+, le suivant est un SUPER_RARE garanti. */
export const PITY_THRESHOLD = 3;

export const SELL_PRICE: Record<Rarity, number> = {
  COMMON: 5,
  RARE: 15,
  SUPER_RARE: 50,
  LEGENDARY: 150,
  SECRET: 500,
};

export const DAILY_BASE = 50;
export const DAILY_COOLDOWN_H = 20; // un claim toutes les ~20 h
export const STREAK_RESET_H = 48; // au-delà, le streak retombe à 1
export const DEBT_INTEREST = 0.15; // intérêts quotidiens sur currency < 0

/** Paliers de streak (bonus ponctuel au franchissement du jour). */
export const STREAK_MILESTONES = [
  { days: 3, bonus: 50, label: "3 jours" },
  { days: 7, bonus: 150, label: "7 jours" },
  { days: 14, bonus: 300, label: "14 jours" },
  { days: 30, bonus: 750, label: "30 jours" },
];

/** Badges de collection (nb de cartes uniques). */
export const BADGES = [
  { count: 5, name: "Débutant", emoji: "🥉", reward: 200 },
  { count: 10, name: "Collectionneur", emoji: "🥈", reward: 500 },
  { count: 15, name: "Passionné", emoji: "🥇", reward: 750 },
  { count: 20, name: "Expert", emoji: "💎", reward: 1000 },
  { count: 25, name: "Maître", emoji: "👑", reward: 1500 },
  { count: 31, name: "Légende", emoji: "🏆", reward: 3000 },
];

export const GIFT_COOLDOWN_H = 12;

/** Coût de fusion : nb de doublons d'une rareté à brûler pour monter d'un cran. */
export const FUSION_DUPES_REQUIRED = 3;
