#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Test de concurrence : prouve que le verrou `SELECT … FOR UPDATE` (lockProfileTx)
 * empêche l'overspend. Profil jetable doté de 120 🪙 (= 2 tirages à 50) ; on tire
 * 8 fois EN PARALLÈLE. Sans verrou, plusieurs tirages liraient le même solde et
 * débiteraient → solde négatif. Avec verrou : exactement 2 succès, solde final 20,
 * jamais négatif.
 *
 *   bun test/concurrency.ts
 */
import crypto from "node:crypto";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const PORT = 5061;
const BASE = `http://127.0.0.1:${PORT}`;
const log = (m: string) => process.stderr.write(`${m}\n`);

const START = 120;
const PULL_COST = 50;
const FIRE = 8;
const EXPECTED_SUCCESS = Math.floor(START / PULL_COST); // 2

const userId = crypto.randomUUID();
const token = crypto.randomBytes(16).toString("hex");

async function cleanup() {
  await db.delete(schema.cardInventory).where(eq(schema.cardInventory.userId, userId));
  await db
    .delete(schema.currencyTransactions)
    .where(eq(schema.currencyTransactions.userId, userId));
  await db.delete(schema.profiles).where(eq(schema.profiles.userId, userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

await cleanup();
await db.insert(schema.users).values({
  id: userId,
  name: "ConcurrencyTest",
  email: `${userId}@concurrency.test`,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});
await db.insert(schema.profiles).values({ userId, currency: START });
await db.insert(schema.sessions).values({
  id: crypto.randomUUID(),
  userId,
  token,
  expiresAt: new Date(Date.now() + 3_600_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  userAgent: "concurrencytest",
});

const child = Bun.spawn(["bun", "src/index.ts"], {
  cwd: import.meta.dir + "/..",
  env: { ...process.env, GACHA_PORT: String(PORT) },
  stdout: "ignore",
  stderr: "ignore",
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const auth = {
  Authorization: `Bearer ${token}`,
  "content-type": "application/json",
};
let failures = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) log(`  ✓ ${name}`);
  else {
    failures++;
    log(`  ✗ ${name} ${detail}`);
  }
};

try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {
      /* not ready */
    }
    await sleep(300);
  }

  // 8 tirages EN PARALLÈLE.
  const results = await Promise.all(
    Array.from({ length: FIRE }, () =>
      fetch(`${BASE}/api/gacha/pull`, {
        method: "POST",
        headers: auth,
        body: "{}",
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false, error: { code: "NETWORK" } })),
    ),
  );
  const ok = results.filter((r) => (r as { ok?: boolean }).ok === true).length;
  const insufficient = results.filter(
    (r) => (r as { error?: { code?: string } }).error?.code === "INSUFFICIENT_FUNDS",
  ).length;

  const balRow = await db
    .select({ c: schema.profiles.currency })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  const finalBalance = balRow[0]?.c ?? -999;

  log(`  → ${ok} succès, ${insufficient} INSUFFICIENT_FUNDS, solde final ${finalBalance}`);
  check("exactement 2 tirages réussis", ok === EXPECTED_SUCCESS, `ok=${ok}`);
  check("solde final jamais négatif", finalBalance >= 0, `bal=${finalBalance}`);
  check(
    "solde final cohérent (120 - 50×succès)",
    finalBalance === START - PULL_COST * ok,
    `bal=${finalBalance} attendu=${START - PULL_COST * ok}`,
  );
  check("le reste = INSUFFICIENT_FUNDS", ok + insufficient === FIRE, `${ok}+${insufficient}`);
} finally {
  child.kill();
  await cleanup();
}

log(
  failures === 0
    ? "\n[concurrency] ✅ verrou OK — pas d'overspend"
    : `\n[concurrency] ❌ ${failures} échec(s)`,
);
process.exit(failures === 0 ? 0 : 1);
