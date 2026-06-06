import { db, schema, sql, count } from "@/lib/db";

async function main() {
  console.log("--- DB TABLES COUNT ---");
  const usersCount = await db.select({ value: count() }).from(schema.users);
  const partsCount = await db.select({ value: count() }).from(schema.parts);
  const tournamentsCount = await db.select({ value: count() }).from(schema.tournaments);
  const matchesCount = await db.select({ value: count() }).from(schema.tournamentMatches);
  const participantsCount = await db.select({ value: count() }).from(schema.tournamentParticipants);

  console.log(`Users: ${usersCount[0]?.value}`);
  console.log(`Parts: ${partsCount[0]?.value}`);
  console.log(`Tournaments: ${tournamentsCount[0]?.value}`);
  console.log(`Matches: ${matchesCount[0]?.value}`);
  console.log(`Participants: ${participantsCount[0]?.value}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
