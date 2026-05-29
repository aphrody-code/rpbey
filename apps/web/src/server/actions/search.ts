"use server";

import { db, schema, and, or, ilike, sql, eq } from "@/lib/db";

export async function searchBladers(query: string) {
  if (!query || query.length < 2) return [];

  const pattern = `%${query}%`;

  // Search in primary profiles (joined to user), only profiles whose user has
  // at least one tournament participation (real Challonge profiles).
  const profiles = await db
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

  // Search in SATR profiles
  const satrBladers = await db
    .select({ name: schema.satrBladers.name })
    .from(schema.satrBladers)
    .where(ilike(schema.satrBladers.name, pattern))
    .limit(3);

  const results = profiles.map((p) => ({
    name: p.challongeUsername
      ? `@${p.challongeUsername}`
      : `@${p.userUsername?.replace(/^bts[1-3]_/, "") || p.bladerName || "blader"}`,
    image: p.userImage,
  }));

  // Add SATR results if they don't duplicate names
  for (const sb of satrBladers) {
    if (!results.some((r) => r.name.toLowerCase() === sb.name.toLowerCase())) {
      results.push({
        name: sb.name,
        image: null,
      });
    }
  }

  return results.slice(0, 8);
}
