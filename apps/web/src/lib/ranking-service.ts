import { runFullRecalculation } from "@/server/services/rankings";

/**
 * Façade `RankingService` — conservée pour ne pas casser les call-sites historiques
 * (`/api/admin/ranking` PUT, `lib/auto-sync-ranking`). Délègue désormais au chemin
 * COMPLET unique (`runFullRecalculation` dans `server/services/rankings`) : recalcule
 * `global_rankings` + miroir `profiles` pour TOUS les joueurs (inscrits via `userId`
 * ET non-inscrits via `playerName`, avec liaison nom→compte).
 *
 * L'ancienne implémentation inférieure (qui ignorait les non-inscrits via
 * `if(!p.userId) continue` et n'écrivait que `profiles`) a été supprimée.
 */
export const RankingService = {
  /** Recalcule le classement global complet (alias de `runFullRecalculation`). */
  async recalculateAll() {
    await runFullRecalculation();
  },
};
