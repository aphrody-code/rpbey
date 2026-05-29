/**
 * Dump brut de https://challonge.com/<slug>/log via dumpChallongeRaw + cookies session.
 * Sauve le HTML rendu + un parsing best-effort des lignes pour analyse offline.
 *
 * Phase 4: uses BxcTransport (curl-impersonate) instead of Puppeteer.
 *
 * Usage: bun scripts/dump-challonge-log.ts T_SS1
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { dumpChallongeRaw } from "@rose-griffon/challonge";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: bun scripts/dump-challonge-log.ts <slug>");
    process.exit(1);
  }

  console.log(`GET https://challonge.com/${slug}/log?page=1 (via bxc)`);
  const { html, store } = await dumpChallongeRaw(slug, "log", { page: 1 });

  // Pagination info from ActivityFeedSettingsStore.
  const afss = store["ActivityFeedSettingsStore"] as Record<string, unknown> | null | undefined;
  const totalPages = Number(afss?.["totalPages"] ?? afss?.["total_pages"] ?? 1);
  console.log(`   totalPages = ${totalPages}`);

  const dumpDir = path.join(process.cwd(), "data/scrapes");
  await mkdir(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  const htmlPath = path.join(dumpDir, `${slug}_log_${stamp}.html`);
  await Bun.write(htmlPath, html);
  console.log(`HTML -> ${htmlPath} (${html.length} chars)`);

  // Extract log entries from the parsed store.
  const logStore =
    (store["LogEntryListStore"] as Record<string, unknown> | null) ??
    (store["LogStore"] as Record<string, unknown> | null) ??
    (store["ActivityStore"] as Record<string, unknown> | null);
  const entries = Array.isArray(logStore?.["entries"])
    ? (logStore["entries"] as unknown[])
    : Array.isArray(logStore?.["log"])
      ? (logStore["log"] as unknown[])
      : [];

  type RowResult = { sel: string | null; html: string[]; text: string[] };
  const rows: RowResult = {
    sel: entries.length > 0 ? "store:LogEntryListStore.entries" : null,
    html: [],
    text: entries.map((e) => {
      const entry = e as Record<string, unknown>;
      return String(entry["message"] ?? entry["description"] ?? entry["text"] ?? "");
    }),
  };

  console.log(`\nSelector match: ${rows.sel ?? "(none)"}`);
  console.log(`   rows: ${rows.text.length}`);
  for (let i = 0; i < Math.min(rows.text.length, 5); i++) {
    console.log(`   [${i}] ${rows.text[i]?.replace(/\s+/g, " ").slice(0, 200)}`);
  }

  const parsedPath = path.join(dumpDir, `${slug}_log_${stamp}.parsed.json`);
  await Bun.write(parsedPath, JSON.stringify(rows, null, 2));
  console.log(`Parsed -> ${parsedPath}`);

  // Store keys summary.
  const storeKeys = Object.keys(store);
  console.log(`\nStore keys: ${storeKeys.join(", ")}`);

  console.log(`\nextracted via bxc`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
