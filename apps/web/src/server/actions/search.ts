"use server";

import { findBladerProfiles, findSatrBladers } from "@/server/dal/search";

export async function searchBladers(query: string) {
  if (!query || query.length < 2) return [];

  const pattern = `%${query}%`;

  // Search in primary profiles (joined to user), only profiles whose user has
  // at least one tournament participation (real Challonge profiles).
  const profiles = await findBladerProfiles(pattern);

  // Search in SATR profiles
  const satrBladers = await findSatrBladers(pattern);

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
