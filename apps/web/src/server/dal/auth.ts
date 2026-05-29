import "server-only";
import { db, schema, and, eq, gt, inArray } from "@/lib/db";

/**
 * Data Access Layer — authentification (callbacks framework legacy).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * INVARIANT TIMESTAMP — les tables `users`/`accounts`/`sessions` sont en
 * `mode:"date"` : leurs colonnes temporelles (`accessTokenExpiresAt`,
 * `expiresAt`, …) attendent et retournent des objets `Date`, JAMAIS des
 * strings ISO. Les fonctions ci-dessous reçoivent donc l'objet `Date` construit
 * par l'appelant et le passent à Drizzle SANS conversion (pas de `.toISOString()`).
 * `profiles` est en `mode:"string"` mais aucune colonne temporelle n'est écrite ici.
 */

/** Upsert du compte Challonge (table auth). `accessTokenExpiresAt` est un objet `Date`. */
export async function upsertChallongeAccount(params: {
  userId: string;
  accountId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
}): Promise<void> {
  await db
    .insert(schema.accounts)
    .values({
      id: crypto.randomUUID(),
      userId: params.userId,
      providerId: "challonge",
      accountId: params.accountId,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      accessTokenExpiresAt: params.accessTokenExpiresAt,
    })
    .onConflictDoUpdate({
      target: [schema.accounts.providerId, schema.accounts.accountId],
      set: {
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
      },
    });
}

/** Upsert du `challongeUsername` vérifié sur le profil de l'utilisateur. */
export async function upsertChallongeProfile(
  userId: string,
  challongeUsername: string,
): Promise<void> {
  await db.insert(schema.profiles).values({ userId, challongeUsername }).onConflictDoUpdate({
    target: schema.profiles.userId,
    set: { challongeUsername },
  });
}

/**
 * Session valide pour un token donné : non expirée à l'instant courant.
 * La comparaison `expiresAt > now` se fait avec un objet `Date` (table auth).
 */
export async function findValidSessionByToken(token: string) {
  return db.query.sessions.findFirst({
    where: and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, new Date())),
  });
}

/** Utilisateur admin/superadmin par `discordId` (table auth). */
export async function findAdminUserByDiscordId(discordId: string) {
  return db.query.users.findFirst({
    where: and(
      eq(schema.users.discordId, discordId),
      inArray(schema.users.role, ["admin", "superadmin"]),
    ),
  });
}

/** Crée une session (table auth). `expiresAt` est un objet `Date`. */
export async function createSession(params: {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}): Promise<void> {
  await db.insert(schema.sessions).values({
    id: params.id,
    token: params.token,
    userId: params.userId,
    expiresAt: params.expiresAt,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/** Utilisateur par `discordId` (table auth). */
export async function findUserByDiscordId(discordId: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.discordId, discordId),
  });
}

/** Crée un utilisateur Discord (table auth) et le renvoie. */
export async function createDiscordUser(params: {
  id: string;
  email: string;
  name: string;
  discordId: string;
  discordTag: string;
  image: string | null;
  globalName: string | null;
  emailVerified: boolean;
}) {
  const [created] = await db
    .insert(schema.users)
    .values({
      id: params.id,
      email: params.email,
      name: params.name,
      discordId: params.discordId,
      discordTag: params.discordTag,
      image: params.image,
      globalName: params.globalName,
      emailVerified: params.emailVerified,
    })
    .returning();
  return created;
}

/** Met à jour les champs Discord d'un utilisateur (table auth) et le renvoie. */
export async function updateDiscordUser(
  id: string,
  params: {
    discordTag: string;
    image: string | null;
    globalName: string | null;
  },
) {
  const [updated] = await db
    .update(schema.users)
    .set({
      discordTag: params.discordTag,
      image: params.image,
      globalName: params.globalName,
    })
    .where(eq(schema.users.id, id))
    .returning();
  return updated;
}

/** Garantit l'existence d'un profil pour l'utilisateur (no-op si déjà présent). */
export async function ensureProfile(userId: string, bladerName: string): Promise<void> {
  await db
    .insert(schema.profiles)
    .values({ userId, bladerName })
    .onConflictDoNothing({ target: schema.profiles.userId });
}
