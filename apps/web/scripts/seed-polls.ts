/**
 * Seed des sondages + tier lists PRÉFAITES à partir des données réelles
 * (anime_series + beyblade-knowledge.json : 8001 entités taguées par génération).
 * Idempotent (skip si le slug existe déjà). Lancer : `cd apps/web && bun scripts/seed-polls.ts`.
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

interface KEntity {
  title: string;
  slug: string;
  type: string;
  generation: string | null;
  beyType: string | null;
  summary: string | null;
  imageUrl: string | null;
}
const knowledge = require("../data/beyblade-knowledge.json") as { entities: KEntity[] };

const GEN_LABEL: Record<string, string> = {
  ORIGINAL: "Bakuten (saga originale)",
  METAL: "Metal Saga",
  BURST: "Burst",
  X: "Beyblade X",
};

function nowIso() {
  return new Date().toISOString();
}

/** Sélectionne jusqu'à n entités notables (image + résumé) d'un type/génération. */
function pickSubjects(type: string, gen: string, n: number): KEntity[] {
  const seen = new Set<string>();
  return knowledge.entities
    .filter(
      (e) =>
        e.type === type &&
        e.generation === gen &&
        !!e.imageUrl &&
        !!e.title &&
        e.title.length <= 60 &&
        !/list of|category:|gallery/i.test(e.title),
    )
    .sort((a, b) => (b.summary?.length ?? 0) - (a.summary?.length ?? 0))
    .filter((e) => {
      const key = e.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, n);
}

async function ensurePoll(
  slug: string,
  data: {
    question: string;
    description?: string;
    kind: "SINGLE" | "MULTIPLE" | "RATING";
    category?: string;
    season?: "ORIGINAL" | "METAL" | "BURST" | "X" | null;
    isFeatured?: boolean;
    options: { label: string; imageUrl?: string }[];
  },
) {
  const existing = await db.query.polls.findFirst({ where: eq(schema.polls.slug, slug) });
  if (existing) {
    console.log(`  = poll ${slug} (déjà présent)`);
    return;
  }
  const [poll] = await db
    .insert(schema.polls)
    .values({
      slug,
      question: data.question,
      description: data.description ?? null,
      kind: data.kind,
      category: data.category ?? null,
      season: (data.season ?? null) as never,
      isFeatured: data.isFeatured ?? false,
      updatedAt: nowIso(),
    })
    .returning();
  await db.insert(schema.pollOptions).values(
    data.options.map((o, i) => ({
      pollId: poll!.id,
      label: o.label,
      imageUrl: o.imageUrl ?? null,
      displayOrder: i,
    })),
  );
  console.log(`  + poll ${slug} (${data.options.length} options)`);
}

async function ensureTierList(
  slug: string,
  data: {
    title: string;
    description?: string;
    kind: "BEY" | "CHARACTER" | "SEASON";
    season?: "ORIGINAL" | "METAL" | "BURST" | "X" | null;
    isFeatured?: boolean;
    subjects: { label: string; imageUrl?: string | null; refType?: string; refId?: string }[];
  },
) {
  const existing = await db.query.tierLists.findFirst({ where: eq(schema.tierLists.slug, slug) });
  if (existing) {
    console.log(`  = tier list ${slug} (déjà présente)`);
    return;
  }
  if (data.subjects.length < 3) {
    console.log(`  ! tier list ${slug} ignorée (${data.subjects.length} sujets < 3)`);
    return;
  }
  const [tl] = await db
    .insert(schema.tierLists)
    .values({
      slug,
      title: data.title,
      description: data.description ?? null,
      kind: data.kind,
      season: (data.season ?? null) as never,
      isFeatured: data.isFeatured ?? false,
      updatedAt: nowIso(),
    })
    .returning();
  await db.insert(schema.tierListSubjects).values(
    data.subjects.map((s, i) => ({
      tierListId: tl!.id,
      label: s.label,
      imageUrl: s.imageUrl ?? null,
      refType: s.refType ?? null,
      refId: s.refId ?? null,
      displayOrder: i,
    })),
  );
  console.log(`  + tier list ${slug} (${data.subjects.length} sujets)`);
}

async function main() {
  console.log("Seed sondages...");

  // Quelques lames Beyblade X réelles pour un sondage méta.
  const xBlades = await db.query.beyblades.findMany({
    columns: { name: true, imageUrl: true },
    limit: 6,
  });

  await ensurePoll("meilleure-generation-beyblade", {
    question: "Quelle est la meilleure génération de Beyblade ?",
    description: "Le débat éternel de la communauté. Vote pour ta saga préférée.",
    kind: "SINGLE",
    category: "Général",
    isFeatured: true,
    options: [
      { label: "Bakuten (Original)" },
      { label: "Metal Saga" },
      { label: "Burst" },
      { label: "Beyblade X" },
    ],
  });

  await ensurePoll("type-de-toupie-prefere", {
    question: "Quel type de toupie préfères-tu jouer ?",
    kind: "SINGLE",
    category: "Gameplay",
    isFeatured: true,
    options: [
      { label: "Attaque" },
      { label: "Défense" },
      { label: "Endurance" },
      { label: "Équilibre" },
    ],
  });

  await ensurePoll("deck-ideal-taille", {
    question: "Combien de toupies dans ton deck idéal ?",
    kind: "SINGLE",
    category: "Gameplay",
    options: [{ label: "3 (format tournoi)" }, { label: "5" }, { label: "10 et plus" }],
  });

  await ensurePoll("tournoi-vs-casual", {
    question: "Tu joues plutôt en tournoi ou en casual ?",
    kind: "SINGLE",
    category: "Communauté",
    options: [
      { label: "Tournoi compétitif" },
      { label: "Casual entre amis" },
      { label: "Les deux" },
    ],
  });

  if (xBlades.length >= 3) {
    await ensurePoll("beyblade-x-meta-lame", {
      question: "Beyblade X : quelle lame domine la méta selon toi ?",
      kind: "SINGLE",
      category: "Méta",
      season: "X",
      options: xBlades.map((b) => ({ label: b.name, imageUrl: b.imageUrl ?? undefined })),
    });
  }

  await ensurePoll("features-rpbey-souhaitees", {
    question: "Quelles fonctionnalités veux-tu voir grandir sur RPBey ?",
    description: "Choix multiple — coche tout ce qui t'intéresse.",
    kind: "MULTIPLE",
    category: "Communauté",
    isFeatured: true,
    options: [
      { label: "Gacha / TCG" },
      { label: "Tournois & classements" },
      { label: "Tier lists communautaires" },
      { label: "Chat d'équipe" },
      { label: "Wiki & lore" },
      { label: "Duels en ligne" },
    ],
  });

  console.log("Seed tier lists...");

  // Tier list des saisons (anime_series réelles).
  const series = await db.query.animeSeries.findMany({
    columns: { id: true, title: true, slug: true, generation: true },
    limit: 30,
  });
  if (series.length >= 3) {
    await ensureTierList("tier-list-saisons-beyblade", {
      title: "Tier list des saisons de Beyblade",
      description: "Classe toutes les saisons de l'anime, de la meilleure à la pire.",
      kind: "SEASON",
      isFeatured: true,
      subjects: series.map((s) => ({
        label: s.title,
        refType: "anime_series",
        refId: s.id,
      })),
    });
  }

  // Tier lists beys + personnages par génération (depuis knowledge.json).
  for (const gen of ["ORIGINAL", "METAL", "BURST", "X"] as const) {
    const beys = pickSubjects("bey", gen, 18);
    await ensureTierList(`tier-list-beys-${gen.toLowerCase()}`, {
      title: `Tier list des toupies — ${GEN_LABEL[gen]}`,
      description: `Classe les toupies emblématiques de la génération ${GEN_LABEL[gen]}.`,
      kind: "BEY",
      season: gen,
      isFeatured: gen === "X",
      subjects: beys.map((e) => ({
        label: e.title,
        imageUrl: e.imageUrl,
        refType: "bey",
        refId: e.slug,
      })),
    });

    const chars = pickSubjects("character", gen, 18);
    await ensureTierList(`tier-list-personnages-${gen.toLowerCase()}`, {
      title: `Tier list des personnages — ${GEN_LABEL[gen]}`,
      description: `Classe les bladers et personnages de la génération ${GEN_LABEL[gen]}.`,
      kind: "CHARACTER",
      season: gen,
      subjects: chars.map((e) => ({
        label: e.title,
        imageUrl: e.imageUrl,
        refType: "character",
        refId: e.slug,
      })),
    });
  }

  console.log("Seed terminé.");
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error("SEED FAILED:", e);
    process.exit(1);
  });
