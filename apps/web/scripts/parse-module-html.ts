/**
 * Parse le HTML brut de Challonge `/module` (déjà dumpé via
 * `scripts/dump-challonge-module.ts`) avec **Bun HTMLRewriter** (cf.
 * https://bun.com/docs/runtime/html-rewriter et
 * https://bun.com/docs/guides/html-rewriter/extract-links pour le pattern).
 *
 * Extrait :
 *   - 6 groupes (Group A → F, format round-robin)
 *   - Pour chaque participant : rank, displayName, challongeUsername,
 *     advanced (qualifié), W-L-T, TB, set wins/ties, pts (Pts Challonge),
 *     matchHistory: [{ matchId, result: 'W'|'L' }]
 *   - Reconstruit la liste des matches du pool (via cross-référence des
 *     matchHistory : matchId → winner ∪ loser)
 *
 * Usage:
 *   bun scripts/parse-module-html.ts T_SS1
 *   bun scripts/parse-module-html.ts T_SS1 path/to/dump.html
 */

import { writeFile, readdir } from "node:fs/promises";
import path from "node:path";

interface MatchHistoryEntry {
  matchId: string;
  matchState: string;
  result: "W" | "L" | "?";
}

interface GroupParticipant {
  rank: number | null;
  displayName: string;
  challongeUsername: string | null;
  portraitUrl: string | null;
  advanced: boolean;
  wins: number;
  losses: number;
  ties: number;
  tb: number;
  setWins: number;
  setTies: number;
  pts: number;
  matchHistory: MatchHistoryEntry[];
}

