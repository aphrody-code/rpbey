/**
 * Scrape les 8 pages de https://challonge.com/<slug>/log et extrait les
 * matches de phase de poule (qui ne sont PAS dans le bracket Challonge).
 *
 * Phase 4: uses dumpChallongeRaw (BxcTransport) instead of Puppeteer.
 * Iterates pages via dumpChallongeRaw(slug, "log", { page }) — reads
 * totalPages from ActivityFeedSettingsStore on first page.
 *
 * Format DOM (reference):
 *   activity-feed-item -> actor text timestamp
 *
 * Patterns reconnus (FR):
 *   - "A rapporte une victoire de 4-0 pour Kaiouss contre LightYamani"
 *   - "A annule une victoire reportee"
 *   - "Match annule"
 *
 * Strategie : on capture toutes les victoires reportees, puis on dedoublonne
 * par paire (winner, loser) pour ne garder que la PLUS RECENTE.
 *
 * Usage: bun scripts/scrape-pool-matches.ts T_SS1
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { dumpChallongeRaw } from "@rose-griffon/challonge";
import { prisma } from "../src/lib/prisma";

const TOURNAMENT_ID_BY_SLUG: Record<string, string> = {
  T_SS1: "cmobvakra0001s7rog85nt10h",
};

interface LogEntry {
  timestamp: string;
  actor: string;
  text: string;
}

interface ParsedMatch {
  winner: string;
  loser: string;
  scoreWinner: number;
  scoreLoser: number;
  rawScore: string;
  timestamp: string;
}

function normalizeName(raw: string): string {
  return raw
    .replace(/[✅❌🟢🔴]|⚠️/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMatchReport(text: string): {
  winner: string;
  loser: string;
  scoreWinner: number;
  scoreLoser: number;
  rawScore: string;
} | null {
  const m = text.match(
    /(?:A\s+rapport[ée]|R[ée]sultat[s]?|Reported)\s+(?:une\s+victoire\s+)?(?:de\s+)?(\d+)\s*-\s*(\d+)\s+(?:pour|for)\s+(.+?)\s+(?:contre|against|vs\.?|vs)\s+(.+?)\s*$/i,
  );
  if (!m) return null;
  const [, sw, sl, rawWinner, rawLoser] = m;
  const winner = normalizeName(rawWinner!);
  const loser = normalizeName(rawLoser!);
  if (!winner || !loser || winner.toLowerCase() === loser.toLowerCase()) return null;
  return {
    winner,
    loser,
    scoreWinner: Number(sw),
    scoreLoser: Number(sl),
    rawScore: `${sw}-${sl}`,
  };
}

/** Extract LogEntry[] from a parsed _initialStoreState map. */
function extractLogEntries(store: Record<string, unknown>): LogEntry[] {
  const logStore =
    (store["LogEntryListStore"] as Record<string, unknown> | null) ??
    (store["LogStore"] as Record<string, unknown> | null) ??
    (store["ActivityStore"] as Record<string, unknown> | null);

  const rawEntries = Array.isArray(logStore?.["entries"])
    ? (logStore["entries"] as unknown[])
    : Array.isArray(logStore?.["log"])
      ? (logStore["log"] as unknown[])
      : [];

  return rawEntries.map((e) => {
    const entry = e as Record<string, unknown>;
    return {
      timestamp: String(entry["created_at"] ?? entry["timestamp"] ?? entry["date"] ?? ""),
      actor: String(entry["actor"] ?? entry["user"] ?? ""),
      text: String(entry["message"] ?? entry["description"] ?? entry["text"] ?? ""),
    };
  });
}

