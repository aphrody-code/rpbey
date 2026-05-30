import "server-only";
import { getTournamentForAutoSync } from "@/server/dal/rankings";

type SyncKind = "wb" | "satr" | "stardust" | "global" | null;

/**
 * Décide quel ranking synchroniser pour un tournoi donné selon sa catégorie.
 *
 * Matching:
 *   - name ILIKE '%STARDUST%'    → stardust
 *   - name ILIKE '%WILD%' / '%WB%' (préfixe) → wb
 *   - name ILIKE '%SATR%' / '%BBT%' / '%SUN AFTER%' → satr
 *   - sinon → global (GlobalRanking basé sur tous les tournois RPB-natifs)
 */
export function classifyRanking(categoryName: string | null | undefined): SyncKind {
  if (!categoryName) return "global";
  const up = categoryName.toUpperCase();
  if (up.includes("STARDUST")) return "stardust";
  if (up.includes("WILD") || /\bWB\b/.test(up)) return "wb";
  if (up.includes("SATR") || up.includes("SUN AFTER") || up.includes("BBT")) return "satr";
  return "global";
}

/**
 * Appelé après qu'un tournoi passe en COMPLETE / ARCHIVED.
 * Dispatche vers la sync correcte en fonction de la catégorie.
 * Les imports dynamiques évitent une dépendance circulaire avec les server actions.
 */
export async function autoSyncRankingForTournament(
  tournamentId: string,
): Promise<{ triggered: SyncKind; success: boolean; error?: string }> {
  try {
    const t = await getTournamentForAutoSync(tournamentId);
    if (!t) return { triggered: null, success: false, error: "Tournament not found" };
    const kind = classifyRanking(t.tournamentCategory?.name);

    if (kind === "stardust") {
      const { syncStardustRanking } = await import("@/server/actions/stardust");
      const r = await syncStardustRanking();
      return {
        triggered: "stardust",
        success: r.success,
        error: r.success ? undefined : r.error,
      };
    }
    if (kind === "wb") {
      const { syncWbRanking } = await import("@/server/actions/wb");
      const r = await syncWbRanking();
      return {
        triggered: "wb",
        success: r.success,
        error: r.success ? undefined : (r as { error?: string }).error,
      };
    }
    if (kind === "satr") {
      const { syncSatrRanking } = await import("@/server/actions/satr");
      const r = await syncSatrRanking();
      return {
        triggered: "satr",
        success: r.success,
        error: r.success ? undefined : (r as { error?: string }).error,
      };
    }
    // Global : recalcul COMPLET (global_rankings + miroir profils, inscrits + non-inscrits).
    try {
      const { runFullRecalculation } = await import("@/server/services/rankings");
      await runFullRecalculation();
      return { triggered: "global", success: true };
    } catch (e) {
      return { triggered: "global", success: false, error: String(e) };
    }
  } catch (e) {
    return { triggered: null, success: false, error: String(e) };
  }
}
