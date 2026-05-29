/**
 * Scrape les 8 pages de https://challonge.com/<slug>/log et extrait les
 * matches de phase de poule (qui ne sont PAS dans le bracket Challonge).
 *
 * Format DOM:
 *   <div class="activity-feed-item -padbot">
 *     <div class="activity-feed-item--actor">
 *       <a href="/fr/users/<reporter>">{reporter}</a>
 *     </div>
 *     <div class="activity-feed-item--text">
 *       A rapporté une victoire de 4-0 pour Kaiouss✅ contre LightYamani✅
 *     </div>
 *     <div class="activity-feed-item--time">
 *       <time datetime="2026-05-03T17:07:55.140Z">…</time>
 *     </div>
 *   </div>
 *
 * Patterns reconnus (FR):
 *   - "A rapporté une victoire de X-Y pour A✅ contre B✅"
 *   - "A annulé une victoire reportée"
 *   - "Match annulé"
 *
 * Stratégie : on capture toutes les victoires reportées, puis on **dédoublonne
 * par paire (winner, loser)** pour ne garder que la PLUS RÉCENTE — un match
 * qui a été annulé+rapporté à nouveau ne compte qu'une fois (la dernière).
 *
 * Les matches du bracket Challonge sont aussi reportés via le log, donc on
 * filtre via le set des `(winner,loser)` déjà présents dans tournament_matches.
 *
 * Usage: bun scripts/scrape-pool-matches.ts T_SS1
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ChallongeScraper } from "@rose-griffon/challonge";
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
    .replace(/✅|❌|⚠️|🟢|🔴/g, "")
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
  // Patterns:
  //   "A rapporté une victoire de 4-0 pour Kaiouss✅ contre LightYamani✅"
  //   "A rapporté une victoire de 0-3 pour A contre B"
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

async function main() {
  const slug = process.argv[2];
  const tournamentId = slug && TOURNAMENT_ID_BY_SLUG[slug];
  if (!slug || !tournamentId) {
    console.error(
      `Usage: bun scripts/scrape-pool-matches.ts <slug>\nKnown slugs: ${Object.keys(TOURNAMENT_ID_BY_SLUG).join(", ")}`,
    );
    process.exit(1);
  }

  const scraper = new ChallongeScraper({
    log: (m) => console.log(`   ${m}`),
  });
  const sc = scraper as unknown as {
    init: () => Promise<void>;
    openPage: (url: string, signal?: AbortSignal) => Promise<import("puppeteer").Page>;
  };
  await sc.init();

  const allEntries: LogEntry[] = [];
  let pageNumber = 1;
  const maxPages = 12; // safety
  const seenSignatures = new Set<string>();

  try {
    while (pageNumber <= maxPages) {
      const url = `https://challonge.com/${slug}/log?page=${pageNumber}`;
      console.log(`📄 Page ${pageNumber}: GET ${url}`);
      const page = await sc.openPage(url);

      try {
        await page.waitForSelector(".activity-feed-item", { timeout: 10_000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1_500));

        const items = (await page.evaluate(`
					(function() {
						return Array.from(document.querySelectorAll('.activity-feed-item')).map(el => {
							const actor = el.querySelector('.activity-feed-item--actor')?.innerText?.trim() ?? '';
							const text = el.querySelector('.activity-feed-item--text')?.innerText?.trim() ?? '';
							const timeEl = el.querySelector('.activity-feed-item--time time');
							const timestamp = timeEl?.getAttribute('datetime') ?? '';
							return { actor, text, timestamp };
						});
					})()
				`)) as LogEntry[];

        console.log(`   ${items.length} entries`);
        let newCount = 0;
        for (const it of items) {
          const sig = `${it.timestamp}|${it.text}`;
          if (seenSignatures.has(sig)) continue;
          seenSignatures.add(sig);
          allEntries.push(it);
          newCount++;
        }
        if (newCount === 0) {
          console.log(`   ↳ aucune nouvelle entrée → stop pagination`);
          break;
        }

        // Detect last page via paginator
        const isLast = (await page.evaluate(`
					(function() {
						const next = document.querySelector('.paginator a[rel="next"]');
						return !next || next.classList.contains('-disabled');
					})()
				`)) as boolean;
        if (isLast) {
          console.log(`   ↳ dernière page atteinte`);
          break;
        }
      } finally {
        await page.close().catch(() => {});
      }
      pageNumber++;
    }
  } finally {
    await scraper.close().catch(() => {});
  }

  console.log(`\n📋 Total entries: ${allEntries.length}`);

  // Dump raw log entries
  const dumpDir = path.join(process.cwd(), "data/scrapes");
  await mkdir(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = path.join(dumpDir, `${slug}_log_entries_${stamp}.json`);
  await writeFile(dumpPath, JSON.stringify(allEntries, null, 2), "utf-8");
  console.log(`💾 Log dump → ${dumpPath}`);

  // Parse match reports + apply cancellations
  type WindowState = { kind: "active"; match: ParsedMatch } | { kind: "cancelled" };

  // Sort by timestamp asc to apply cancellations chronologiquement.
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
    // Cancellation patterns
    if (
      /annul[ée](.*)victoire/i.test(text) ||
      /cancel(led)?\s+(?:reported\s+)?(?:win|victory)/i.test(text) ||
      /Match\s+annul[ée]/i.test(text)
    ) {
      // Try to extract names from cancellation text too
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

  console.log(`\n🥊 Matches reportés (après dédup + annulations) : ${allMatches.length}`);

  // Filter out matches already present in tournament_matches (= bracket)
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
  console.log(`   bracket déjà présent: ${allMatches.length - poolMatches.length}`);
  console.log(`   pool stage à insérer: ${poolMatches.length}`);

  // Resolve userId via existing tournament participants by playerName
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
      console.log(`   ⚠️  skip (no participant matched) ${m.winner} vs ${m.loser}`);
      mSkipped++;
      continue;
    }

    // Use a synthetic challongeMatchId to keep idempotence
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

  console.log(`\n✅ Pool matches insérés: ${mCreated} (skipped: ${mSkipped})`);

  // Update participants W/L from all matches
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
    console.log(`✅ Participants W/L recomputed from all matches`);
  }

  // Re-sync stardust ranking
  const { syncStardustRankingsToDb } = await import("../src/lib/stardust-sync-bts");
  console.log(`\n🏆 Re-sync stardust ranking…`);
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
  console.log(`\n📊 Total ranked players: ${all.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("💥", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