async function main() {
  const slug = process.argv[2];
  const tournamentId = slug && TOURNAMENT_ID_BY_SLUG[slug];
  if (!slug || !tournamentId) {
    console.error(
      `Usage: bun scripts/scrape-pool-matches.ts <slug>\nKnown slugs: ${Object.keys(TOURNAMENT_ID_BY_SLUG).join(", ")}`,
    );
    process.exit(1);
  }

  const allEntries: LogEntry[] = [];
  const seenSignatures = new Set<string>();
  const maxPages = 12; // safety cap

  // Fetch first page to determine totalPages.
  const baseUrl = `https://challonge.com/${slug}/log`;
  console.log(`Page 1: GET ${baseUrl}?page=1 (via bxc)`);
  const firstResult = await dumpChallongeRaw(slug, "log", { page: 1 });
  const firstEntries = extractLogEntries(firstResult.store);

  const afss = firstResult.store["ActivityFeedSettingsStore"] as Record<string, unknown> | null;
  const totalPages = Math.min(Number(afss?.["totalPages"] ?? afss?.["total_pages"] ?? 1), maxPages);
  console.log(`   ${firstEntries.length} entries, totalPages=${totalPages}`);

  for (const entry of firstEntries) {
    const sig = `${entry.timestamp}|${entry.text}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      allEntries.push(entry);
    }
  }

  // Fetch remaining pages.
  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
    console.log(`Page ${pageNumber}: GET ${baseUrl}?page=${pageNumber}`);
    const result = await dumpChallongeRaw(slug, "log", { page: pageNumber });
    const entries = extractLogEntries(result.store);
    console.log(`   ${entries.length} entries`);

    let newCount = 0;
    for (const entry of entries) {
      const sig = `${entry.timestamp}|${entry.text}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        allEntries.push(entry);
        newCount++;
      }
    }
    if (newCount === 0) {
      console.log(`   no new entries -> stop pagination`);
      break;
    }
  }

  console.log(`\nTotal entries: ${allEntries.length}`);

  // Dump raw log entries.
  const dumpDir = path.join(process.cwd(), "data/scrapes");
  await mkdir(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(dumpDir, `${slug}_log_entries_${stamp}.json`);
  await Bun.write(dumpPath, JSON.stringify(allEntries, null, 2));
  console.log(`Log dump -> ${dumpPath}`);

  // Parse match reports + apply cancellations.
  type WindowState = { kind: "active"; match: ParsedMatch } | { kind: "cancelled" };

  const sorted = [...allEntries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const pairKey = (a: string, b: string) =>
    [a, b]
      .map((s) => s.toLowerCase())
      .sort()
      .join("||");

  const lastByPair = new Map<string, WindowState>();

  for (const e of sorted) {
    const text = e.text;
    const m = parseMatchReport(text);
    if (m) {
      const k = pairKey(m.winner, m.loser);
      lastByPair.set(k, {
        kind: "active",
        match: { ...m, timestamp: e.timestamp },
      });
      continue;
    }
    if (
      /annul[ée](.*)victoire/i.test(text) ||
      /cancel(led)?\s+(?:reported\s+)?(?:win|victory)/i.test(text) ||
      /Match\s+annul[ée]/i.test(text)
    ) {
      const c = text.match(/pour\s+(.+?)\s+contre\s+(.+?)\s*$/i);
      if (c) {
        const k = pairKey(normalizeName(c[1]!), normalizeName(c[2]!));
        lastByPair.set(k, { kind: "cancelled" });
      }
    }
  }

  const allMatches: ParsedMatch[] = [];
  for (const v of lastByPair.values()) {
    if (v.kind === "active") allMatches.push(v.match);
  }

  console.log(`\nMatches reportes (apres dedup + annulations) : ${allMatches.length}`);

  // Filter out matches already present in tournament_matches (= bracket).
  const existingMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId, state: "complete" },
    select: { winnerName: true, player1Name: true, player2Name: true },
  });
  const bracketPairs = new Set<string>();
  for (const m of existingMatches) {
    if (!m.winnerName) continue;
    const loser =
      m.player1Name && m.player1Name !== m.winnerName
        ? m.player1Name
        : m.player2Name && m.player2Name !== m.winnerName
          ? m.player2Name
          : null;
    if (loser) bracketPairs.add(pairKey(m.winnerName, loser));
  }

  const poolMatches = allMatches.filter((m) => !bracketPairs.has(pairKey(m.winner, m.loser)));
  console.log(`   bracket deja present: ${allMatches.length - poolMatches.length}`);
  console.log(`   pool stage a inserer: ${poolMatches.length}`);

  // Resolve userId via existing tournament participants by playerName.
  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { id: true, userId: true, playerName: true },
  });
  const userIdByName = new Map<string, string | null>();
  const partIdByName = new Map<string, string>();
  for (const p of participants) {
    if (p.playerName) {
      const k = p.playerName.toLowerCase();
      userIdByName.set(k, p.userId ?? null);
      partIdByName.set(k, p.id);
    }
  }

  let mCreated = 0;
  let mSkipped = 0;
  for (let i = 0; i < poolMatches.length; i++) {
    const m = poolMatches[i]!;
    const wKey = m.winner.toLowerCase();
    const lKey = m.loser.toLowerCase();
    if (!partIdByName.has(wKey) && !partIdByName.has(lKey)) {
      console.log(`   skip (no participant matched) ${m.winner} vs ${m.loser}`);
      mSkipped++;
      continue;
    }

    const synthId = `pool-${m.timestamp}-${wKey}-${lKey}`;
    const existing = await prisma.tournamentMatch.findUnique({
      where: {
        tournamentId_challongeMatchId: {
          tournamentId,
          challongeMatchId: synthId,
        },
      },
    });

    const data = {
      round: -100, // sentinel for pool stage
      player1Id: userIdByName.get(wKey) ?? null,
      player2Id: userIdByName.get(lKey) ?? null,
      winnerId: userIdByName.get(wKey) ?? null,
      player1Name: m.winner,
      player2Name: m.loser,
      winnerName: m.winner,
      score: m.rawScore,
      state: "complete" as const,
    };

    if (existing) {
      await prisma.tournamentMatch.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          challongeMatchId: synthId,
          ...data,
        },
      });
      mCreated++;
    }
  }

  console.log(`\nPool matches inseres: ${mCreated} (skipped: ${mSkipped})`);

  // Update participants W/L from all matches.
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { matches: true, participants: true },
  });
  if (tournament) {
    const wlByName = new Map<string, { w: number; l: number }>();
    for (const m of tournament.matches) {
      if (m.state !== "complete" || !m.winnerName) continue;
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
    for (const p of tournament.participants) {
      if (!p.playerName) continue;
      const wl = wlByName.get(p.playerName);
      if (!wl) continue;
      if (p.wins !== wl.w || p.losses !== wl.l) {
        await prisma.tournamentParticipant.update({
          where: { id: p.id },
          data: { wins: wl.w, losses: wl.l },
        });
      }
    }
    console.log(`Participants W/L recomputed from all matches`);
  }

  // Re-sync stardust ranking.
  const { syncStardustRankingsToDb } = await import("../src/lib/stardust-sync-bts");
  console.log(`\nRe-sync stardust ranking...`);
  const r = await syncStardustRankingsToDb(prisma);
  console.log(
    `   success=${r.success}${r.success ? ` count=${r.count}` : ` error=${(r as { error: string }).error}`}`,
  );

  const all = await prisma.stardustRanking.findMany({
    orderBy: { rank: "asc" },
  });
  console.log(`\nTop 10 stardust :`);
  for (const rankEntry of all.slice(0, 10)) {
    console.log(
      `   #${String(rankEntry.rank).padStart(2)} ${rankEntry.playerName.padEnd(28)} score=${String(rankEntry.score).padStart(6)}  ${rankEntry.wins}W/${rankEntry.losses}L  ${rankEntry.winRate}`,
    );
  }
  console.log(`\nTotal ranked players: ${all.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
