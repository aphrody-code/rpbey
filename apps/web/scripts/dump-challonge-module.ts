/**
 * Dump complet de https://challonge.com/<slug>/module — HTML rendu après JS hydrate.
 *
 * Découpe le HTML en sections (group stages, finals bracket) pour analyse.
 *
 * Usage: bun scripts/dump-challonge-module.ts T_SS1
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ChallongeScraper } from "@rose-griffon/challonge";

async function main() {
	const slug = process.argv[2];
	if (!slug) {
		console.error("Usage: bun scripts/dump-challonge-module.ts <slug>");
		process.exit(1);
	}

	const scraper = new ChallongeScraper({
		log: (m) => console.log(`   ${m}`),
	});
	const sc = scraper as unknown as {
		init: () => Promise<void>;
		openPage: (
			url: string,
			signal?: AbortSignal,
		) => Promise<import("puppeteer").Page>;
	};
	await sc.init();

	const url = `https://challonge.com/${slug}/module`;
	console.log(`🔍 GET ${url}`);
	const page = await sc.openPage(url);

	try {
		// Wait for the SPA to hydrate
		await page
			.waitForSelector(
				"[class*=bracket], [class*=group-stage], [class*=GroupStage], canvas, svg",
				{ timeout: 15_000 },
			)
			.catch(() => console.log("   (no bracket selector resolved within 15s)"));

		// Extra wait pour le rendu complet
		await new Promise((r) => setTimeout(r, 4_000));

		const html = await page.content();
		const dumpDir = path.join(process.cwd(), "data/scrapes");
		await mkdir(dumpDir, { recursive: true });
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const htmlPath = path.join(dumpDir, `${slug}_module_${stamp}.html`);
		await writeFile(htmlPath, html, "utf-8");
		console.log(`💾 HTML brut → ${htmlPath} (${html.length} chars)`);

		// Inventaire des classes/data-attrs intéressants
		const inventory = (await page.evaluate(`
			(function() {
				const allClasses = new Set();
				const dataAttrs = new Set();
				const reactComponents = new Set();
				document.querySelectorAll('*').forEach(el => {
					(el.className?.toString() || '').split(/\\s+/).forEach(c => c && allClasses.add(c));
					Array.from(el.attributes).forEach(a => { if (a.name.startsWith('data-')) dataAttrs.add(a.name); });
					const rc = el.getAttribute('data-react-class');
					if (rc) reactComponents.add(rc);
				});
				const filtered = (set, regex) => Array.from(set).filter(c => regex.test(c)).sort();
				return {
					reactComponents: Array.from(reactComponents).sort(),
					classGroupBracket: filtered(allClasses, /group|bracket|round|match|stage|pool|final/i),
					classMatch: filtered(allClasses, /match|game|score/i),
					dataAttrs: Array.from(dataAttrs).sort(),
				};
			})()
		`)) as {
			reactComponents: string[];
			classGroupBracket: string[];
			classMatch: string[];
			dataAttrs: string[];
		};

		console.log(`\n🎭 React components: ${inventory.reactComponents.length}`);
		for (const c of inventory.reactComponents) console.log(`   - ${c}`);

		console.log(
			`\n🏗  Classes group/bracket/round/match (${inventory.classGroupBracket.length}):`,
		);
		for (const c of inventory.classGroupBracket.slice(0, 50))
			console.log(`   - ${c}`);

		console.log(`\n📎 data-attrs (${inventory.dataAttrs.length}):`);
		for (const a of inventory.dataAttrs.slice(0, 30)) console.log(`   - ${a}`);

		// Extraire le contenu textuel des sections principales
		const sections = (await page.evaluate(`
			(function() {
				const out = {};
				const findSection = (label, selector) => {
					const els = Array.from(document.querySelectorAll(selector));
					out[label] = {
						selector,
						count: els.length,
						firstHtml: els[0]?.outerHTML?.slice(0, 5000) || null,
						allText: els.map(el => (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 300)),
					};
				};
				findSection('groupStages', '[class*="group-stage"], [class*="GroupStage"], [data-react-class*="GroupStage"]');
				findSection('groupTables', '[class*="group-table"], [class*="GroupTable"]');
				findSection('finalsBracket', '[class*="bracket"]:not([class*="group"]), [class*="FinalsBracket"], [data-react-class*="Bracket"]:not([data-react-class*="Group"])');
				findSection('matches', '[class*="match-row"], [class*="MatchRow"], [class*="match-card"], [class*="MatchCard"], [data-match-id]');
				findSection('rounds', '[class*="round"], [data-round]');
				return out;
			})()
		`)) as Record<
			string,
			{
				selector: string;
				count: number;
				firstHtml: string | null;
				allText: string[];
			}
		>;

		console.log(`\n📦 Sections détectées :`);
		for (const [k, v] of Object.entries(sections)) {
			console.log(`   ${k}: ${v.count} éléments (selector: ${v.selector})`);
		}

		// Look for embedded JSON data (window.__INITIAL_STATE__ etc.)
		const jsonStores = (await page.evaluate(`
			(function() {
				const found = {};
				try {
					if (window.TournamentStore) {
						const t = window.TournamentStore;
						found.TournamentStore = {
							topKeys: Object.keys(t || {}),
							hasGroupStages: !!t.group_stages,
							hasMatches: Array.isArray(t.matches) ? t.matches.length : (t.matches ? 'object' : 'absent'),
							hasParticipants: Array.isArray(t.participants) ? t.participants.length : 'absent',
							tournamentTopKeys: t.tournament ? Object.keys(t.tournament) : null,
							sampleMatch: Array.isArray(t.matches) && t.matches[0] ? Object.keys(t.matches[0]) : null,
						};
					}
					if (window.GroupStagesStore) {
						found.GroupStagesStore = Object.keys(window.GroupStagesStore);
					}
					if (window.__INITIAL_STATE__) {
						found.__INITIAL_STATE__ = Object.keys(window.__INITIAL_STATE__);
					}
				} catch (e) { found.err = String(e); }
				return found;
			})()
		`)) as Record<string, unknown>;

		console.log(
			`\n🔬 JS stores :`,
			JSON.stringify(jsonStores, null, 2).slice(0, 2000),
		);

		const inventoryPath = path.join(
			dumpDir,
			`${slug}_module_${stamp}.inventory.json`,
		);
		await writeFile(
			inventoryPath,
			JSON.stringify({ inventory, sections, jsonStores }, null, 2),
			"utf-8",
		);
		console.log(`💾 Inventory → ${inventoryPath}`);
	} finally {
		await page.close().catch(() => {});
		await scraper.close().catch(() => {});
	}
}

main().catch((err) => {
	console.error("💥", err);
	process.exit(1);
});
