#!/usr/bin/env bun
/**
 * Import all BTS{N} exports (`data/exports/B_TS{N}.json`) into the DB.
 *
 * Idempotent : upsert Tournament (clé `challongeId = String(metadata.id)`),
 * upsert TournamentParticipant et TournamentMatch sur leurs Challonge IDs.
 *
 * Permet à `/rankings` (option A) d'afficher les brackets DB pour BTS1-4.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

interface BtsParticipantExport {
	id: number;
	name: string;
	finalRank?: number | null;
	seed?: number;
	challongeUsername?: string | null;
}

interface BtsMatchExport {
	id: number;
	round: number;
	identifier?: number;
	player1Id: number | null;
	player2Id: number | null;
	winnerId: number | null;
	loserId: number | null;
	scores?: string;
	state: string;
}

interface BtsExport {
	metadata?: {
		id?: number;
		name?: string;
		url?: string;
		state?: string;
		type?: string;
		startedAt?: string | null;
		completedAt?: string | null;
		participantsCount?: number;
	};
	participants?: BtsParticipantExport[];
	matches?: BtsMatchExport[];
}

const APPROX_DATES: Record<number, string> = {
	1: "2025-01-15",
	2: "2025-05-15",
	3: "2026-01-15",
	4: "2026-04-26",
};

async function importBts(n: number): Promise<{
	slug: string;
	tournamentId: string;
	participantsImported: number;
	matchesImported: number;
}> {
	const slug = `BTS${n}`;
	const path = join(process.cwd(), "data", "exports", `B_TS${n}.json`);
	const raw = await readFile(path, "utf-8");
	const data = JSON.parse(raw) as BtsExport;

	const meta = data.metadata ?? {};
	const challongeId = meta.id ? String(meta.id) : null;
	if (!challongeId) throw new Error(`${slug}: metadata.id manquant`);

	const niceName =
		meta.name && meta.name !== "Tournoi Importé"
			? meta.name
			: `BEY-TAMASHII SÉRIES #${n}`;

	const date = meta.startedAt
		? new Date(meta.startedAt)
		: new Date(APPROX_DATES[n] ?? "2025-01-01");

	const tournament = await prisma.tournament.upsert({
		where: { challongeId },
		create: {
			challongeId,
			challongeUrl: meta.url ?? `https://challonge.com/B_TS${n}`,
			challongeState: meta.state ?? "complete",
			name: niceName,
			format: meta.type ?? "double elimination",
			date,
			status: "COMPLETE",
			maxPlayers: meta.participantsCount ?? data.participants?.length ?? 64,
		},
		update: {
			challongeUrl: meta.url ?? `https://challonge.com/B_TS${n}`,
			challongeState: meta.state ?? "complete",
			name: niceName,
			format: meta.type ?? "double elimination",
			status: "COMPLETE",
		},
	});

	// Participants : compute wins/losses from matches (in case the export
	// only carries finalRank without W/L per participant).
	const participants = data.participants ?? [];
	const matches = data.matches ?? [];

	const winsBy = new Map<number, number>();
	const lossesBy = new Map<number, number>();
	for (const m of matches) {
		if (m.state !== "complete") continue;
		if (m.winnerId != null)
			winsBy.set(m.winnerId, (winsBy.get(m.winnerId) ?? 0) + 1);
		if (m.loserId != null)
			lossesBy.set(m.loserId, (lossesBy.get(m.loserId) ?? 0) + 1);
	}

	const idToName = new Map<number, string>();
	for (const p of participants) idToName.set(p.id, p.name);

	// Wipe + bulk insert (idempotent, 1 deleteMany + 1 createMany par table).
	// Beaucoup plus rapide que des upserts unitaires (~840 round-trips → 4).
	await prisma.$transaction([
		prisma.tournamentMatch.deleteMany({
			where: { tournamentId: tournament.id },
		}),
		prisma.tournamentParticipant.deleteMany({
			where: {
				tournamentId: tournament.id,
				userId: null, // ne touche pas les participants liés à un compte
			},
		}),
		prisma.tournamentParticipant.createMany({
			data: participants.map((p) => ({
				tournamentId: tournament.id,
				challongeParticipantId: String(p.id),
				playerName: p.name,
				seed: p.seed ?? null,
				finalPlacement: p.finalRank ?? null,
				wins: winsBy.get(p.id) ?? 0,
				losses: lossesBy.get(p.id) ?? 0,
			})),
			skipDuplicates: true,
		}),
		prisma.tournamentMatch.createMany({
			data: matches.map((m) => ({
				tournamentId: tournament.id,
				challongeMatchId: String(m.id),
				round: m.round,
				player1Name:
					m.player1Id != null ? (idToName.get(m.player1Id) ?? null) : null,
				player2Name:
					m.player2Id != null ? (idToName.get(m.player2Id) ?? null) : null,
				winnerName:
					m.winnerId != null ? (idToName.get(m.winnerId) ?? null) : null,
				score: m.scores ?? null,
				state: m.state,
			})),
			skipDuplicates: true,
		}),
	]);

	return {
		slug,
		tournamentId: tournament.id,
		participantsImported: participants.length,
		matchesImported: matches.length,
	};
}

async function main() {
	const results = [];
	for (const n of [1, 2, 3, 4]) {
		try {
			const r = await importBts(n);
			console.log(
				`✓ ${r.slug} (${r.tournamentId}) — ${r.participantsImported} joueurs, ${r.matchesImported} matches`,
			);
			results.push(r);
		} catch (err) {
			console.error(
				`✗ BTS${n} :`,
				err instanceof Error ? err.message : String(err),
			);
		}
	}
	console.log(`\n${results.length} tournois importés.`);
	await prisma.$disconnect();
}

await main();
