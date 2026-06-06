import { db, schema } from "@rpbey/db";

async function main() {
  console.log("Connecting to DB to fetch categories...");
  const categories = await db.query.tournamentCategories.findMany();
  console.log("Categories in DB:", JSON.stringify(categories, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
