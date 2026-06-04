#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, schema, eq, asc } from "../apps/web/src/lib/db";

const SLUG_MAP: Record<string, string> = {
  bts1: "B_TS1.json",
  bts2: "B_TS2.json",
  bts3: "B_TS3.json",
  bts4: "B_TS4.json",
  bts5: "B_TS5.json",
};

async function run() {
  console.log("=== POPULATING NEON DB STANDINGS ===");

  const tournaments = await db.query.tournaments.findMany();

  for (const t of tournaments) {
    const jsonFile = SLUG_MAP[t.id];
    if (!jsonFile) {
      console.log(`No local JSON mapping for tournament ${t.id} (${t.name}), skipping.`);
      continue;
    }

    const filePath = join(process.cwd(), "apps/web/data/exports", jsonFile);
    if (!existsSync(filePath)) {
      console.log(`JSON file not found at ${filePath}, skipping.`);
      continue;
    }

    console.log(`Processing ${t.id} (${t.name}) using ${jsonFile}...`);

    // 1. Load JSON file for profile enrichment
    const jsonData = JSON.parse(readFileSync(filePath, "utf-8"));
    const jsonParticipants = jsonData.participants || [];
    const jsonMap = new Map<string, any>();
    for (const jp of jsonParticipants) {
      if (jp.name) jsonMap.set(jp.name.toLowerCase(), jp);
      if (jp.id) jsonMap.set(String(jp.id), jp);
    }

    // 2. Fetch participants from DB
    const dbParticipants = await db.query.tournamentParticipants.findMany({
      where: eq(schema.tournamentParticipants.tournamentId, t.id),
      orderBy: [asc(schema.tournamentParticipants.finalPlacement)],
    });

    if (dbParticipants.length === 0) {
      console.log(`⚠️ No participants found in DB for ${t.id}, skipping.`);
      continue;
    }

    // 3. Construct standings array
    const standings = dbParticipants
      .filter((p) => p.finalPlacement && p.finalPlacement > 0)
      .map((p) => {
        const jsonPlayer = 
          jsonMap.get((p.playerName || "").toLowerCase()) || 
          jsonMap.get(String(p.challongeParticipantId));
        
        return {
          rank: p.finalPlacement,
          name: p.playerName,
          wins: p.wins || 0,
          losses: p.losses || 0,
          challongeUsername: jsonPlayer?.challongeUsername || null,
          challongeProfileUrl: jsonPlayer?.challongeProfileUrl || null,
          stats: {
            wins: p.wins || 0,
            losses: p.losses || 0,
          },
        };
      });

    console.log(`Generated ${standings.length} standings entries for ${t.id}.`);

    // 4. Update the DB
    await db
      .update(schema.tournaments)
      .set({
        standings: standings as any,
      })
      .where(eq(schema.tournaments.id, t.id));

    console.log(`Successfully updated DB standings for ${t.id}.`);
  }

  console.log("=== DONE ===");
}

run().catch(console.error);
