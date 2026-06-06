import { db, schema, eq, asc } from "../src/lib/db";

async function queryStardust() {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(schema.tournaments.id, "cmobvakra0001s7rog85nt10h"),
    with: {
      tournamentParticipants: {
        orderBy: asc(schema.tournamentParticipants.finalPlacement),
      },
    },
  });

  if (!tournament) {
    console.error("Tournament not found!");
    return;
  }

  console.log("Tournament name:", tournament.name);
  console.log("Status:", tournament.status);
  console.log("Participants count:", tournament.tournamentParticipants.length);

  console.log("\nTop 5 participants:");
  tournament.tournamentParticipants.slice(0, 5).forEach((p) => {
    console.log(`Rank: ${p.finalPlacement}, Player: ${p.playerName}, Seed: ${p.seed}`);
  });
}

queryStardust().catch(console.error);
