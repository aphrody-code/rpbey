import { db } from "@rpbey/db";

async function main() {
  const ts = await db.query.tournaments.findMany({
    with: {
      tournamentCategory: true,
    },
  });
  console.log("Tournaments in DB:");
  console.log(
    ts.map((t) => ({
      id: t.id,
      challongeId: t.challongeId,
      name: t.name,
      status: t.status,
      categoryName: t.tournamentCategory?.name || "None",
      categoryColor: t.tournamentCategory?.color || "None",
    })),
  );
  process.exit(0);
}

main().catch(console.error);
