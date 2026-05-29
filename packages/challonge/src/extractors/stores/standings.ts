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
