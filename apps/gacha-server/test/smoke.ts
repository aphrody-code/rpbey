#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Smoke test auto-contenu : démarre le serveur en enfant, minte une session
 * Bearer (table partagée), tape les endpoints économie clés, vérifie les
 * enveloppes attendues par le client, nettoie, exit.
 *
 *   bun test/smoke.ts
 */
import crypto from "node:crypto";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const PORT = 5057;
const BASE = `http://127.0.0.1:${PORT}`;
const log = (m: string) => process.stderr.write(`${m}\n`);

// 1. session de test
const u = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0];
if (!u) {
  log("Aucun user en DB — smoke impossible.");
  process.exit(1);
}
const token = crypto.randomBytes(16).toString("hex");
await db.insert(schema.sessions).values({
  id: crypto.randomUUID(),
  userId: u.id,
  token,
  expiresAt: new Date(Date.now() + 3_600_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  userAgent: "smoketest",
});

// 2. serveur enfant
const child = Bun.spawn(["bun", "src/index.ts"], {
  cwd: import.meta.dir + "/..",
  env: { ...process.env, GACHA_PORT: String(PORT) },
  stdout: "pipe",
  stderr: "pipe",
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const auth = { Authorization: `Bearer ${token}` };
const authJson = { ...auth, "content-type": "application/json" };
let failures = 0;

async function waitHealthy(): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(300);
  }
  return false;
}

function check(name: string, cond: boolean, detail = "") {
  if (cond) log(`  ✓ ${name}`);
  else {
    failures++;
    log(`  ✗ ${name} ${detail}`);
  }
}

try {
  const healthy = await waitHealthy();
  check("boot + /health", healthy);
  if (!healthy) throw new Error("serveur non démarré");

  const noauth = await fetch(`${BASE}/api/gacha/balance`);
  check("401 sans token", noauth.status === 401);

  const bal = (await (await fetch(`${BASE}/api/gacha/balance`, { headers: auth })).json()) as {
    currency?: number;
    userId?: string;
  };
  check("balance", typeof bal.currency === "number" && bal.userId === u.id, JSON.stringify(bal));

  const rates = (await (await fetch(`${BASE}/api/gacha/rates`, { headers: auth })).json()) as {
    ok?: boolean;
    pityThreshold?: number;
  };
  check("rates", rates.ok === true && rates.pityThreshold === 3);

  const pull = (await (
    await fetch(`${BASE}/api/gacha/pull`, {
      method: "POST",
      headers: authJson,
      body: "{}",
    })
  ).json()) as {
    ok?: boolean;
    result?: { newBalance?: number };
    error?: { code?: string };
  };
  check(
    "pull (ok ou INSUFFICIENT_FUNDS)",
    pull.ok === true || pull.error?.code === "INSUFFICIENT_FUNDS",
    JSON.stringify(pull).slice(0, 120),
  );

  const badges = (await (await fetch(`${BASE}/api/gacha/badges`, { headers: auth })).json()) as {
    ok?: boolean;
    progress?: { uniqueCards?: number };
  };
  check("badges", badges.ok === true && typeof badges.progress?.uniqueCards === "number");

  const lb = (await (
    await fetch(`${BASE}/api/leaderboard/currency?limit=3`, { headers: auth })
  ).json()) as { ok?: boolean; entries?: unknown[] };
  check("leaderboard", lb.ok === true && Array.isArray(lb.entries));
} finally {
  child.kill();
  await db.delete(schema.sessions).where(eq(schema.sessions.userAgent, "smoketest"));
}

log(failures === 0 ? "\n[smoke] ✅ tous les checks passent" : `\n[smoke] ❌ ${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
