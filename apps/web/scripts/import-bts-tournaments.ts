import { db, schema, eq, and, or } from "../src/lib/db";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BTS_EDITIONS = [
  {
    id: "bts1",
    file: "B_TS1.json",
    name: "Bey-Tamashii Séries #1",
    challongeId: "B_TS1",
    posterUrl: "/tournaments/BTS1_poster.webp",
  },
  {
    id: "bts2",
    file: "B_TS2.json",
    name: "Bey-Tamashii Séries #2",
    challongeId: "B_TS2",
    posterUrl: "/tournaments/BTS2.webp",
  },
  {
    id: "bts3",
    file: "B_TS3.json",
    name: "Bey-Tamashii Séries #3",
    challongeId: "B_TS3",
    posterUrl: "/tournaments/BTS3_poster.webp",
  },
  {
    id: "bts4",
    file: "B_TS4.json",
    name: "Bey-Tamashii Séries #4",
    challongeId: "B_TS4",
    posterUrl: "/tournaments/BTS4_poster.webp",
  },
  {
    id: "bts5",
    file: "B_TS5.json",
    name: "Bey-Tamashii Séries #5",
    challongeId: "B_TS5",
    posterUrl: "/tournaments/BTS5_poster.gif",
  },
];

function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const [before] = raw.split("/");
  return (before ?? raw).trim();
}

