/**
 * Restore pool-stage eliminated participants for T_SS1.
 *
 * Source : data/scrapes/T_SS1_*.json — entries in /standings non préfixées
 * "Avancé " et absentes de /participants Challonge = éliminés en phase
 * de poule (organisée en parallèle, hors bracket Challonge double-elim).
 *
 * Insertion :
 *   - playerName = display name nettoyé
 *   - finalPlacement = 19 (au-delà du bucket top8 BTS → 0 bonus placement)
 *   - wins/losses = 0 (matches de poule non importés faute de source)
 *   - challongeParticipantId = "pool-{cleanName}"
 *
 * Conséquence ranking BTS : chacun reçoit 500 pts (participation only).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const TOURNAMENT_ID = "cmobvakra0001s7rog85nt10h"; // T_SS1
const POOL_ELIM_PLACEMENT = 19;

interface ScrapedStanding {
	rank: number;
	name: string;
	wins: number;
	losses: number;
}
interface ScrapedParticipant {
	name: string;
}
interface ScrapeDump {
	standings: ScrapedStanding[];
	participants: ScrapedParticipant[];
}

function normalizeName(raw: string): string {
	const [before] = raw.split("/");
	const cleaned = (before ?? raw).trim();
	// Standings format: "DisplayName (challongeUsername)" — keep DisplayName
	const m = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
	return m ? m[1]!.trim() : cleaned;
}

async function main() {
	const dumpDir = path.join(process.cwd(), "data/scrapes");
	const { readdir } = await import("node:fs/promises");
	const files = (await readdir(dumpDir))
		.filter((f) => f.startsWith("T_SS1_") && f.endsWith(".json"))
		.sort()
		.reverse();
	if (files.length === 0) {
		console.error("❌ Aucun dump T_SS1_*.json trouvé dans data/scrapes/");
		process.exit(1);
	}
	const dumpPath = path.join(dumpDir, files[0]!);
	console.log(`📥 Dump: ${dumpPath}`);

	const scrape = JSON.parse(await readFile(dumpPath, "utf-8")) as ScrapeDump;
	const bracketNames = new Set(scrape.participants.map((p) => p.name));

	const eliminated = scrape.standings.filter(
		(s) => !s.name.startsWith("Avancé") && !bracketNames.has(s.name),
	);
	console.log(`🎯 Éliminés en poule à restaurer : ${eliminated.length}`);

	// Match users by name/username/profile.bladerName/discordTag (soft)
	const allUsers = await prisma.user.findMany({
		select: {
			id: true,
			name: true,
			username: true,
			discordTag: true,
			profile: { select: { bladerName: true } },
		},
	});
	const userByKey = new Map<string, string>();
	const norm = (s: string | null | undefined) =>
		s
			? s
					.toLowerCase()
					.normalize("NFKD")
					.replace(/[^a-z0-9]/g, "")
			: "";
	for (const u of allUsers) {
		for (const c of [u.name, u.username, u.discordTag, u.profile?.bladerName]) {
			const k = norm(c);
			if (k && !userByKey.has(k)) userByKey.set(k, u.id);
		}
	}

	let created = 0;
	let updated = 0;
	let userMatched = 0;

	for (const s of eliminated) {
		const cleanName = normalizeName(s.name);
		const challongePid = `pool-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
		const userId = userByKey.get(norm(cleanName)) ?? null;
		if (userId) userMatched++;

		const existing = await prisma.tournamentParticipant.findFirst({
			where: {
				tournamentId: TOURNAMENT_ID,
				OR: [
					{ challongeParticipantId: challongePid },
					{ playerName: cleanName },
					...(userId ? [{ userId }] : []),
				],
			},
		});

		if (existing) {
			await prisma.tournamentParticipant.update({
				where: { id: existing.id },
				data: {
					challongeParticipantId: challongePid,
					playerName: cleanName,
					userId: existing.userId ?? userId,
					finalPlacement: POOL_ELIM_PLACEMENT,
					wins: 0,
					losses: 0,
					checkedIn: true,
				},
			});
			updated++;
			console.log(
				`  ✏️  ${cleanName.padEnd(30)} (poolRank=${s.rank}) [updated]`,
			);
		} else {
			await prisma.tournamentParticipant.create({
				data: {
					tournamentId: TOURNAMENT_ID,
					challongeParticipantId: challongePid,
					playerName: cleanName,
					userId,
					finalPlacement: POOL_ELIM_PLACEMENT,
					wins: 0,
					losses: 0,
					checkedIn: true,
				},
			});
			created++;
			console.log(
				`  ➕ ${cleanName.padEnd(30)} (poolRank=${s.rank}) [created]`,
			);
		}
	}

	console.log(
		`\n✅ ${created} créés, ${updated} updatés, ${userMatched}/${eliminated.length} matchés à un user RPB`,
	);

	// Re-sync stardust
	const { syncStardustRankingsToDb } = await import(
		"../src/lib/stardust-sync-bts"
	);
	console.log(`\n🏆 Re-sync stardust...`);
	const r = await syncStardustRankingsToDb(prisma);
	console.log(
		`   success=${r.success}${r.success ? ` count=${r.count}` : ` error=${(r as { error: string }).error}`}`,
	);

	// Print full ranking
	const all = await prisma.stardustRanking.findMany({
		orderBy: { rank: "asc" },
	});
	console.log(`\n🌠 Stardust ranking (${all.length} joueurs) :`);
	for (const r of all) {
		console.log(
			`   #${String(r.rank).padStart(2)} ${r.playerName.padEnd(28)} score=${String(r.score).padStart(6)}  ${r.wins}W/${r.losses}L  ${r.winRate}`,
		);
	}

	await prisma.$disconnect();
}

main().catch((err) => {
	console.error("💥", err);
	prisma.$disconnect().finally(() => process.exit(1));
});
