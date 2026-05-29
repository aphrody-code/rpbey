/**
 * Pure version of auto-sync-ranking (no `server-only` import) for CLI scripts.
 * Re-exports classifyRanking from the runtime module's logic.
 */

export type SyncKind = "wb" | "satr" | "stardust" | "global" | null;

/**
 * Décide quel ranking synchroniser pour un tournoi donné selon sa catégorie.
 *
 * Matching:
 *   - name ILIKE '%STARDUST%'    → stardust
 *   - name ILIKE '%WILD%' / '%WB%' (préfixe) → wb
 *   - name ILIKE '%SATR%' / '%BBT%' / '%SUN AFTER%' → satr
 *   - sinon → global
 */
export function classifyRanking(categoryName: string | null | undefined): SyncKind {
  if (!categoryName) return "global";
  const up = categoryName.toUpperCase();
  if (up.includes("STARDUST")) return "stardust";
  if (up.includes("WILD") || /\bWB\b/.test(up)) return "wb";
  if (up.includes("SATR") || up.includes("SUN AFTER") || up.includes("BBT")) return "satr";
  return "global";
}
