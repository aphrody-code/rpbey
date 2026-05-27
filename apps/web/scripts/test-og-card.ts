/**
 * Test rapide rendu og-card tournoi (3 stage types) — sortie /tmp/og-*.{png,webp,avif}.
 *
 * Usage: bun apps/rpb-dashboard/scripts/test-og-card.ts
 *
 * Genere 3 cards (round-robin / single-elim / double-elim) en PNG/WebP/AVIF et
 * une card erreur. Mesure le temps + taille pour comparer les formats.
 */

import { writeFile } from "node:fs/promises";

import { mock } from "../src/lib/brackets/mock";
import {
	type ChallongeSource,
	renderTournamentCardEncoded,
	renderTournamentError,
} from "../src/lib/og/tournament-card";

const TMP = "/tmp";

interface Variant {
	key: string;
	source: ChallongeSource;
	data: typeof mock.roundRobin;
}

const VARIANTS: Variant[] = [
	{
		key: "T_SS1-rr",
		data: mock.roundRobin,
		source: {
			idOrSlug: "T_SS1",
			challongeId: 17779621,
			name: "The Stardust Series #1",
			url: "https://challonge.com/T_SS1",
			state: "complete",
			type: "round robin",
			participantsCount: 4,
			matchesCount: mock.roundRobin.matches.length,
		},
	},
	{
		key: "demo-se",
		data: mock.singleElimination,
		source: {
			idOrSlug: "demo-se",
			challongeId: 1,
			name: "Démo Single Elimination — 8 participants",
			url: "https://challonge.com/demo-se",
			state: "underway",
			type: "single elimination",
			participantsCount: 8,
			matchesCount: mock.singleElimination.matches.length,
		},
	},
	{
		key: "demo-de",
		data: mock.doubleElimination,
		source: {
			idOrSlug: "demo-de",
			challongeId: 2,
			name: "Démo Double Elim — round courant en LB",
			url: "https://challonge.com/demo-de",
			state: "underway",
			type: "double elimination",
			participantsCount: 8,
			matchesCount: mock.doubleElimination.matches.length,
		},
	},
];

const FORMATS = ["png", "webp", "avif"] as const;

function fmtMs(ms: number): string {
	return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function fmtKB(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main(): Promise<void> {
	console.log("→ Test og-card tournoi (3 variants × 3 formats + erreur)\n");

	for (const v of VARIANTS) {
		for (const format of FORMATS) {
			const t0 = performance.now();
			const buf = await renderTournamentCardEncoded({
				data: v.data,
				source: v.source,
				theme: "dark",
				format,
				fetchedAt: new Date().toISOString(),
			});
			const dt = performance.now() - t0;
			const out = `${TMP}/og-${v.key}.${format}`;
			await writeFile(out, buf);
			console.log(
				`  ${v.key.padEnd(12)} ${format.padEnd(4)}  ${fmtMs(dt).padStart(9)}  ${fmtKB(buf.length).padStart(10)}  ${out}`,
			);
		}
	}

	// Card erreur
	{
		const t0 = performance.now();
		const buf = await renderTournamentError({
			message: "Tournoi inconnu (404)",
			idOrSlug: "no-such-slug",
			theme: "dark",
		});
		const dt = performance.now() - t0;
		const out = `${TMP}/og-error.png`;
		await writeFile(out, buf);
		console.log(
			`\n  ${"error".padEnd(12)} ${"png".padEnd(4)}  ${fmtMs(dt).padStart(9)}  ${fmtKB(buf.length).padStart(10)}  ${out}`,
		);
	}

	// Card light theme pour reference
	{
		const v = VARIANTS[0]!;
		const t0 = performance.now();
		const buf = await renderTournamentCardEncoded({
			data: v.data,
			source: v.source,
			theme: "light",
			format: "png",
			fetchedAt: new Date().toISOString(),
		});
		const dt = performance.now() - t0;
		const out = `${TMP}/og-${v.key}-light.png`;
		await writeFile(out, buf);
		console.log(
			`  ${"light-rr".padEnd(12)} ${"png".padEnd(4)}  ${fmtMs(dt).padStart(9)}  ${fmtKB(buf.length).padStart(10)}  ${out}`,
		);
	}

	console.log("\nOK");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
