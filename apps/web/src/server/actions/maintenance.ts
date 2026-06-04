"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { autoSyncRankingForTournament } from "@/lib/auto-sync-ranking";
import { ChallongeScraper } from "@/lib/scrapers/challonge-scraper";
import {
  clearTournamentStandings,
  createImportedParticipant,
  createImportedUserWithProfile,
  findParticipant,
  getRankingSystemConfig,
  listCompletedTournamentIds,
  listUsersForMerge,
  listUsersWithProfileForImport,
  mergeUserInto,
  updateParticipantResult,
  updateRankingSystemConfig,
  upsertImportedMatch,
  upsertImportedTournament,
  upsertLibraryPart,
} from "@/server/dal/infra";
import { recalculateRankings } from "./ranking";

function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/^(satr_|satr |teamarc|team arc |bts[1-3]_|@)/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// 1. Recalculate Rankings
export async function actionRecalculateRankings() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const result = await recalculateRankings();
    return { success: true, message: result.message };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 2. Clean Duplicate Users (Stub merging)
export async function actionMergeDuplicates() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const allUsersRows = await listUsersForMerge();
    const allUsers = allUsersRows.map((u) => ({
      ...u,
      profile: u.profiles[0] ?? null,
    }));

    const stubs = allUsers.filter((u) => u.username?.match(/^bts[1-3]_/));
    const realUsers = allUsers.filter((u) => !u.username?.match(/^bts[1-3]_/));

    let mergedCount = 0;

    for (const stub of stubs) {
      const sName = normalizeName(stub.name || stub.username);
      if (!sName) continue;

      const bestMatch = realUsers.find((real) => {
        const rNames = [
          normalizeName(real.name),
          normalizeName(real.username),
          normalizeName(real.profile?.bladerName),
        ].filter((n) => n.length > 0);
        return rNames.some((rn) => rn === sName || rn.includes(sName) || sName.includes(rn));
      });

      if (bestMatch) {
        await mergeUserInto(stub.id, bestMatch.id, stub.profile?.id ?? null);
        mergedCount++;
      }
    }

    return { success: true, message: `${mergedCount} doublons fusionnés.` };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 3. Import Challonge Tournament