async function run() {
  console.log("=== STARTING BTS TOURNAMENT IMPORT TO NEON DB ===\n");

  // 1. Ensure category exists
  const categoryResult = await db
    .select()
    .from(schema.tournamentCategories)
    .where(eq(schema.tournamentCategories.name, "Bey-Tamashii Séries"));
  let category = categoryResult[0];

  if (!category) {
    console.log("Creating category 'Bey-Tamashii Séries'...");
    const res = await db
      .insert(schema.tournamentCategories)
      .values({
        name: "Bey-Tamashii Séries",
        multiplier: 1.0,
        color: "var(--rpb-primary)",
        logoUrl: "/logo.webp",
      })
      .returning();
    category = res[0];
  }
  console.log(`Using Category: ${category.name} (id=${category.id})`);

  // 2. Fetch all users to map user IDs
  const allUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      username: schema.users.username,
      bladerName: schema.profiles.bladerName,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id));

  const userByKey = new Map<string, string>();
  for (const u of allUsers) {
    for (const candidate of [u.name, u.username, u.bladerName]) {
      const k = normalizeName(candidate ?? undefined).toLowerCase();
      if (k) userByKey.set(k, u.id);
    }
  }
  console.log(`Loaded ${allUsers.length} users for mapping.`);

  // 3. Process each tournament JSON
  for (const ed of BTS_EDITIONS) {
    const jsonPath = join(process.cwd(), "apps/web/data/exports", ed.file);
    if (!existsSync(jsonPath)) {
      console.log(`⚠️ Skip: File not found at ${jsonPath}`);
      continue;
    }

    console.log(`\nImporting ${ed.name} (${ed.challongeId})...`);
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const metadata = data.metadata;
    const participants = data.participants || [];
    const matches = data.matches || [];

    const completedAt = metadata.completedAt || metadata.startedAt || new Date().toISOString();

    // Find tournament row
    const tournamentResult = await db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.challongeId, ed.challongeId));
    let tournament = tournamentResult[0];

    const tournamentValues = {
      name: ed.name,
      description: ed.name,
      date: completedAt,
      challongeId: ed.challongeId,
      challongeUrl: metadata.url || `https://challonge.com/${ed.challongeId}`,
      challongeState: metadata.state || "complete",
      status: "COMPLETE" as const,
      categoryId: category.id,
      standings: data.standings || [],
      stations: data.stations || [],
      activityLog: data.log || [],
      posterUrl: ed.posterUrl,
      maxPlayers: metadata.participantsCount || 64,
    };

    if (tournament) {
      console.log(`Tournament row exists (id=${tournament.id}), updating...`);
      await db
        .update(schema.tournaments)
        .set(tournamentValues)
        .where(eq(schema.tournaments.id, tournament.id));
    } else {
      console.log("Creating new tournament row...");
      const res = await db
        .insert(schema.tournaments)
        .values({
          id: ed.id, // Keep the static ID 'bts1', 'bts2', etc.
          ...tournamentValues,
        })
        .returning();
      tournament = res[0];
    }

    const tournamentId = tournament.id;
    console.log(`Tournament ID: ${tournamentId}`);

    // Map participants
    const challongeIdToUser = new Map<number, string | null>();
    const challongeIdToName = new Map<number, string>();
    let pCreated = 0;
    let pUpdated = 0;

    for (const p of participants) {
      const cleanName = normalizeName(p.name);
      challongeIdToName.set(p.id, cleanName);
      const userId = userByKey.get(cleanName.toLowerCase()) ?? null;
      challongeIdToUser.set(p.id, userId);

      const standing = (data.standings || []).find(
        (s: any) => normalizeName(s.name).toLowerCase() === cleanName.toLowerCase(),
      );
      const finalPlacement = standing?.rank ?? p.finalRank ?? null;

      // Calculate wins/losses
      let wins = 0;
      let losses = 0;
      for (const m of matches) {
        if (m.state !== "complete") continue;
        if (m.winnerId === p.id) wins++;
        else if (m.loserId === p.id) losses++;
      }

      // Check existing participant
      const conditions = [
        eq(schema.tournamentParticipants.challongeParticipantId, String(p.id)),
        eq(schema.tournamentParticipants.playerName, cleanName),
      ];
      if (userId) {
        conditions.push(eq(schema.tournamentParticipants.userId, userId));
      }

      const existingParts = await db
        .select()
        .from(schema.tournamentParticipants)
        .where(
          and(eq(schema.tournamentParticipants.tournamentId, tournamentId), or(...conditions)),
        );
      const existingPart = existingParts[0];

      const partValues = {
        challongeParticipantId: String(p.id),
        playerName: cleanName,
        userId: existingPart?.userId ?? userId,
        finalPlacement,
        wins,
        losses,
        seed: p.seed,
        checkedIn: true,
      };

      if (existingPart) {
        await db
          .update(schema.tournamentParticipants)
          .set(partValues)
          .where(eq(schema.tournamentParticipants.id, existingPart.id));
        pUpdated++;
      } else {
        await db.insert(schema.tournamentParticipants).values({
          tournamentId,
          ...partValues,
        });
        pCreated++;
      }
    }
    console.log(`Participants: ${pCreated} created, ${pUpdated} updated.`);

    // Map matches
    let mCreated = 0;
    let mUpdated = 0;

    for (const m of matches) {
      const player1Name = m.player1Id ? (challongeIdToName.get(m.player1Id) ?? null) : null;
      const player2Name = m.player2Id ? (challongeIdToName.get(m.player2Id) ?? null) : null;
      const winnerName = m.winnerId ? (challongeIdToName.get(m.winnerId) ?? null) : null;
      const player1Uid = m.player1Id ? (challongeIdToUser.get(m.player1Id) ?? null) : null;
      const player2Uid = m.player2Id ? (challongeIdToUser.get(m.player2Id) ?? null) : null;
      const winnerUid = m.winnerId ? (challongeIdToUser.get(m.winnerId) ?? null) : null;

      const existingMatches = await db
        .select()
        .from(schema.tournamentMatches)
        .where(
          and(
            eq(schema.tournamentMatches.tournamentId, tournamentId),
            eq(schema.tournamentMatches.challongeMatchId, String(m.id)),
          ),
        );
      const existingMatch = existingMatches[0];

      const matchValues = {
        round: m.round,
        player1Id: player1Uid,
        player2Id: player2Uid,
        winnerId: winnerUid,
        player1Name,
        player2Name,
        winnerName,
        score: m.scores || "",
        state: m.state || "pending",
      };

      if (existingMatch) {
        await db
          .update(schema.tournamentMatches)
          .set(matchValues)
          .where(eq(schema.tournamentMatches.id, existingMatch.id));
        mUpdated++;
      } else {
        await db.insert(schema.tournamentMatches).values({
          tournamentId,
          challongeMatchId: String(m.id),
          ...matchValues,
        });
        mCreated++;
      }
    }
    console.log(`Matches: ${mCreated} created, ${mUpdated} updated.`);
  }

  console.log("\n=== IMPORT COMPLETED SUCCESSFULLY ===");
}

run().catch(console.error);
