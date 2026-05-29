/**
 * Finalize a Challonge tournament: scrape full data, persist to DB, mark COMPLETE,
 * trigger ranking sync (stardust/satr/wb/global selon catégorie).
 *
 * Gère les formats two-stage (pools + bracket): on compte tous les matches `complete`,
 * pools comme bracket, le ranking se base sur match.state + finalPlacement.
 *
 * Usage:
 *   bun scripts/finalize-tournament.ts T_SS1
 *   bun scripts/finalize-tournament.ts https://challonge.com/fr/T_SS1
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ChallongeScraper } from "@rose-griffon/challonge";
// Phase 4: import is already from @rose-griffon/challonge workspace dep (no change needed).
import { prisma } from "../src/lib/prisma";
import { classifyRanking } from "../src/lib/auto-sync-ranking-pure";
import { syncStardustRankingsToDb } from "../src/lib/stardust-sync-bts";

function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const [before] = raw.split("/");
  return (before ?? raw).trim();
}

function extractSlug(input: string): string {
  return input
    .replace(/^https?:\/\/challonge\.com\//i, "")
    .replace(/^fr\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\//, "")
    .trim();
}

async function main() {
  const args = process.argv.slice(2);
  const arg = args.find((a) => !a.startsWith("--"));
  const syncOnly = args.includes("--sync-only");
  const keepName = args.includes("--keep-name") || syncOnly;
  if (!arg) {
    console.error(
      "Usage: bun scripts/finalize-tournament.ts <slug-or-url> [--sync-only] [--keep-name]",
    );
    process.exit(1);
  }
  const slug = extractSlug(arg);
  console.log(`📡 ${syncOnly ? "Sync-only" : "Scraping"} ${slug} ...`);

  // 1. Locate tournament in DB by challongeId/Url
  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [{ challongeId: slug }, { challongeUrl: { contains: slug } }],
    },
    include: { category: true },
  });

  if (!tournament) {
    console.error(`❌ Aucun tournoi trouvé en DB pour slug "${slug}"`);
    process.exit(1);
  }

  console.log(`🎯 Tournoi DB: ${tournament.name} (id=${tournament.id})`);
  console.log(`   catégorie: ${tournament.category?.name ?? "sans catégorie"}`);
  console.log(`   status actuel: ${tournament.status}`);

  // 2. Scrape full payload (skipped en mode --sync-only)
  let scraped: Awaited<ReturnType<ChallongeScraper["scrape"]>> | null = null;

  if (!syncOnly) {
    const scraper = new ChallongeScraper({
      log: (msg) => console.log(`   ${msg}`),
    });
    try {
      scraped = await scraper.scrape(slug, {
        withStandings: true,
        withStations: true,
        withLog: true,
        withParticipants: true,
      });
    } finally {
      await scraper.close().catch(() => {});
    }
  } else {
    console.log(`   ⏭  Scraping ignoré (--sync-only)`);
  }

  // 3. Phase breakdown — log pools vs bracket
  if (scraped) {
    const matches = scraped.matches;
    const poolMatches = matches.filter((m) => m.groupId != null);
    const bracketMatches = matches.filter((m) => m.groupId == null);
    const completePool = poolMatches.filter((m) => m.state === "complete");
    const completeBracket = bracketMatches.filter((m) => m.state === "complete");

    console.log(`\n📊 Breakdown matches:`);
    console.log(`   pools  : ${poolMatches.length} (complete: ${completePool.length})`);
    console.log(`   bracket: ${bracketMatches.length} (complete: ${completeBracket.length})`);
    console.log(
      `   total  : ${matches.length} (complete: ${completePool.length + completeBracket.length})`,
    );
    console.log(`   participants: ${scraped.participants.length}`);
    console.log(`   standings   : ${scraped.standings.length}`);

    // 4. Dump scrape result to disk for audit
    const dumpDir = path.join(process.cwd(), "data/scrapes");
    await mkdir(dumpDir, { recursive: true });
    const dumpPath = path.join(
      dumpDir,
      `${slug}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await Bun.write(dumpPath, JSON.stringify(scraped, null, 2));
    console.log(`\n💾 Dump: ${dumpPath}`);
  }

  if (scraped) {
    // 5. Resolve user mappings (soft — match by name/username/profile.bladerName, never create)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        profile: { select: { bladerName: true } },
      },
    });

    const userByKey = new Map<string, string>();
    for (const u of allUsers) {
      for (const candidate of [u.name, u.username, u.profile?.bladerName]) {
        const k = normalizeName(candidate ?? undefined).toLowerCase();
        if (k) userByKey.set(k, u.id);
      }
    }

    const challongeIdToUser = new Map<number, string | null>();
    const challongeIdToName = new Map<number, string>();
    for (const p of scraped.participants) {
      const cleanName = normalizeName(p.name);
      challongeIdToName.set(p.id, cleanName);
      const userId = userByKey.get(cleanName.toLowerCase()) ?? null;
      challongeIdToUser.set(p.id, userId);
    }

    const matchedUserCount = [...challongeIdToUser.values()].filter(Boolean).length;
    console.log(`👤 Users matched: ${matchedUserCount}/${scraped.participants.length}`);

    const matches = scraped.matches;

    // 6. Update Tournament row
    const completedAt = scraped.metadata.completedAt
      ? new Date(scraped.metadata.completedAt)
      : scraped.metadata.startedAt
        ? new Date(scraped.metadata.startedAt)
        : new Date();

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        status: "COMPLETE",
        challongeState: scraped.metadata.state,
        standings: scraped.standings as never,
        stations: scraped.stations as never,
        activityLog: scraped.log as never,
        date: completedAt,
        name: keepName ? tournament.name : (scraped.metadata.name ?? tournament.name),
      },
    });
    console.log(
      `✅ Tournament marqué COMPLETE (date=${completedAt.toISOString()})${keepName ? " [name préservé]" : ""}`,
    );

    // 7. Upsert participants
    let pCreated = 0;
    let pUpdated = 0;
    for (const p of scraped.participants) {
      const cleanName = normalizeName(p.name);
      const userId = challongeIdToUser.get(p.id) ?? null;
      const standing = scraped.standings.find(
        (s) => normalizeName(s.name).toLowerCase() === cleanName.toLowerCase(),
      );
      const finalPlacement = standing?.rank ?? p.finalRank ?? null;

      // Per-participant W/L from completed matches
      let wins = 0;
      let losses = 0;
      for (const m of matches) {
        if (m.state !== "complete") continue;
        if (m.winnerId === p.id) wins++;
        else if (m.loserId === p.id) losses++;
      }

      const existing = await prisma.tournamentParticipant.findFirst({
        where: {
          tournamentId: tournament.id,
          OR: [
            { challongeParticipantId: String(p.id) },
            { playerName: cleanName },
            ...(userId ? [{ userId }] : []),
          ],
        },
      });

      if (existing) {
        await prisma.tournamentParticipant.update({
          where: { id: existing.id },
          data: {
            challongeParticipantId: String(p.id),
            playerName: cleanName,
            userId: existing.userId ?? userId,
            finalPlacement: finalPlacement ?? existing.finalPlacement,
            wins,
            losses,
            seed: p.seed,
            checkedIn: true,
          },
        });
        pUpdated++;
      } else {
        await prisma.tournamentParticipant.create({
          data: {
            tournamentId: tournament.id,
            challongeParticipantId: String(p.id),
            playerName: cleanName,
            userId,
            finalPlacement,
            wins,
            losses,
            seed: p.seed,
            checkedIn: true,
          },
        });
        pCreated++;
      }
    }
    console.log(`👥 Participants: ${pCreated} créés, ${pUpdated} updatés`);

    // 8. Upsert matches (pools + bracket en une passe)
    let mCreated = 0;
    let mUpdated = 0;
    for (const m of matches) {
      const player1Name = m.player1Id ? (challongeIdToName.get(m.player1Id) ?? null) : null;
      const player2Name = m.player2Id ? (challongeIdToName.get(m.player2Id) ?? null) : null;
      const winnerName = m.winnerId ? (challongeIdToName.get(m.winnerId) ?? null) : null;
      const player1Uid = m.player1Id ? (challongeIdToUser.get(m.player1Id) ?? null) : null;
      const player2Uid = m.player2Id ? (challongeIdToUser.get(m.player2Id) ?? null) : null;
      const winnerUid = m.winnerId ? (challongeIdToUser.get(m.winnerId) ?? null) : null;

      const existing = await prisma.tournamentMatch.findUnique({
        where: {
          tournamentId_challongeMatchId: {
            tournamentId: tournament.id,
            challongeMatchId: String(m.id),
          },
        },
      });

      const data = {
        round: m.round,
        player1Id: player1Uid,
        player2Id: player2Uid,
        winnerId: winnerUid,
        player1Name,
        player2Name,
        winnerName,
        score: m.scores,
        state: m.state,
      };

      if (existing) {
        await prisma.tournamentMatch.update({
          where: { id: existing.id },
          data,
        });
        mUpdated++;
      } else {
        await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            challongeMatchId: String(m.id),
            ...data,
          },
        });
        mCreated++;
      }
    }
    console.log(`🥊 Matches: ${mCreated} créés, ${mUpdated} updatés`);
  } // end if (scraped)

  // 9. Trigger ranking auto-sync (dispatch via classifyRanking, dynamic imports
  //    pour éviter la dépendance `server-only` quand on s'exécute en CLI Bun).
  const kind = classifyRanking(tournament.category?.name);
  console.log(`\n🏆 Sync ranking → ${kind}`);

  let sync: { triggered: typeof kind; success: boolean; error?: string } = {
    triggered: kind,
    success: false,
  };

  if (kind === "stardust") {
    const r = await syncStardustRankingsToDb(prisma);
    sync = {
      triggered: "stardust",
      success: r.success,
      error: r.success ? undefined : r.error,
    };
  } else if (kind === "wb") {
    const { syncWbRanking } = await import("../src/server/actions/wb");
    const r = await syncWbRanking();
    sync = {
      triggered: "wb",
      success: r.success,
      error: r.success ? undefined : (r as { error?: string }).error,
    };
  } else if (kind === "satr") {
    const { syncSatrRanking } = await import("../src/server/actions/satr");
    const r = await syncSatrRanking();
    sync = {
      triggered: "satr",
      success: r.success,
      error: r.success ? undefined : (r as { error?: string }).error,
    };
  } else {
    try {
      const { RankingService } = await import("../src/lib/ranking-service");
      await RankingService.recalculateAll();
      sync = { triggered: "global", success: true };
    } catch (e) {
      sync = { triggered: "global", success: false, error: String(e) };
    }
  }

  console.log(
    `   triggered=${sync.triggered} success=${sync.success}${sync.error ? ` error=${sync.error}` : ""}`,
  );

  // 10. Print top 10 of the relevant ranking
  if (sync.triggered === "stardust") {
    const top = await prisma.stardustRanking.findMany({
      orderBy: { rank: "asc" },
      take: 10,
    });
    console.log(`\n🌠 Stardust top 10:`);
    for (const r of top) {
      console.log(
        `   #${String(r.rank).padStart(2)} ${r.playerName.padEnd(20)} score=${r.score.toString().padStart(7)} ${r.wins}W/${r.losses}L  ${r.winRate}  pa=${r.pointsAverage}  part=${r.participation}`,
      );
    }
  }

  await prisma.$disconnect();
  console.log(`\n✨ Done.`);
}

main().catch((err) => {
  console.error("💥 Erreur:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
