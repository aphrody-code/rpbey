import { z } from "zod";

/**
 * Schémas des SORTIES de scrapeurs — le contrat que chaque scrapeur bxc doit
 * produire pour alimenter correctement la DB / l'API. Validés par la fondation
 * `ghost-scraper` (validateRecords) avant écriture.
 */

// ── Produit catalogue (→ data/bx-catalog.json, consommé par le comparateur). ──
// Reflet de BxProduct (apps/web .../comparateur/_components/types.ts).
export const CatalogProductSchema = z.object({
  shop: z.string(),
  domain: z.string(),
  region: z.string(),
  type: z.string(),
  currency: z.string(),
  title: z.string().min(1),
  price: z.number().nullable(),
  priceMax: z.number().nullable(),
  priceEur: z.number().nullish(),
  available: z.boolean(),
  url: z.url(),
  image: z.string().nullable(),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

// ── Ligne d'import pièce (→ table `parts` @rpbey/db). ──
// Champs requis = colonnes notNull ; stats en TEXT ; timestamps gérés par la DB.
export const PartImportSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["BLADE", "RATCHET", "BIT", "ASSIST_BLADE", "LOCK_CHIP", "OVER_BLADE"]),
  nameJp: z.string().nullish(),
  beyType: z.enum(["ATTACK", "DEFENSE", "STAMINA", "BALANCE"]).nullish(),
  weight: z.number().nullish(),
  attack: z.string().nullish(),
  defense: z.string().nullish(),
  stamina: z.string().nullish(),
  burst: z.string().nullish(),
  dash: z.string().nullish(),
  height: z.number().int().nullish(),
  imageUrl: z.string().nullish(),
  rarity: z.string().nullish(),
  spinDirection: z.string().nullish(),
  system: z.string().nullish(),
});
export type PartImport = z.infer<typeof PartImportSchema>;

// ── Combo méta WBO (→ data/wbo-combos.json / enrichissement reco). ──
export const WboComboSchema = z.object({
  combo: z.string().min(1),
  blade: z.string().nullish(),
  ratchet: z.string().nullish(),
  bit: z.string().nullish(),
  usage: z.number().int().nonnegative().nullish(),
  topCut: z.number().int().nonnegative().nullish(),
  tier: z.enum(["S", "A", "B", "C"]).nullish(),
});
export type WboCombo = z.infer<typeof WboComboSchema>;

// ── Frame d'anime (→ table `anime_frames` @rpbey/db). ──
// Miroir exact des colonnes : seriesId/episodeId résolus à l'import (le scraper
// ne connaît que le slug + episodeNumber), sourceId unique par source,
// imageUrl/thumbUrl = URLs HD re-hébergées au moment de l'import.
//   - "fancaps" : sourceId = id image fancaps, imageUrl/thumbUrl = CDN proxifié.
//   - "fandom"  : sourceId = `<wiki>:<pageId>` (id de fichier MediaWiki, stable),
//                 imageUrl = URL static.wikia.nocookie.net directe (fetchable).
export const AnimeFrameImportSchema = z.object({
  source: z.enum(["fancaps", "fandom"]),
  sourceId: z.string().min(1),
  sourceUrl: z.url().nullish(),
  episodeNumber: z.number().int().positive().nullish(),
  imageUrl: z.url(),
  thumbUrl: z.url().nullish(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  characterNames: z.array(z.string()),
  tags: z.array(z.string()),
  caption: z.string().nullish(),
  isNotable: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});
export type AnimeFrameImport = z.infer<typeof AnimeFrameImportSchema>;

// ── Episode listé sur fancaps (numéro + id galerie + URL). ──
export const FancapsEpisodeSchema = z.object({
  number: z.number().int().positive(),
  fancapsId: z.string().min(1),
  url: z.url(),
  title: z.string().nullish(),
});
export type FancapsEpisode = z.infer<typeof FancapsEpisodeSchema>;

// ── Mapping perso → épisodes marquants (sortie map-character-episodes). ──
// notableEpisodes = début (AppearAnime) ∪ épisodes de combat (Featured Battles).
// battleEpisodes  = sous-ensemble "combat" — signal le plus fort (isNotable au merge).
export const CharacterEpisodeMapSchema = z.object({
  notableEpisodes: z.array(z.number().int().positive()),
  battleEpisodes: z.array(z.number().int().positive()).default([]),
  debutEpisode: z.number().int().positive().nullish(),
  role: z.string().nullish(),
});
export type CharacterEpisodeMap = z.infer<typeof CharacterEpisodeMapSchema>;

// ── Discussion Reddit (→ data/reddit-discussions.json, indexée par global-search). ──
// Shape aligné sur x-discussions.json pour une indexation identique : `text` =
// selftext du post (ou meilleur commentaire), `score`/`comments` = popularité.
// `id` = fullname Reddit (ex. "t3_abc123"), `subreddit` sans préfixe r/.
export const RedditDiscussionSchema = z.object({
  id: z.string().min(1),
  subreddit: z.string().min(1),
  author: z.string().min(1),
  title: z.string(),
  text: z.string(),
  score: z.number().int(),
  comments: z.number().int().nonnegative(),
  url: z.url(),
  createdAt: z.string().min(1),
});
export type RedditDiscussion = z.infer<typeof RedditDiscussionSchema>;
