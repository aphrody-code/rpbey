/**
 * Test round-trip de CHAQUE champ éditable du profil — preuve que chaque "edit"
 * persiste réellement (contrat Zod accepté → écriture colonne → relecture).
 *
 * Pipeline réel reproduit :
 *   1. `ProfileUpdateInputSchema.parse(payload)`  (validation identique à PATCH /api/profile)
 *   2. écriture des EDITABLE_PROFILE_KEYS + `users.image`  (identique à upsertOwnProfile)
 *   3. relecture et assertion champ par champ.
 *
 * Tout s'exécute dans une transaction qui ROLLBACK en fin de course : aucune
 * donnée réelle n'est modifiée. Lancer : cd apps/web && bun scripts/test-profile-roundtrip.ts
 */
import { ProfileUpdateInputSchema } from "@rpbey/api-contract";
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const ROLLBACK = Symbol("rollback");

// Mêmes clés que `EDITABLE_PROFILE_KEYS` dans server/dal/users.ts (avatar `image` exclu → users).
const EDITABLE_PROFILE_KEYS = [
  "bladerName",
  "displayName",
  "pronouns",
  "favoriteType",
  "favoriteSeason",
  "experience",
  "bio",
  "bannerImage",
  "deckBoxImage",
  "accentColor",
  "profileVisibility",
  "showLocation",
  "showSocials",
  "country",
  "region",
  "city",
  "postalCode",
  "addressLine",
  "favoriteBeybladeId",
  "favoriteDeckId",
  "challongeUsername",
  "twitterHandle",
  "tiktokHandle",
  "instagramHandle",
  "youtubeHandle",
  "twitchHandle",
  "discordHandle",
  "websiteUrl",
] as const;

async function main() {
  const target = await db.query.profiles.findFirst({ columns: { id: true, userId: true } });
  if (!target) {
    console.error("Aucun profil en base — lance d'abord scripts/backfill-profiles.ts");
    process.exit(1);
  }

  // FKs valides (ou null) pour favoriteBeybladeId / favoriteDeckId.
  const bey = await db.query.beyblades.findFirst({ columns: { id: true } });
  const deck = await db.query.decks.findFirst({
    columns: { id: true },
    where: eq(schema.decks.userId, target.userId),
  });

  const payload = {
    bladerName: "RoundTrip Tester",
    displayName: "RT Display",
    pronouns: "iel/iel",
    favoriteType: "ATTACK",
    favoriteSeason: "X",
    experience: "EXPERT",
    bio: "<p>Bio de test round-trip</p>",
    image: "https://cdn.rpbey.fr/avatars/rt-test.webp",
    bannerImage: "https://cdn.rpbey.fr/banners/rt-test.webp",
    deckBoxImage: "https://cdn.rpbey.fr/deckbox/rt-test.webp",
    accentColor: "#FF3366",
    profileVisibility: "MEMBERS",
    showLocation: true,
    showSocials: false,
    country: "France",
    region: "Bretagne",
    city: "Rennes",
    postalCode: "35000",
    addressLine: "1 rue du Test",
    favoriteBeybladeId: bey?.id ?? null,
    favoriteDeckId: deck?.id ?? null,
    challongeUsername: "rt_tester",
    twitterHandle: "rt_twitter",
    tiktokHandle: "rt_tiktok",
    instagramHandle: "rt_insta",
    youtubeHandle: "@rt_youtube",
    twitchHandle: "rt_twitch",
    discordHandle: "rt_discord",
    websiteUrl: "https://rt-tester.example",
  } as const;

  // 1. Validation contrat (identique au PATCH).
  const parsed = ProfileUpdateInputSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("ÉCHEC validation contrat:", parsed.error.issues);
    process.exit(1);
  }

  const failures: string[] = [];

  try {
    await db.transaction(async (tx) => {
      const { image, ...rest } = parsed.data;

      // 2a. avatar → users.image
      if (image !== undefined) {
        await tx.update(schema.users).set({ image }).where(eq(schema.users.id, target.userId));
      }
      // 2b. colonnes profiles
      const patch: Record<string, unknown> = {};
      for (const key of EDITABLE_PROFILE_KEYS) {
        const v = (rest as Record<string, unknown>)[key];
        if (v !== undefined) patch[key] = v;
      }
      await tx
        .update(schema.profiles)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(schema.profiles.id, target.id));

      // 3. relecture + assertions
      const row = await tx.query.profiles.findFirst({ where: eq(schema.profiles.id, target.id) });
      const userRow = await tx.query.users.findFirst({
        where: eq(schema.users.id, target.userId),
        columns: { image: true },
      });

      for (const key of EDITABLE_PROFILE_KEYS) {
        const expected = (payload as Record<string, unknown>)[key];
        const got = (row as Record<string, unknown> | undefined)?.[key];
        if (got !== expected)
          failures.push(`${key}: attendu ${JSON.stringify(expected)}, lu ${JSON.stringify(got)}`);
      }
      if (userRow?.image !== payload.image) {
        failures.push(`image: attendu ${payload.image}, lu ${userRow?.image}`);
      }

      throw ROLLBACK; // annule toute mutation
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }

  const tested = EDITABLE_PROFILE_KEYS.length + 1; // + image
  if (failures.length > 0) {
    console.error(`ÉCHEC round-trip (${failures.length}/${tested}):`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }

  console.log(
    `OK — ${tested}/${tested} champs round-trip (validation contrat + écriture + relecture, rollback).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur test:", err);
  process.exit(1);
});