export async function actionImportTournament(slug: string) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  if (!slug) return { success: false, error: "Slug manquant" };

  const scraper = new ChallongeScraper();
  const normalizedSlug = slug.replace(/[^a-z0-9]/gi, "_");
  const tournamentId = `cm-${normalizedSlug.toLowerCase()}-auto`;
  const categoryId = "cmkxcqif90000rma3yonpba8r"; // BEY-TAMASHII SERIES

  try {
    const result = await scraper.scrape(slug);

    await upsertImportedTournament({
      id: tournamentId,
      name: result.metadata.name,
      challongeUrl: result.metadata.url,
      challongeId: String(result.metadata.id || ""),
      status: "COMPLETE",
      standings: result.standings,
      categoryId,
      description: result.raw.description || "",
    });

    const statsMap = new Map<number, { wins: number; losses: number }>();
    for (const m of result.matches) {
      if (m.state === "complete" && m.winnerId) {
        const w = statsMap.get(m.winnerId) || { wins: 0, losses: 0 };
        w.wins++;
        statsMap.set(m.winnerId, w);
        if (m.loserId) {
          const l = statsMap.get(m.loserId) || { wins: 0, losses: 0 };
          l.losses++;
          statsMap.set(m.loserId, l);
        }
      }
    }

    const allUsersRows = await listUsersWithProfileForImport();
    const allUsers = allUsersRows.map((u) => ({
      ...u,
      profile: u.profiles[0] ?? null,
    }));
    const challongeIdToUserId = new Map<number, string>();

    for (const p of result.participants) {
      const sName = normalizeName(p.name);
      let matchedUser: { id: string; profileId: string | null } | undefined = (() => {
        const found = allUsers.find((u) => {
          return (
            normalizeName(u.name) === sName ||
            normalizeName(u.username) === sName ||
            normalizeName(u.profile?.bladerName) === sName ||
            (p.challongeUsername &&
              normalizeName(u.username) === normalizeName(p.challongeUsername))
          );
        });
        return found ? { id: found.id, profileId: found.profile?.id ?? null } : undefined;
      })();

      if (!matchedUser) {
        matchedUser = await createImportedUserWithProfile({
          name: p.name,
          username: p.challongeUsername || `${normalizedSlug}_${sName}`,
          email: `${p.challongeUsername || sName}@placeholder.rpb`,
          bladerName: p.name,
        });
      }

      if (!matchedUser) continue;

      challongeIdToUserId.set(p.id, matchedUser.id);
      const stats = statsMap.get(p.id) || { wins: 0, losses: 0 };
      const standing = result.standings.find((s) => normalizeName(s.name) === sName);

      const existingPart = await findParticipant(tournamentId, matchedUser.id);

      if (existingPart) {
        await updateParticipantResult(existingPart.id, {
          finalPlacement: standing?.rank || p.finalRank || 999,
          wins: stats.wins,
          losses: stats.losses,
        });
      } else {
        await createImportedParticipant({
          tournamentId,
          userId: matchedUser.id,
          challongeParticipantId: String(p.id),
          finalPlacement: standing?.rank || p.finalRank || 999,
          wins: stats.wins,
          losses: stats.losses,
        });
      }
    }

    for (const m of result.matches) {
      const p1Id = m.player1Id ? challongeIdToUserId.get(m.player1Id) : null;
      const p2Id = m.player2Id ? challongeIdToUserId.get(m.player2Id) : null;
      const winnerId = m.winnerId ? challongeIdToUserId.get(m.winnerId) : null;

      if (!p1Id && !p2Id) continue;

      await upsertImportedMatch({
        id: `tm-${tournamentId}-${m.id}`,
        tournamentId,
        challongeMatchId: String(m.id),
        round: m.round,
        player1Id: p1Id || null,
        player2Id: p2Id || null,
        winnerId: winnerId || null,
        score: m.scores,
        state: m.state,
      });
    }

    revalidatePath("/admin/tournaments");

    // Auto-sync du ranking adéquat (stardust/wb/satr/global selon category)
    const autoSync = await autoSyncRankingForTournament(tournamentId);

    return {
      success: true,
      message: `Tournoi ${result.metadata.name} importé.${
        autoSync.triggered
          ? ` Ranking ${autoSync.triggered} ${autoSync.success ? "resynchronisé" : "erreur sync"}.`
          : ""
      }`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 4. Sync Bey-Library
export async function actionTriggerSyncParts() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  const { loadJsonSafe } = await import("@/lib/data-cache");

  try {
    const scrapedParts = await loadJsonSafe<any[]>("data/bey-library/bey-library-complete.json");
    if (!scrapedParts) {
      throw new Error("Impossible de charger data/bey-library/bey-library-complete.json");
    }

    for (const part of scrapedParts) {
      const system = part.code?.startsWith("UX") ? "UX" : part.code?.startsWith("CX") ? "CX" : "BX";
      await upsertLibraryPart({
        externalId: part.id,
        name: part.name,
        imageUrl: part.imageUrl,
        system,
        attack: part.specs?.Attack || "50",
        defense: part.specs?.Defense || "50",
        stamina: part.specs?.Stamina || "50",
        dash: part.specs?.Dash || "50",
        burst: part.specs?.Burst || "50",
      });
    }
    return {
      success: true,
      message: `${scrapedParts.length} pièces synchronisées.`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 5. Clear Cache
export async function actionClearTournamentCache() {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  try {
    const ids = await listCompletedTournamentIds();
    for (const id of ids) {
      await clearTournamentStandings(id);
    }

    revalidatePath("/rankings");
    return { success: true, message: "Cache des tournois vidé." };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 6. Ranking Config
export async function getRankingConfig() {
  return getRankingSystemConfig();
}

export async function actionUpdateRankingConfig(
  data: Record<string, string | number | Date> | null,
) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  if (!data) return { success: false, error: "Données manquantes" };
  const config = await getRankingSystemConfig();
  if (!config) return { success: false, error: "Config non trouvée" };

  try {
    await updateRankingSystemConfig(config.id, {
      participation: Number(data.participation),
      firstPlace: Number(data.firstPlace),
      secondPlace: Number(data.secondPlace),
      thirdPlace: Number(data.thirdPlace),
      matchWinWinner: Number(data.matchWinWinner),
      matchWinLoser: Number(data.matchWinLoser),
      top8: Number(data.top8),
    });
    return { success: true, message: "Barème mis à jour." };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
