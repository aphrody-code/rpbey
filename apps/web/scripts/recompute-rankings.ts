/**
 * Recalcul one-shot du classement global RPB (CLI).
 *
 * Combine toutes les stats de chaque joueur dans chaque tournoi (placement, victoires de
 * match, participation) + JSON BTS + ajustements manuels, applique la liaison nom→compte,
 * puis réécrit `global_rankings` + miroir `profiles` (inscrits ET non-inscrits).
 *
 * Réutilise EXACTEMENT le chemin serveur (`runFullRecalculation` → fonction pure
 * `computeRankings` + DAL), donc aucune divergence avec l'admin/auto-sync. Idempotent
 * (le rebuild est un reset+reinsert transactionnel).
 *
 * Lancer :  cd apps/web && bun --preload ./scripts/_preload-server-only.ts scripts/recompute-rankings.ts
 *           (ou directement `bun scripts/recompute-rankings.ts` — le stub est chargé en tête)
 */
import { plugin } from "bun";

// Neutralise `import "server-only"` (les modules service en dépendent) AVANT tout import.
plugin({
  name: "server-only-stub",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});

const { db, schema } = await import("@rpbey/db");
const { sql, desc } = await import("drizzle-orm");
const { runFullRecalculation } = await import("@/server/services/rankings");

async function main() {
  const before = await db.select({ c: sql<number>`count(*)` }).from(schema.globalRankings);
  console.log(`[recompute] global_rankings avant : ${before[0]?.c ?? 0} ligne(s).`);

  const { playersRanked, linkedToUser } = await runFullRecalculation();

  // Relecture pour vérification post-rebuild.
  const grRows = await db
    .select({
      playerName: schema.globalRankings.playerName,
      points: schema.globalRankings.points,
      wins: schema.globalRankings.wins,
      losses: schema.globalRankings.losses,
      tournamentsCount: schema.globalRankings.tournamentsCount,
      userId: schema.globalRankings.userId,
    })
    .from(schema.globalRankings)
    .orderBy(
      desc(schema.globalRankings.points),
      desc(schema.globalRankings.tournamentWins),
      desc(schema.globalRankings.wins),
    );
  const totalRanked = grRows.length;
  const linkedDb = grRows.filter((r) => r.userId).length;

  // Profils mis à jour : profils dont rankingPoints > 0 (miroir des rows liées non nulles).
  const profActive = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.profiles)
    .where(sql`${schema.profiles.rankingPoints} > 0`);

  console.log("\n=== RÉSULTAT RECALCUL CLASSEMENT GLOBAL ===");
  console.log(`Joueurs classés         : ${totalRanked} (compute: ${playersRanked})`);
  console.log(`Liés à un compte (userId): ${linkedDb} (compute: ${linkedToUser})`);
  console.log(`Profils avec points > 0  : ${profActive[0]?.c ?? 0}`);

  console.log("\n=== TOP 10 (nom · points · W-L · tournois) ===");
  for (const [i, r] of grRows.slice(0, 10).entries()) {
    const rank = String(i + 1).padStart(2, " ");
    const name = (r.playerName || "?").padEnd(24, " ").slice(0, 24);
    const pts = String(r.points).padStart(7, " ");
    const wl = `${r.wins}-${r.losses}`.padStart(7, " ");
    const tourn = String(r.tournamentsCount).padStart(2, " ");
    const link = r.userId ? "✓compte" : "";
    console.log(`${rank}. ${name} · ${pts} pts · ${wl} · ${tourn} tournois ${link}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("[recompute] échec :", e);
  process.exit(1);
});
