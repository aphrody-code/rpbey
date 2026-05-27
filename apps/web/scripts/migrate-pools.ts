#!/usr/bin/env bun
/**
 * Migration data/pools/<challongeId>.json → tournaments.poolStructure (jsonb).
 *
 * Cherche le tournoi par challongeId, écrit le payload pool dans Tournament.poolStructure.
 * Si pas de tournoi correspondant, log un warning et skip.
 *
 * Idempotent : update direct.
 *
 * Usage : bun scripts/migrate-pools.ts
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
	const dir = join(process.cwd(), "data/pools");
	let files: string[];
	try {
		files = await readdir(dir);
	} catch {
		console.warn(`[migrate-pools] no data/pools dir`);
		return;
	}
	const json = files.filter((f) => f.endsWith(".json"));
	console.log(`[migrate-pools] ${json.length} files`);

	let updated = 0;
	let skipped = 0;
	for (const file of json) {
		const challongeId = file.replace(/\.json$/, "");
		const payload = await Bun.file(join(dir, file)).json();

		const t = await prisma.tournament.findFirst({
			where: { OR: [{ challongeId }, { id: challongeId }] },
			select: { id: true },
		});
		if (!t) {
			console.warn(`  no tournament matches '${challongeId}' (skipped)`);
			skipped++;
			continue;
		}
		await prisma.tournament.update({
			where: { id: t.id },
			data: { poolStructure: payload as never },
		});
		updated++;
	}

	console.log(`[migrate-pools] OK updated=${updated} skipped=${skipped}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
