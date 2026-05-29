#!/usr/bin/env bun
/**
 * Migration data/{wb_history,satr_history,exports}/<slug>.json → table legacy_tournament_archives.
 *
 * Source = wb | satr | bts. Slug = nom de fichier sans extension.
 *
 * Idempotent : upsert par slug. Re-run safe.
 *
 * Usage : bun scripts/migrate-legacy-tournaments.ts
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface Source {
  dir: string;
  source: "wb" | "satr" | "bts";
  prefix?: string;
}

const SOURCES: Source[] = [
  { dir: "data/wb_history", source: "wb" },
  { dir: "data/satr_history", source: "satr" },
  { dir: "data/exports", source: "bts" },
];

async function main() {
  let total = 0;
  for (const { dir, source } of SOURCES) {
    const fullDir = join(process.cwd(), dir);
    let files: string[];
    try {
      files = await readdir(fullDir);
    } catch {
      console.warn(`[migrate-legacy-tournaments] skip missing dir ${dir}`);
      continue;
    }
    const valid = files.filter(
      (f) => f.endsWith(".json") && !f.includes(".bak-") && !f.endsWith(".raw.json"),
    );

    console.log(`[migrate-legacy-tournaments] ${source}: ${valid.length} files`);
    for (const file of valid.sort()) {
      const slug = file.replace(/\.json$/, "");
      // Skip non-tournament files in exports/
      if (source === "bts" && !/^B_TS\d+$/.test(slug)) {
        continue;
      }
      const filePath = join(fullDir, file);
      let payload: unknown;
      try {
        payload = await Bun.file(filePath).json();
      } catch (e) {
        console.warn(`  skip ${file}: parse error ${e}`);
        continue;
      }
      await prisma.legacyTournamentArchive.upsert({
        where: { slug },
        create: { slug, source, payload: payload as never },
        update: { source, payload: payload as never },
      });
      total++;
      if (total % 5 === 0) console.log(`  ...${total}`);
    }
  }

  const dbCount = await prisma.legacyTournamentArchive.count();
  console.log(`[migrate-legacy-tournaments] OK upserted=${total} totalDB=${dbCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
