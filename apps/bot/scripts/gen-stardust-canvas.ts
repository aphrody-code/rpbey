#!/usr/bin/env bun
/**
 * Génère la carte canvas /classement top type:Stardust en hors-Discord
 * pour comparer visuellement avec /tournaments/stardust.
 */
import "reflect-metadata";
import prisma from "../src/lib/prisma";
import { generateLeaderboardCard } from "../src/lib/canvas-utils";

const rows = await prisma.stardustRanking.findMany({
	orderBy: { rank: "asc" },
	take: 10,
});

console.log(`Loaded ${rows.length} stardust ranking rows`);
for (const r of rows.slice(0, 5)) {
	console.log(
		`  #${r.rank} ${r.playerName} — ${r.score} pts — ${r.wins}W ${r.losses}L`,
	);
}

const buf = await generateLeaderboardCard(
	rows.map((r) => ({
		avatarUrl: "",
		name: r.playerName,
		points: r.score,
		rank: r.rank,
		winRate: r.winRate,
		wins: r.wins,
		losses: r.losses,
		participations: r.participation,
	})),
	{
		variant: "stardust",
		subtitle: "Stardust Series · T_SS1",
	},
);

const outPath = "/tmp/stardust-canvas.png";
await Bun.write(outPath, buf);
console.log(`\n✓ Canvas écrit: ${outPath} (${buf.byteLength} bytes)`);

await prisma.$disconnect();
