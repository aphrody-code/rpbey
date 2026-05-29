/**
 * Dump brut de https://challonge.com/<slug>/log via puppeteer + cookies session.
 * Sauve le HTML rendu + un parsing best-effort des lignes pour analyse offline.
 *
 * Usage: bun scripts/dump-challonge-log.ts T_SS1
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ChallongeScraper } from "@rose-griffon/challonge";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: bun scripts/dump-challonge-log.ts <slug>");
    process.exit(1);
  }

  const scraper = new ChallongeScraper({
    log: (m) => console.log(`   ${m}`),
  });
  // Trigger init by calling scrape on something, OR access internals.
  // `scrape()` calls init(), so easiest is to subclass ; alternative : init() is private.
  // Hack: scrape() re-uses browser. We just call scrape on slug then use browser ourselves.
  console.log(`📡 Init browser via scrape (small)…`);
  const sc = scraper as unknown as {
    init: () => Promise<void>;
    browser: import("puppeteer").Browser;
    openPage: (url: string, signal?: AbortSignal) => Promise<import("puppeteer").Page>;
    opts: { log: (m: string) => void };
  };
  await sc.init();

  const url = `https://challonge.com/${slug}/log`;
  console.log(`🔍 GET ${url}`);
  const page = await sc.openPage(url);

  try {
    await page
      .waitForFunction(
        `!!document.querySelector('main table tbody tr, .log-table tbody tr, [class*="LogTable"] tbody tr, [class*="Log"] tbody tr')`,
        { timeout: 10_000 },
      )
      .catch(() => console.log("   (no table selector resolved within 10s)"));
    // Always wait a bit more to let JS hydrate the SPA log
    await new Promise((r) => setTimeout(r, 2_500));

    const html = await page.content();
    const dumpDir = path.join(process.cwd(), "data/scrapes");
    await mkdir(dumpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const htmlPath = path.join(dumpDir, `${slug}_log_${stamp}.html`);
    await writeFile(htmlPath, html, "utf-8");
    console.log(`💾 HTML brut → ${htmlPath} (${html.length} chars)`);

    // Best-effort row extraction
    const rows = (await page.evaluate(`
			(function() {
				const sels = [
					'main table tbody tr',
					'.log-table tbody tr',
					'[data-testid="log-row"]',
					'[class*="LogTable"] tbody tr',
					'[class*="Log"] tbody tr',
				];
				let rows = [];
				for (const sel of sels) {
					rows = Array.from(document.querySelectorAll(sel));
					if (rows.length) return { sel, html: rows.map(r => r.outerHTML), text: rows.map(r => r.innerText) };
				}
				return { sel: null, html: [], text: [] };
			})()
		`)) as { sel: string | null; html: string[]; text: string[] };

    console.log(`\n📋 Selector match: ${rows.sel ?? "(none)"}`);
    console.log(`   rows: ${rows.text.length}`);
    for (let i = 0; i < Math.min(rows.text.length, 5); i++) {
      console.log(`   [${i}] ${rows.text[i]?.replace(/\s+/g, " ").slice(0, 200)}`);
    }

    const parsedPath = path.join(dumpDir, `${slug}_log_${stamp}.parsed.json`);
    await writeFile(parsedPath, JSON.stringify(rows, null, 2), "utf-8");
    console.log(`💾 Parsed → ${parsedPath}`);

    // Look for embedded JSON store
    const stores = (await page.evaluate(`
			(function() {
				const out = {};
				try {
					const scripts = Array.from(document.scripts);
					for (const s of scripts) {
						const t = s.textContent || '';
						const m = t.match(/window\\.__STATE__\\s*=\\s*(\\{[\\s\\S]+?\\});/) || t.match(/__INITIAL_STATE__\\s*=\\s*(\\{[\\s\\S]+?\\});/);
						if (m) {
							out.foundInScript = true;
							try { out.preview = m[1].slice(0, 2000); } catch {}
							break;
						}
					}
					if (window.TournamentStore) out.TournamentStore = Object.keys(window.TournamentStore);
					if (window.LogStore) out.LogStore = Object.keys(window.LogStore);
					if (window.ActivityStore) out.ActivityStore = Object.keys(window.ActivityStore);
				} catch (e) {
					out.err = String(e);
				}
				return out;
			})()
		`)) as Record<string, unknown>;
    console.log(`\n🔬 Store keys:`, JSON.stringify(stores, null, 2).slice(0, 1500));
  } finally {
    await page.close().catch(() => {});
    await scraper.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("💥", err);
  process.exit(1);
});
