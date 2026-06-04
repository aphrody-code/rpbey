/**
 * Constantes d'équilibre du serveur gacha. Alignées sur ce que le bot affiche
 * (apps/bot/src/commands/General/EconomyGroup.ts) et le client
 * (apps/bot/src/lib/gacha-api.ts).
 */

export const PORT = Number(process.env.GACHA_PORT ?? process.env.PORT ?? "5050") || 5050;

/**
 * Adresse de bind. Défaut `0.0.0.0` : obligatoire sur Cloud Run (le conteneur
 * doit écouter sur toutes les interfaces, pas en loopback, sinon le proxy ne
 * peut pas router le trafic). Override possible via `GACHA_HOST`.
 */
export const HOST = process.env.GACHA_HOST ?? "0.0.0.0";

/** Base web pour rediriger les images de carte vers le rendu OG existant. */
export const WEB_BASE = process.env.WEB_BASE ?? "https://rpbey.fr";

/**
 * CORS OUVERT : aucune restriction d'origine. Comme Colyseus envoie des cookies
 * (auth de Room), on ne peut pas utiliser `Access-Control-Allow-Origin: *` avec
 * `Allow-Credentials: true` — on **reflète** donc l'origine de la requête (cf.
 * src/cors.ts). Toute origine est admise : le bot tape le serveur server-side
 * (pas de CORS), le client Discord Activity (`*.discordsays.com`) et la PWA web
 * passent tous, ainsi que tout autre client cross-origin.
 *
 * Quand aucune origine n'est présente (requête non-navigateur / same-origin),
 * on renvoie cette valeur fallback (l'absence d'`Origin` ne déclenche pas de
 * vérification CORS côté navigateur, donc c'est sans effet de gating).
 */
export const FALLBACK_ORIGIN = process.env.GACHA_FALLBACK_ORIGIN ?? "*";

/** Méthodes / headers CORS exposés. */
export const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
export const ALLOWED_HEADERS = "Authorization, Content-Type, X-Requested-With";

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

/**
 * Pity SR+ — hard pity garanti.
 * Un tirage sans SR+ au rang PITY_SR_THRESHOLD est forcé SUPER_RARE.
 * Doit etre > PITY_SR_SOFT_START.
 */
export const PITY_THRESHOLD = 10; // hard pity
export const PITY_SR_SOFT_START = 6; // le soft-pity commence a monter ici

/**
 * Pity LEGENDARY — hard pity garanti (compte les pulls depuis la derniere LEGENDARY+).
 * Soft pity demarre a PITY_LEGENDARY_SOFT_START.
 * Stocké hors DB (derive de l'historique des transactions), donc non persisté
 * entre sessions si le serveur redémarre ; c'est acceptable pour un gacha leger.
 */
export const PITY_LEGENDARY_THRESHOLD = 80; // hard pity legendary
export const PITY_LEGENDARY_SOFT_START = 60; // soft pity legendary

/**
 * Biais wishlist : poids multiplicatif appliqué aux cartes de la wishlist
 * du joueur lors du pickCard pondéré. 1.0 = aucun biais.
 */
export const WISHLIST_BIAS_WEIGHT = 3.0;

/**
 * Biais "nouvelle carte" : poids multiplicatif appliqué aux cartes non encore
 * possédées dans le pickCard pondéré. Réduit les doublons sans les supprimer.
 */
export const NEW_CARD_BIAS_WEIGHT = 2.0;

/**
 * Anti-doublon : si un joueur possede deja DUPE_CAP exemplaires d'une carte,
 * les doublons suivants sont automatiquement convertis en monnaie (prix de vente).
 * Mettre a Infinity pour desactiver.
 */
export const DUPE_CAP = 5;

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
