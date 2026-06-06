import { db, schema, eq, count } from "../src/lib/db";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BTS_EDITIONS = [
  { id: "bts1", file: "B_TS1.json", name: "Bey-Tamashii Séries #1", challongeId: "B_TS1" },
  { id: "bts2", file: "B_TS2.json", name: "Bey-Tamashii Séries #2", challongeId: "B_TS2" },
  { id: "bts3", file: "B_TS3.json", name: "Bey-Tamashii Séries #3", challongeId: "B_TS3" },
  { id: "bts4", file: "B_TS4.json", name: "Bey-Tamashii Séries #4", challongeId: "B_TS4" },
  { id: "bts5", file: "B_TS5.json", name: "Bey-Tamashii Séries #5", challongeId: "B_TS5" },
  {
    id: "stardust1",
    file: "../pools/T_SS1.json",
    name: "The Stardust Series #1",
    challongeId: "T_SS1",
  },
];

async function analyze() {
  console.log("=== ANALYZING TOURNAMENTS IN NEON DB vs JSON EXPORTS ===\n");

  for (const edition of BTS_EDITIONS) {
    console.log(`--- ${edition.name} (Challonge ID: ${edition.challongeId}) ---`);

    // Load JSON file
    const isStardust = edition.id === "stardust1";
    const jsonPath = isStardust
      ? join(process.cwd(), "apps/web/data/pools", "T_SS1.json")
      : join(process.cwd(), "apps/web/data/exports", edition.file);
    let jsonParticipantsCount = 0;
    let jsonMatchesCount = 0;

    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
        jsonParticipantsCount = data.participantsCount || data.participants?.length || 0;
        jsonMatchesCount = data.matchesCount || data.matches?.length || 0;

        if (isStardust) {
          // Add bracket stage matches from the double elimination scrape file
          const bracketPath = join(
            process.cwd(),
            "apps/web/data/scrapes",
            "T_SS1_2026-05-03T17-20-22-884Z.json",
          );
          if (existsSync(bracketPath)) {
            const bracketData = JSON.parse(readFileSync(bracketPath, "utf-8"));
            const bracketMatches = bracketData.matches?.length || 0;
            console.log(
              `[Stardust] Pools matches: ${jsonMatchesCount}, Bracket matches: ${bracketMatches}`,
            );
            jsonMatchesCount += bracketMatches;
          }
        }

        console.log(
          `JSON Stats: Participants: ${jsonParticipantsCount}, Matches: ${jsonMatchesCount}`,
        );
      } catch (err) {
        console.error(`Error reading JSON ${edition.file}:`, err);
      }
    } else {
      console.log(`JSON File NOT found at ${jsonPath}`);
    }

    // Query DB
    const dbTournament = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.challongeId, edition.challongeId),
      with: {
        tournamentParticipants: true,
      },
    });

    if (!dbTournament) {
      console.log("DB Stats: NOT FOUND IN DB!\n");
      continue;
    }

    // Count matches in DB
    const dbMatchesCount = await db
      .select({ value: count() })
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.tournamentId, dbTournament.id));

    const matchesVal = dbMatchesCount[0]?.value ?? 0;
    const participantsVal = dbTournament.tournamentParticipants?.length ?? 0;

    console.log(`DB Stats:   Participants: ${participantsVal}, Matches: ${matchesVal}`);
    console.log(`DB Status:  ${dbTournament.status}`);

    const partDiff = participantsVal - jsonParticipantsCount;
    const matchDiff = matchesVal - jsonMatchesCount;
    if (partDiff === 0 && matchDiff === 0) {
      console.log("Result:     ✅ PERFECT MATCH!");
    } else {
      console.log(
        `Result:     ⚠️ MISMATCH! Diff: Participants: ${partDiff}, Matches: ${matchDiff}`,
      );
    }
    console.log("");
  }
}

analyze().catch(console.error);
