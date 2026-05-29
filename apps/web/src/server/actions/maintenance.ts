"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { autoSyncRankingForTournament } from "@/lib/auto-sync-ranking";
import { db, schema, and, eq, inArray } from "@/lib/db";
import { ChallongeScraper } from "@/lib/scrapers/challonge-scraper";
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
    const allUsersRows = await db.query.users.findMany({
      with: {
        profiles: true,
        tournamentParticipants: true,
        decks: true,
        seasonEntries: true,
      },
    });
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
        await db
          .update(schema.tournamentParticipants)
          .set({ userId: bestMatch.id })
          .where(eq(schema.tournamentParticipants.userId, stub.id));
        await db
          .update(schema.tournamentMatches)
          .set({ player1Id: bestMatch.id })
          .where(eq(schema.tournamentMatches.player1Id, stub.id));
        await db
          .update(schema.tournamentMatches)
          .set({ player2Id: bestMatch.id })
          .where(eq(schema.tournamentMatches.player2Id, stub.id));
        await db
          .update(schema.tournamentMatches)
          .set({ winnerId: bestMatch.id })
          .where(eq(schema.tournamentMatches.winnerId, stub.id));

        if (stub.profile)
          await db.delete(schema.profiles).where(eq(schema.profiles.id, stub.profile.id));
        await db.delete(schema.users).where(eq(schema.users.id, stub.id));
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

    await db
      .insert(schema.tournaments)
      .values({
        id: tournamentId,
        name: result.metadata.name,
        challongeUrl: result.metadata.url,
        challongeId: String(result.metadata.id || ""),
        date: new Date().toISOString(),
        status: "COMPLETE",
        standings: result.standings as never,
        categoryId: categoryId,
        description: result.raw.description || "",
      })
      .onConflictDoUpdate({
        target: schema.tournaments.id,
        set: {
          name: result.metadata.name,
          challongeUrl: result.metadata.url,
          challongeId: String(result.metadata.id || ""),
          status: "COMPLETE",
          standings: result.standings as never,
          categoryId: categoryId,
          description: result.raw.description || "",
        },
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

    const allUsersRows = await db.query.users.findMany({
      with: { profiles: true },
    });
    const allUsers = allUsersRows.map((u) => ({
      ...u,
      profile: u.profiles[0] ?? null,
    }));
    const challongeIdToUserId = new Map<number, string>();

    for (const p of result.participants) {
      const sName = normalizeName(p.name);
      let matchedUser: { id: string; profile: (typeof allUsers)[number]["profile"] } | undefined =
        allUsers.find((u) => {
          return (
            normalizeName(u.name) === sName ||
            normalizeName(u.username) === sName ||
            normalizeName(u.profile?.bladerName) === sName ||
            (p.challongeUsername &&
              normalizeName(u.username) === normalizeName(p.challongeUsername))
          );
        });

      if (!matchedUser) {
        const [createdUser] = await db
          .insert(schema.users)
          .values({
            id: crypto.randomUUID(),
            name: p.name,
            username: p.challongeUsername || `${normalizedSlug}_${sName}`,
            email: `${p.challongeUsername || sName}@placeholder.rpb`,
          })
          .returning();
        const [createdProfile] = await db
          .insert(schema.profiles)
          .values({
            userId: createdUser!.id,
            bladerName: p.name,
            rankingPoints: 0,
          })
          .returning();
        matchedUser = { id: createdUser!.id, profile: createdProfile ?? null };
      }

      if (!matchedUser) continue;

      challongeIdToUserId.set(p.id, matchedUser.id);
      const stats = statsMap.get(p.id) || { wins: 0, losses: 0 };
      const standing = result.standings.find((s) => normalizeName(s.name) === sName);

      const existingPart = await db.query.tournamentParticipants.findFirst({
        where: and(
          eq(schema.tournamentParticipants.tournamentId, tournamentId),
          eq(schema.tournamentParticipants.userId, matchedUser.id),
        ),
      });

      if (existingPart) {
        await db
          .update(schema.tournamentParticipants)
          .set({
            finalPlacement: standing?.rank || p.finalRank || 999,
            wins: stats.wins,
            losses: stats.losses,
          })
          .where(eq(schema.tournamentParticipants.id, existingPart.id));
      } else {
        await db.insert(schema.tournamentParticipants).values({
          tournamentId,
          userId: matchedUser.id,
          challongeParticipantId: String(p.id),
          finalPlacement: standing?.rank || p.finalRank || 999,
          wins: stats.wins,
          losses: stats.losses,
          checkedIn: true,
        });
      }
    }

    for (const m of result.matches) {
      const p1Id = m.player1Id ? challongeIdToUserId.get(m.player1Id) : null;
      const p2Id = m.player2Id ? challongeIdToUserId.get(m.player2Id) : null;
      const winnerId = m.winnerId ? challongeIdToUserId.get(m.winnerId) : null;

      if (!p1Id && !p2Id) continue;

      await db
        .insert(schema.tournamentMatches)
        .values({
          id: `tm-${tournamentId}-${m.id}`,
          tournamentId,
          challongeMatchId: String(m.id),
          round: m.round,
          player1Id: p1Id || null,
          player2Id: p2Id || null,
          winnerId: winnerId || null,
          score: m.scores,
          state: m.state,
        })
        .onConflictDoUpdate({
          target: [
            schema.tournamentMatches.tournamentId,
            schema.tournamentMatches.challongeMatchId,
          ],
          set: {
            player1Id: p1Id,
            player2Id: p2Id,
            winnerId,
            score: m.scores,
            state: m.state,
          },
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
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  try {
    const DATA_FILE = path.join(process.cwd(), "data/bey-library/bey-library.json");
    const rawData = await fs.readFile(DATA_FILE, "utf-8");
    const scrapedParts = JSON.parse(rawData);

    for (const part of scrapedParts) {
      const system = part.code?.startsWith("UX") ? "UX" : part.code?.startsWith("CX") ? "CX" : "BX";
      await db
        .insert(schema.parts)
        .values({
          externalId: part.id,
          name: part.name,
          type: "BLADE",
          imageUrl: part.imageUrl,
          system: system,
          attack: part.specs.Attack || "50",
          defense: part.specs.Defense || "50",
          stamina: part.specs.Stamina || "50",
          dash: part.specs.Dash || "50",
          burst: part.specs.Burst || "50",
        })
        .onConflictDoUpdate({
          target: schema.parts.externalId,
          set: {
            name: part.name,
            imageUrl: part.imageUrl,
            system: system,
            attack: part.specs.Attack || undefined,
            defense: part.specs.Defense || undefined,
            stamina: part.specs.Stamina || undefined,
            dash: part.specs.Dash || undefined,
            burst: part.specs.Burst || undefined,
          },
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
    const tournaments = await db.query.tournaments.findMany({
      where: inArray(schema.tournaments.status, ["COMPLETE", "ARCHIVED"]),
    });

    for (const t of tournaments) {
      await db
        .update(schema.tournaments)
        .set({ standings: [] as never })
        .where(eq(schema.tournaments.id, t.id));
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
  return await db.query.rankingSystem.findFirst();
}

export async function actionUpdateRankingConfig(
  data: Record<string, string | number | Date> | null,
) {
  if (!(await requireAdmin())) throw new Error("Forbidden");
  if (!data) return { success: false, error: "Données manquantes" };
  const config = await db.query.rankingSystem.findFirst();
  if (!config) return { success: false, error: "Config non trouvée" };

  try {
    await db
      .update(schema.rankingSystem)
      .set({
        participation: Number(data.participation),
        firstPlace: Number(data.firstPlace),
        secondPlace: Number(data.secondPlace),
        thirdPlace: Number(data.thirdPlace),
        matchWinWinner: Number(data.matchWinWinner),
        matchWinLoser: Number(data.matchWinLoser),
        top8: Number(data.top8),
      })
      .where(eq(schema.rankingSystem.id, config.id));
    return { success: true, message: "Barème mis à jour." };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
