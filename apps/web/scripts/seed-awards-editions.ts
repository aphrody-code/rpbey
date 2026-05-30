/**
 * Seed des éditions Beyblade Awards (2025 publique + vidéo de résultats, 2026 cachée
 * pour préparation admin), clôture des sondages 2025, et enrichissement des avatars
 * de nominés via les membres Discord (table users). Idempotent.
 * Lancer : `cd apps/web && bun scripts/seed-awards-editions.ts`.
 */
import { db, schema } from "@rpbey/db";
import { and, eq, isNotNull } from "drizzle-orm";

const CAT_2025 = "Beyblade Awards France 2025";
const CAT_2026 = "Beyblade Awards France 2026";

async function ensureEdition(e: {
  year: number;
  slug: string;
  title: string;
  description: string;
  videoUrl: string | null;
  videoId: string | null;
  pollCategory: string;
  isPublished: boolean;
  isVotingOpen: boolean;
}) {
  const existing = await db.query.awardsEditions.findFirst({
    where: eq(schema.awardsEditions.year, e.year),
  });
  if (existing) {
    await db
      .update(schema.awardsEditions)
      .set({ videoUrl: e.videoUrl, videoId: e.videoId, updatedAt: new Date().toISOString() })
      .where(eq(schema.awardsEditions.id, existing.id));
    console.log(`  = édition ${e.year} (maj vidéo)`);
    return;
  }
  await db.insert(schema.awardsEditions).values({ ...e, updatedAt: new Date().toISOString() });
  console.log(`  + édition ${e.year} (publiée=${e.isPublished})`);
}

async function main() {
  console.log("Seed éditions Awards...");
  await ensureEdition({
    year: 2025,
    slug: "2025",
    title: CAT_2025,
    description:
      "Première édition des Beyblade Awards France — la cérémonie qui récompense la communauté FR de l'année 2025.",
    videoUrl: "https://youtube.com/watch?v=4T8SP5VmJpU",
    videoId: "4T8SP5VmJpU",
    pollCategory: CAT_2025,
    isPublished: true,
    isVotingOpen: false,
  });
  await ensureEdition({
    year: 2026,
    slug: "2026",
    title: CAT_2026,
    description: "Édition 2026 en préparation — réservée au staff jusqu'à l'ouverture des votes.",
    videoUrl: null,
    videoId: null,
    pollCategory: CAT_2026,
    isPublished: false,
    isVotingOpen: false,
  });

  // L'édition 2025 est passée : on clôt les votes (résultats visibles).
  const closed = await db
    .update(schema.polls)
    .set({ isClosed: true, updatedAt: new Date().toISOString() })
    .where(eq(schema.polls.category, CAT_2025))
    .returning({ id: schema.polls.id });
  console.log(`  ${closed.length} sondages 2025 clôturés (résultats publics).`);

  // Enrichissement des avatars de nominés depuis les membres Discord (table users).
  console.log("Enrichissement avatars nominés (Discord)...");
  const members = await db.query.users.findMany({
    where: isNotNull(schema.users.image),
    columns: { name: true, username: true, nickname: true, globalName: true, image: true },
  });
  const avatarByName = new Map<string, string>();
  for (const m of members) {
    for (const n of [m.name, m.username, m.nickname, m.globalName]) {
      if (n && m.image) avatarByName.set(n.trim().toLowerCase(), m.image);
    }
  }

  const awardsPolls = await db.query.polls.findMany({
    where: and(eq(schema.polls.category, CAT_2025)),
    columns: { id: true },
    with: { options: { columns: { id: true, label: true, imageUrl: true } } },
  });
  let enriched = 0;
  for (const p of awardsPolls) {
    for (const o of p.options) {
      if (o.imageUrl) continue;
      const hit = avatarByName.get(o.label.trim().toLowerCase());
      if (hit) {
        await db
          .update(schema.pollOptions)
          .set({ imageUrl: hit })
          .where(eq(schema.pollOptions.id, o.id));
        enriched++;
      }
    }
  }
  console.log(`  ${enriched} avatars de nominés appariés depuis Discord.`);
  console.log("Seed éditions terminé.");
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error("SEED EDITIONS FAILED:", e);
    process.exit(1);
  });
