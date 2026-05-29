#!/usr/bin/env bun
/**
 * Migration data/bey-library/bey-library-complete.json → table bey_library_parts.
 *
 * Idempotent : upsert par id. Re-run safe.
 *
 * Usage : bun scripts/migrate-bey-library.ts
 */

import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface BeyLibraryPart {
  id: string;
  category: string;
  name: string;
  code: string;
  type?: string | null;
  spin?: string | null;
  weight?: number | null;
  specs: Record<string, unknown>;
  imageUrl: string;
  variantCount: number;
  variants: unknown[];
  features?: string[];
  sourceUrl: string;
}

async function main() {
  const filePath = join(process.cwd(), "data/bey-library/bey-library-complete.json");
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    console.error(`[migrate-bey-library] missing: ${filePath}`);
    process.exit(1);
  }

  const parts = (await file.json()) as BeyLibraryPart[];
  console.log(`[migrate-bey-library] read ${parts.length} parts from JSON`);

  let upserted = 0;
  for (const p of parts) {
    await prisma.beyLibraryPart.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        category: p.category,
        name: p.name,
        code: p.code,
        type: p.type ?? null,
        spin: p.spin ?? null,
        weight: p.weight ?? null,
        specs: p.specs ?? {},
        imageUrl: p.imageUrl,
        variantCount: p.variantCount ?? 0,
        variants: p.variants ?? [],
        features: p.features ?? [],
        sourceUrl: p.sourceUrl,
      },
      update: {
        category: p.category,
        name: p.name,
        code: p.code,
        type: p.type ?? null,
        spin: p.spin ?? null,
        weight: p.weight ?? null,
        specs: p.specs ?? {},
        imageUrl: p.imageUrl,
        variantCount: p.variantCount ?? 0,
        variants: p.variants ?? [],
        features: p.features ?? [],
        sourceUrl: p.sourceUrl,
      },
    });
    upserted++;
    if (upserted % 50 === 0) {
      console.log(`  ...${upserted}/${parts.length}`);
    }
  }

  const total = await prisma.beyLibraryPart.count();
  console.log(`[migrate-bey-library] OK upserted=${upserted} totalDB=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
