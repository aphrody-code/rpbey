/**
 * Clean + mise à jour de TOUS les profils joueur (`profiles`).
 *
 * Deux corrections idempotentes :
 *   1. Crée la ligne `profiles` manquante pour chaque `users` qui n'en a pas
 *      (le profil était créé paresseusement au 1er PATCH /api/profile → les comptes
 *      importés / bot-only n'en avaient jamais).
 *   2. Renseigne `bladerName` quand il est NULL/vide, à partir du meilleur nom
 *      disponible sur le compte (globalName → nickname → name → username → fallback).
 *
 * Aucune donnée existante non vide n'est écrasée. Lancer :
 *   cd apps/web && bun scripts/backfill-profiles.ts
 */
import { createId } from "@paralleldrive/cuid2";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

function bestBladerName(u: {
  id: string;
  name: string | null;
  username: string | null;
  globalName: string | null;
  nickname: string | null;
}): string {
  const candidates = [u.globalName, u.nickname, u.name, u.username];
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t.slice(0, 60);
  }
  return `Blader-${u.id.slice(0, 6)}`;
}

async function main() {
  const users = await db.query.users.findMany({
    columns: { id: true, name: true, username: true, globalName: true, nickname: true },
    with: { profiles: { columns: { id: true, bladerName: true } } },
  });

  if (users.length === 0) {
    console.error(
      "0 user chargé — cache transpiler Bun probablement stale. Lance `rm -rf /tmp/bun/*` puis relance.",
    );
    process.exit(1);
  }

  let created = 0;
  let backfilled = 0;
  const now = new Date().toISOString();

  for (const u of users) {
    const profile = u.profiles[0] ?? null;
    const name = bestBladerName(u);

    if (!profile) {
      await db.insert(schema.profiles).values({
        id: createId(),
        userId: u.id,
        bladerName: name,
        updatedAt: now,
      } as typeof schema.profiles.$inferInsert);
      created += 1;
      continue;
    }

    if (!profile.bladerName || profile.bladerName.trim() === "") {
      await db
        .update(schema.profiles)
        .set({ bladerName: name, updatedAt: now })
        .where(eq(schema.profiles.id, profile.id));
      backfilled += 1;
    }
  }

  const [{ value: totalProfiles }] = await db
    .select({ value: schema.profiles.id })
    .from(schema.profiles)
    .then((rows) => [{ value: rows.length }]);

  console.log(
    `Backfill terminé — users=${users.length} | profils créés=${created} | bladerName backfillés=${backfilled} | profils totaux=${totalProfiles}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec du backfill:", err);
  process.exit(1);
});
