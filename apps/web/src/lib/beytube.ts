/**
 * Façade BeyTube (Phase API-first) — la requête `youtubeVideos` vit désormais dans
 * `@/server/dal/stream` (seul importeur `@rpbey/db` du domaine). Ce module ne fait
 * plus que ré-exporter le type + la fonction, pour ne casser aucun appelant existant
 * tout en sortant `@rpbey/db` de `lib/`.
 */
export { type BeyTubeVideo, getBeyTubeFeatured } from "@/server/dal/stream";