interface GroupData {
  name: string;
  participants: GroupParticipant[];
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: bun scripts/parse-module-html.ts <slug> [path-to-html]");
    process.exit(1);
  }

  let htmlPath = process.argv[3];
  if (!htmlPath) {
    const dumpDir = path.join(process.cwd(), "data/scrapes");
    const files = (await readdir(dumpDir))
      .filter((f) => f.startsWith(`${slug}_module_`) && f.endsWith(".html"))
      .sort()
      .reverse();
    if (files.length === 0) {
      console.error(`❌ Aucun dump ${slug}_module_*.html trouvé.`);
      process.exit(1);
    }
    htmlPath = path.join(dumpDir, files[0]!);
  }
  console.log(`📥 HTML: ${htmlPath}`);

  const html = await Bun.file(htmlPath).text();
  console.log(`   ${html.length} chars`);

  // === État global du parser ===
  const groups: GroupData[] = [];
  let currentGroup: GroupData | null = null;
  let inGroupStandingsPane = false;
  let inStandingsTable = false;
  let inTbody = false;
  let currentRow: GroupParticipant | null = null;
  let cellIndex = -1;
  let currentCellText: string[] = [];
  let inMatchHistoryCell = false;

  const flushCell = () => {
    if (!currentRow) return;
    const text = currentCellText.join(" ").replace(/\s+/g, " ").trim();
    switch (cellIndex) {
      case 0:
        currentRow.rank = parseInt(text, 10) || null;
        break;
      case 1: {
        // Participant cell
        const advanced = /\bAdvanced\b/i.test(text);
        const cleaned = text
          .replace(/\bAdvanced\b/i, "")
          .replace(/✅|❌/g, "")
          .trim();
        const m = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (m) {
          currentRow.displayName = m[1]!.trim();
          currentRow.challongeUsername = m[2]!.trim();
        } else {
          currentRow.displayName = cleaned;
        }
        currentRow.advanced = advanced;
        break;
      }
      case 2: {
        const m = text.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
        if (m) {
          currentRow.wins = parseInt(m[1]!, 10);
          currentRow.losses = parseInt(m[2]!, 10);
          currentRow.ties = parseInt(m[3]!, 10);
        }
        break;
      }
      case 3:
        currentRow.tb = parseInt(text, 10) || 0;
        break;
      case 4:
        currentRow.setWins = parseInt(text, 10) || 0;
        break;
      case 5:
        currentRow.setTies = parseInt(text, 10) || 0;
        break;
      case 6:
        currentRow.pts = parseInt(text, 10) || 0;
        break;
    }
    currentCellText = [];
  };

  const rewriter = new HTMLRewriter()
    .on("li.group-name", {
      text(t) {
        const name = t.text.trim();
        if (!name) return;
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { name, participants: [] };
      },
    })
    .on("div.group-standings-pane", {
      element(el) {
        inGroupStandingsPane = true;
        el.onEndTag(() => {
          inGroupStandingsPane = false;
        });
      },
    })
    .on("table.standings", {
      element(el) {
        if (!inGroupStandingsPane) return; // skip tables hors-groupes (ex. bracket finals)
        inStandingsTable = true;
        el.onEndTag(() => {
          inStandingsTable = false;
        });
      },
    })
    .on("tbody", {
      element(el) {
        if (!inStandingsTable) return;
        inTbody = true;
        el.onEndTag(() => {
          inTbody = false;
        });
      },
    })
    .on("tr", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentGroup) return;
        currentRow = {
          rank: null,
          displayName: "",
          challongeUsername: null,
          portraitUrl: null,
          advanced: false,
          wins: 0,
          losses: 0,
          ties: 0,
          tb: 0,
          setWins: 0,
          setTies: 0,
          pts: 0,
          matchHistory: [],
        };
        cellIndex = -1;
        el.onEndTag(() => {
          if (currentGroup && currentRow) {
            currentGroup.participants.push(currentRow);
          }
          currentRow = null;
          cellIndex = -1;
        });
      },
    })
    .on("td", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        cellIndex += 1;
        currentCellText = [];
        const cls = el.getAttribute("class") ?? "";
        inMatchHistoryCell = cls.includes("match-history");
        el.onEndTag(() => {
          flushCell();
          inMatchHistoryCell = false;
        });
      },
      text(t) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (inMatchHistoryCell) return; // ignore raw text in match-history cell
        if (t.text.trim()) currentCellText.push(t.text);
      },
    })
    .on("img.portrait", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (cellIndex !== 1) return;
        currentRow.portraitUrl = el.getAttribute("src") ?? null;
      },
    })
    .on("a.match-report", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (!inMatchHistoryCell) return;
        const matchId = el.getAttribute("data-match-id") ?? "";
        if (!matchId) return;
        currentRow.matchHistory.push({
          matchId,
          matchState: el.getAttribute("data-match-state") ?? "",
          result: "?",
        });
      },
    })
    .on("a.match-report div.trend-box", {
      element(el) {
        if (!inStandingsTable || !inTbody || !currentRow) return;
        if (!inMatchHistoryCell) return;
        const cls = el.getAttribute("class") ?? "";
        const last = currentRow.matchHistory[currentRow.matchHistory.length - 1];
        if (!last) return;
        if (cls.includes("-win")) last.result = "W";
        else if (cls.includes("-loss")) last.result = "L";
      },
    });

  const transformed = rewriter.transform(new Response(html));
  await transformed.text(); // consume → triggers handlers
  if (currentGroup) groups.push(currentGroup);

  // === Output ===
  console.log(`\n🏁 Groupes parsés : ${groups.length}`);
  let totalParticipants = 0;
  const allMatchIds = new Set<string>();
  for (const g of groups) {
    totalParticipants += g.participants.length;
    const matchIds = new Set<string>();
    for (const p of g.participants) {
      for (const m of p.matchHistory) {
        matchIds.add(m.matchId);
        allMatchIds.add(m.matchId);
      }
    }
    console.log(
      `\n   ${g.name.padEnd(8)} (${g.participants.length} participants, ${matchIds.size} matches)`,
    );
    for (const p of g.participants) {
      const tag = p.advanced ? "✅" : "  ";
      console.log(
        `     ${tag} #${p.rank} ${p.displayName.padEnd(28)} ${p.wins}-${p.losses}-${p.ties}  setW=${p.setWins} pts=${p.pts}  hist=${p.matchHistory.map((m) => m.result).join("")}`,
      );
    }
  }
  console.log(`\n📊 Total: ${totalParticipants} participants, ${allMatchIds.size} matches uniques`);

  // Reconstruct matches via cross-reference of matchHistory entries
  const matchById = new Map<
    string,
    { groupName: string; winner?: string; loser?: string; state: string }
  >();
  for (const g of groups) {
    for (const p of g.participants) {
      for (const m of p.matchHistory) {
        const cur = matchById.get(m.matchId) ?? {
          groupName: g.name,
          state: m.matchState,
        };
        if (m.result === "W") cur.winner = p.displayName;
        if (m.result === "L") cur.loser = p.displayName;
        matchById.set(m.matchId, cur);
      }
    }
  }
  const matches = [...matchById.entries()].map(([id, m]) => ({
    matchId: id,
    ...m,
  }));
  const incomplete = matches.filter((m) => !m.winner || !m.loser);
  console.log(`\n🥊 Matches reconstruits: ${matches.length} (incomplets: ${incomplete.length})`);
  if (incomplete.length > 0) {
    console.log(`   incomplets:`);
    for (const m of incomplete.slice(0, 10))
      console.log(
        `     ${m.matchId} (${m.groupName}) state=${m.state} winner=${m.winner ?? "?"} loser=${m.loser ?? "?"}`,
      );
  }

  const outPath = path.join(
    path.dirname(htmlPath),
    path.basename(htmlPath, ".html") + ".groups.json",
  );
  await writeFile(
    outPath,
    JSON.stringify(
      {
        slug,
        groupsCount: groups.length,
        participantsCount: totalParticipants,
        matchesCount: matches.length,
        groups,
        matches,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`💾 ${outPath}`);
}

main().catch((err) => {
  console.error("💥", err);
  process.exit(1);
});
