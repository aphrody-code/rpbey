/**
 * Unified standings-table parser (pure, bundlable).
 *
 * Single source of truth for parsing the current Challonge HTML standings table
 * layout (no `_initialStoreState`). Fuses the previously duplicated
 * `parseStandingsTable` implementations from `scraper.ts` and `reverse.ts`
 * (which were byte-for-byte identical) into one canonical function.
 *
 * Each rank row of the standings `<tbody>`:
 *   <tr>
 *     <td class='rank'><div class='rank-tile -centered -sm'><h5 class='lbl'>1</h5></div></td>
 *     <td class='white text-center display_name'><strong>Berserk91X</strong></td>
 *     <td class='text-center'><a href="https://challonge.com/fr/users/berserk91">berserk91</a></td>
 *     <td>...trend-box -win/-loss...</td>
 *   </tr>
 *
 * Pure regex HTML parser — ZERO bxc / transport / FFI imports. Input is a raw
 * HTML string; output is `ScrapedStanding[]`. Universally bundlable (Next.js).
 *
 * @module extractors/stores/standings
 */

import { type ScrapedStanding } from "../../types";

/**
 * Parse standings rows from a Challonge `/standings` (or `/module`) HTML page
 * that renders the standings table directly (no embedded React store).
 *
 * Returns an empty array when the page has no `<tbody>` or no rank rows.
 *
 * @param html  Raw HTML of the standings page.
 * @returns Parsed standings, ordered as they appear in the table.
 */
export function parseStandingsTable(html: string): ScrapedStanding[] {
  const out: ScrapedStanding[] = [];
  const tbodyMatch = /<tbody>([\s\S]+?)<\/tbody>/.exec(html);
  if (!tbodyMatch) return out;
  const tbody = tbodyMatch[1] ?? "";
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tbody)) !== null) {
    const row = m[1] ?? "";
    const rankMatch = /<h5[^>]*class=['"][^'"]*lbl[^'"]*['"][^>]*>\s*(\d+)/.exec(row);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1] ?? "0", 10);
    const nameMatch =
      /<td[^>]*class=['"][^'"]*display_name[^'"]*['"][^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/.exec(
        row,
      );
    const rawName = (nameMatch?.[1] ?? "").trim();
    const name = rawName.replace(/[✅✅]/g, "").trim();
    const userMatch =
      /<a[^>]+href=["']https:\/\/challonge\.com\/(?:[a-z]{2}\/)?users\/([^"']+)["'][^>]*>([^<]+)/.exec(
        row,
      );
    const challongeUsername = userMatch?.[1] ?? null;
    let wins = 0;
    let losses = 0;
    for (const t of row.matchAll(/<div[^>]+class=['"][^'"]*trend-box\s+-(\w+)[^'"]*['"][^>]*>/g)) {
      const verdict = t[1] ?? "";
      if (verdict === "win") wins++;
      else if (verdict === "loss") losses++;
    }
    out.push({
      rank,
      name,
      challongeUsername,
      challongeProfileUrl: challongeUsername
        ? `https://challonge.com/users/${challongeUsername}`
        : null,
      wins,
      losses,
      stats: { rank, name, wins, losses, challongeUsername },
    });
  }
  return out;
}

/**
 * Extract standings from a parsed `_initialStoreState` map (store-based, distinct
 * from the HTML-table {@link parseStandingsTable} fallback above).
 *
 * Reads `StandingsStore.standings` (or `TournamentStore.standings`). Moved
 * verbatim out of `scraper.ts` (P3 registry split); byte-for-byte identical,
 * only relocated so the extractor stays free of any bxc / transport / FFI
 * import and can be reused from the route registry.
 *
 * @param store  Parsed `_initialStoreState` map.
 * @returns Parsed standings (empty array when none found).
 */
export function storeToStandings(store: Record<string, unknown>): ScrapedStanding[] {
  const ss = store["StandingsStore"] as Record<string, unknown> | null;
  const ts = store["TournamentStore"] as Record<string, unknown> | null;

  const raw: unknown[] =
    (ss?.["standings"] as unknown[] | null) ?? (ts?.["standings"] as unknown[] | null) ?? [];

  return (raw as Record<string, unknown>[]).map((s, i) => ({
    rank: (s["rank"] as number) ?? (s["final_rank"] as number) ?? i + 1,
    name: ((s["display_name"] as string) ?? (s["name"] as string) ?? "").trim().replace("✅", ""),
    challongeUsername:
      (s["username"] as string | null) ?? (s["challonge_username"] as string | null) ?? null,
    challongeProfileUrl: (s["username"] as string | null)
      ? `https://challonge.com/users/${s["username"] as string}`
      : null,
    wins: (s["wins"] as number) ?? (s["match_wins"] as number) ?? 0,
    losses: (s["losses"] as number) ?? (s["match_losses"] as number) ?? 0,
    stats: s,
  }));
}
