/**
 * Seed des « Beyblade Awards France 2025 » — concept phare de la communauté,
 * rapatrié depuis le Google Form officiel en sondages natifs (1 catégorie = 1 sondage
 * SINGLE, catégorie commune "Beyblade Awards France 2025"). Idempotent par slug.
 * Lancer : `cd apps/web && bun scripts/seed-awards.ts`.
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const AWARDS_CATEGORY = "Beyblade Awards France 2025";

const CATEGORIES: { title: string; nominees: string[] }[] = [
  { title: "Meilleur Blader 2025", nominees: ["Leirya", "Zeikuo", "Zeln", "Xymore", "Kamen Z"] },
  {
    title: "Meilleur Beycrafteur 2025",
    nominees: ["Kaious", "Eiko", "Hane Hoshi", "Sabo", "Lotteux"],
  },
  {
    title: "Meilleur Tiktokeur 2025",
    nominees: ["Lotteux", "Ours", "Loriane", "JsnBeyX", "Skarn"],
  },
  {
    title: "Le blader le plus beau",
    nominees: ["Younsi", "Turtle Boy", "Pounes", "Youn3s", "Hyoune-si"],
  },
  {
    title: "Les meilleures pressions de 2025",
    nominees: ["Sarah", "Barbatruq", "La femme de Kaious", "En pause", "L'harceleuse"],
  },
  { title: "Le plus gentil", nominees: ["Meiden", "Younsi", "Mimi", "Kaious", "Chad Light"] },
  {
    title: "Le Twittos de l'année 2025",
    nominees: ["Masamune", "Kamen Z", "Yorel", "Barbatruq", "Lotteux"],
  },
  {
    title: "La plus belle collection",
    nominees: ["Hane Hoshi/Eiko", "Kaious", "Lotteux", "Mister Fantôme", "Doctor"],
  },
  { title: "Le meilleur ingénieur/blader", nominees: ["Swpo", "Loup", "Berserk", "Eiko", "Wolfi"] },
  {
    title: "Le plus gros BDG de 2025",
    nominees: ["Azure", "Kaious", "Yoyo", "Lotteux", "Kamen Z"],
  },
  {
    title: "Le plus bel Xtreme Finish de 2025",
    nominees: [
      "Kaious sur Chouloup (BBT#15)",
      "Zeikuo sur Zeln (BBT#18 - Finale)",
      "SpiderAgent42 sur Flandres (BBT#18)",
      "Lotteux sur Yoorushi (BBT#15)",
      "Leirya sur Kaious (UFA#2 - Finale)",
    ],
  },
  {
    title: "Meilleur(e) Youtubeur(euse) de 2025",
    nominees: ["Ryuk", "Loriane", "Aka Blader", "Skarn", "Ours"],
  },
  { title: "Meilleur casteur", nominees: ["TPK", "Kaious", "Chad Light", "Masamune", "Tategami"] },
  {
    title: "Meilleur(e) arbitre",
    nominees: ["Shishi", "Hane Hoshi", "Kaious", "Younsi", "Fulguris"],
  },
  { title: "Meilleur Rookie de 2025", nominees: ["Illu", "Hyakutake", "Vincent", "Kironnah"] },
  {
    title: "Meilleur Kamen",
    nominees: ["Kamen Z", "Kamen S", "Kamen A", "Kamen A SENIOR", "Kamen 99"],
  },
  { title: "Le meilleur drip de 2025", nominees: ["Zeikuo", "Zeln", "Lotteux", "Paimy", "Sabo"] },
  {
    title: "Meilleur graphiste de 2025",
    nominees: ["Yeggron", "Yoorushi", "Lotteux", "Narugo", "Kaious", "SCE | Ayun", "Shishi"],
  },
  { title: "Meilleur artiste 2025", nominees: ["Berserk", "Paimy", "Mimi", "Meiden", "Yoorushi"] },
  {
    title: "Ballon d'Or Féminin 2025",
    nominees: [
      "Yoorushi",
      "Zeln",
      "Barbatruq",
      "Mimi",
      "Meiden",
      "Hane Hoshi",
      "Abi",
      "Stella",
      "Jadoudou",
    ],
  },
];

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function main() {
  console.log(`Seed ${AWARDS_CATEGORY}...`);
  let created = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const slug = `bawards-2025-${slugify(c.title)}`;
    const existing = await db.query.polls.findFirst({ where: eq(schema.polls.slug, slug) });
    if (existing) {
      console.log(`  = ${slug}`);
      continue;
    }
    const [poll] = await db
      .insert(schema.polls)
      .values({
        slug,
        question: c.title,
        description: `Catégorie des ${AWARDS_CATEGORY}. Vote pour ton favori !`,
        kind: "SINGLE",
        category: AWARDS_CATEGORY,
        isFeatured: i < 3,
        updatedAt: new Date().toISOString(),
      })
      .returning();
    await db
      .insert(schema.pollOptions)
      .values(c.nominees.map((label, j) => ({ pollId: poll!.id, label, displayOrder: j })));
    created++;
    console.log(`  + ${slug} (${c.nominees.length} nominés)`);
  }
  console.log(`Seed Awards terminé (${created} catégories créées sur ${CATEGORIES.length}).`);
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error("SEED AWARDS FAILED:", e);
    process.exit(1);
  });
