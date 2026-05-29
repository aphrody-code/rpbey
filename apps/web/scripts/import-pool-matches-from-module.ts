/**
 * Importe les matches de poule depuis le JSON parsé du HTML `/module`
 * Challonge (source officielle, plus fiable que le scrape `/log`).
 *
 * Remplace les 82 matches pool actuels (sentinel `round=-100`) par les 85
 * extraits du HTML, en préservant les `challongeMatchId` Challonge réels.
 *
 * Usage: bun scripts/import-pool-matches-from-module.ts T_SS1
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const TOURNAMENT_ID_BY_SLUG: Record<string, string> = {
  T_SS1: "cmobvakra0001s7rog85nt10h",
};

interface ParsedMatch {
  matchId: string;
  groupName: string;
  winner?: string;
  loser?: string;
  state: string;
}

interface ParsedGroup {
  name: string;
  participants: Array<{
    rank: number | null;
    displayName: string;
    challongeUsername: string | null;
    advanced: boolean;
    wins: number;
    losses: number;
    ties: number;
    setWins: number;
    pts: number;
    matchHistory: Array<{ matchId: string; result: string }>;
  }>;
}

interface ParseDump {
  slug: string;
  groupsCount: number;
  participantsCount: number;
  matchesCount: number;
  groups: ParsedGroup[];
  matches: ParsedMatch[];
}

const POOL_ROUND_SENTINEL = -100;

function normalizeName(raw: string): string {
  const [before] = raw.split("/");
  return (before ?? raw).trim();
}

async function main() {
  const slug = process.argv[2];
  const tournamentId = slug && TOURNAMENT_ID_BY_SLUG[slug];
  if (!slug || !tournamentId) {
    console.error(`Usage: bun scripts/import-pool-matches-from-module.ts <slug>`);
    process.exit(1);
  }

  const dumpDir = path.join(process.cwd(), "data/scrapes");
  const files = (await readdir(dumpDir))
    .filter((f) => f.startsWith(`${slug}_module_`) && f.endsWith(".groups.json"))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.error(`❌ Aucun ${slug}_module_*.groups.json — run parse-module-html.ts first.`);
    process.exit(1);
  }
  const jsonPath = path.join(dumpDir, files[0]!);
  console.log(`📥 Source: ${jsonPath}`);

  const data = (await Bun.file(jsonPath).json()) as ParseDump;
  console.log(
    `   ${data.groupsCount} groupes, ${data.participantsCount} participants, ${data.matchesCount} matches`,
  );

  // Map participant name → userId (via existing tournament_participants)
  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { id: true, userId: true, playerName: true },
  });
  const userIdByName = new Map<string, string | null>();
  for (const p of participants) {
    if (p.playerName) userIdByName.set(p.playerName.toLowerCase(), p.userId);
  }

  // Step 1 : delete current pool matches (round=-100, synth IDs `pool-*`)
  const deleted = await prisma.tournamentMatch.deleteMany({
    where: {
      tournamentId,
      round: POOL_ROUND_SENTINEL,
    },
  });
  console.log(`🧹 Pool matches précédents supprimés: ${deleted.count}`);

  // Step 2 : insert 85 matches from HTML — use real Challonge matchId
  let created = 0;
  let skipped = 0;
  for (const m of data.matches) {
    if (!m.winner || !m.loser) {
      skipped++;
      continue;
    }
    const winner = normalizeName(m.winner);
    const loser = normalizeName(m.loser);
    const winnerUid = userIdByName.get(winner.toLowerCase()) ?? null;
    const loserUid = userIdByName.get(loser.toLowerCase()) ?? null;

    await prisma.tournamentMatch.upsert({
      where: {
        tournamentId_challongeMatchId: {
          tournamentId,
          challongeMatchId: m.matchId,
        },
      },
      create: {
        tournamentId,
        challongeMatchId: m.matchId,
        round: POOL_ROUND_SENTINEL,
        player1Id: winnerUid,
        player2Id: loserUid,
        winnerId: winnerUid,
        player1Name: winner,
        player2Name: loser,
        winnerName: winner,
        score: "0-0",
        state: m.state || "complete",
      },
      update: {
        round: POOL_ROUND_SENTINEL,
        player1Id: winnerUid,
        player2Id: loserUid,
        winnerId: winnerUid,
        player1Name: winner,
        player2Name: loser,
        winnerName: winner,
        score: "0-0",
        state: m.state || "complete",
      },
    });
    created++;
  }
  console.log(`✅ Pool matches importés: ${created} (skipped: ${skipped})`);

  // Step 3 : Update participant stats (W/L from group data)
  console.log(`\n👥 Sync participant W/L...`);
  let participantsUpdated = 0;
  const groupRankByName = new Map<
    string,
    {
      groupName: string;
      groupRank: number | null;
      advanced: boolean;
      wins: number;
      losses: number;
      ties: number;
      setWins: number;
      challongePts: number;
    }
  >();
  for (const g of data.groups) {
    for (const p of g.participants) {
      groupRankByName.set(normalizeName(p.displayName).toLowerCase(), {
        groupName: g.name,
        groupRank: p.rank,
        advanced: p.advanced,
        wins: p.wins,
        losses: p.losses,
        ties: p.ties,
        setWins: p.setWins,
        challongePts: p.pts,
      });
    }
  }

  // Recompute W/L from ALL matches in DB (pool + bracket)
  const allMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, state: "complete" },
    select: {
      winnerName: true,
      player1Name: true,
      player2Name: true,
      round: true,
    },
  });
  const wlByName = new Map<string, { w: number; l: number }>();
  for (const m of allMatches) {
    if (!m.winnerName) continue;
    const loser =
      m.player1Name && m.player1Name !== m.winnerName
        ? m.player1Name
        : m.player2Name && m.player2Name !== m.winnerName
          ? m.player2Name
          : null;
    if (!loser) continue;
    const w = wlByName.get(m.winnerName) ?? { w: 0, l: 0 };
    w.w++;
    wlByName.set(m.winnerName, w);
    const l = wlByName.get(loser) ?? { w: 0, l: 0 };
    l.l++;
    wlByName.set(loser, l);
  }

  for (const p of participants) {
    if (!p.playerName) continue;
    const wl = wlByName.get(p.playerName);
    if (!wl) continue;
    await prisma.tournamentParticipant.update({
      where: { id: p.id },
      data: { wins: wl.w, losses: wl.l },
    });
    participantsUpdated++;
  }
  console.log(`   ${participantsUpdated} participants W/L mis à jour`);

  // Step 4 : Re-sync stardust ranking
  const { syncStardustRankingsToDb } = await import("../src/lib/stardust-sync-bts");
  console.log(`\n🏆 Re-sync stardust ranking...`);
  const r = await syncStardustRankingsToDb(prisma);
  console.log(
    `   success=${r.success}${r.success ? ` count=${r.count}` : ` error=${(r as { error: string }).error}`}`,
  );

  const all = await prisma.stardustRanking.findMany({
    orderBy: { rank: "asc" },
  });
  console.log(`\n🌠 Top 10 stardust :`);
  for (const r of all.slice(0, 10)) {
    console.log(
      `   #${String(r.rank).padStart(2)} ${r.playerName.padEnd(28)} score=${String(r.score).padStart(6)}  ${r.wins}W/${r.losses}L  ${r.winRate}`,
    );
  }
  console.log(`\n📊 Total ranked: ${all.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("💥", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
