import { sql } from "drizzle-orm";
import { db, client } from "../src/client";
import {
  users,
  parts,
  gachaCards,
  globalRankings,
  profiles,
  tournaments,
  sessions,
} from "../src/schema";

const expected: Record<string, number> = {
  users: 101,
  parts: 437,
  gacha_cards: 126,
  global_rankings: 151,
  profiles: 53,
  tournaments: 6,
  sessions: 18,
};

const tables = {
  users,
  parts,
  gacha_cards: gachaCards,
  global_rankings: globalRankings,
  profiles,
  tournaments,
  sessions,
} as const;

let ok = true;
for (const [label, table] of Object.entries(tables)) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  const exp = expected[label];
  const mark = n === exp ? "OK " : "FAIL";
  if (n !== exp) ok = false;
  console.log(`${mark} ${label.padEnd(16)} drizzle=${n} expected=${exp}`);
}

await client.end();
console.log(ok ? "\nPARITY OK" : "\nPARITY MISMATCH");
process.exit(ok ? 0 : 1);
