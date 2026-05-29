import "server-only";
import { db, schema } from "@/lib/db";

/**
 * Data Access Layer — recherche globale.
 * Lectures DB brutes (parts / tournaments / rankings). Aucune dépendance UI.
 */

export async function listParts() {
  return db.select().from(schema.parts);
}

export async function listTournaments() {
  return db.select().from(schema.tournaments);
}

export async function listRankings() {
  const [satr, stardust, wb] = await Promise.all([
    db.select().from(schema.satrRankings),
    db.select().from(schema.stardustRankings),
    db.select().from(schema.wbRankings),
  ]);
  return { satr, stardust, wb };
}
