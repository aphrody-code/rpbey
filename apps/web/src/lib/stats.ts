/**
 * RPB - User Stats Service (façade).
 *
 * Le code (requêtes Drizzle + calcul ELO) vit désormais dans la DAL
 * `@/server/dal/stats` (migration API-first, Phase 1.5). Ce module reste un
 * point d'import stable pour les appelants legacy ; il ne touche plus la DB.
 */
export {
  calculateEloChange,
  getHeadToHead,
  getLeaderboard,
  getUserStats,
  STARTING_ELO,
  type LeaderboardEntry,
  type UserStats,
} from "@/server/dal/stats";
