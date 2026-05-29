import "server-only";
import { db, schema, and, eq, ilike, or, sql } from "@/lib/db";

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

export async function listAnimeSeries() {
  return db.select().from(schema.animeSeries);
}

export async function listContentBlocks() {
  return db.select().from(schema.contentBlocks);
}

/**
 * Profils principaux (joints à l'utilisateur) dont le user a au moins une
 * participation à un tournoi (vrais profils Challonge). Match sur username
 * Challonge / nom blader / nom & username user.
 */
export async function findBladerProfiles(pattern: string) {
  return db
    .select({
      bladerName: schema.profiles.bladerName,
      challongeUsername: schema.profiles.challongeUsername,
      userName: schema.users.name,
      userUsername: schema.users.username,
      userImage: schema.users.image,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.profiles.userId, schema.users.id))
    .where(
      and(
        or(
          ilike(schema.profiles.challongeUsername, pattern),
          ilike(schema.profiles.bladerName, pattern),
          ilike(schema.users.name, pattern),
          ilike(schema.users.username, pattern),
        ),
        sql`EXISTS (SELECT 1 FROM ${schema.tournamentParticipants} WHERE ${schema.tournamentParticipants.userId} = ${schema.users.id})`,
      ),
    )
    .limit(5);
}

/** Bladers SATR par nom. */
export async function findSatrBladers(pattern: string) {
  return db
    .select({ name: schema.satrBladers.name })
    .from(schema.satrBladers)
    .where(ilike(schema.satrBladers.name, pattern))
    .limit(3);
}
