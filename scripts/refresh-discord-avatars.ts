/**
 * Recharge les avatars Discord COURANTS pour `users` + `staff_members`, puis
 * re-synchronise `global_rankings.avatarUrl` (dénormalisé) depuis `users`.
 *
 * Pourquoi : Discord rote le hash d'avatar quand l'utilisateur le change →
 * les URLs `cdn.discordapp.com/avatars/<id>/<hash>.png` stockées périment (404).
 * On re-résout par `discordId` : avatar SERVEUR > avatar GLOBAL > défaut. Si le
 * membre a quitté le serveur (404 sur /guilds/.../members), on retombe sur
 * /users/<id> pour récupérer quand même l'avatar global courant.
 *
 * Lancer : bun --env-file apps/bot/.env scripts/refresh-discord-avatars.ts
 * Env requis : DISCORD_TOKEN, GUILD_ID (ou DISCORD_GUILD_ID).
 * Idempotent. Sortie : Users updated / Staff updated / Rankings synced.
 */
import { db, schema } from "@rpbey/db";
import { eq, isNotNull, sql } from "drizzle-orm";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
const API = "https://discord.com/api/v10";

if (!TOKEN || !GUILD) {
  console.error("DISCORD_TOKEN et GUILD_ID requis dans l'environnement.");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ResolvedAvatar {
  best: string;
  server: string | null;
  username: string | null;
  globalName: string | null;
  nick: string | null;
}

function defaultAvatar(id: string): string {
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

/** Resolve the current avatar for a discordId. Tries the guild member first
 * (server avatar + nick), falls back to the global user if they left the guild. */
async function resolveAvatar(discordId: string): Promise<ResolvedAvatar | null> {
  // 1. Guild member (server avatar + nick + user)
  const mRes = await fetch(`${API}/guilds/${GUILD}/members/${discordId}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (mRes.status === 429) {
    const retry = Number(mRes.headers.get("retry-after") || "2");
    await sleep((retry + 0.5) * 1000);
    return resolveAvatar(discordId);
  }
  if (mRes.ok) {
    const m = (await mRes.json()) as {
      avatar: string | null;
      nick: string | null;
      user: { id: string; username: string; global_name: string | null; avatar: string | null };
    };
    const server = m.avatar
      ? `https://cdn.discordapp.com/guilds/${GUILD}/users/${discordId}/avatars/${m.avatar}.png?size=256`
      : null;
    const global = m.user.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${m.user.avatar}.png?size=256`
      : null;
    return {
      best: server || global || defaultAvatar(discordId),
      server,
      username: m.user.username,
      globalName: m.user.global_name,
      nick: m.nick,
    };
  }

  // 2. Fallback: global user (works even if they left the guild)
  const uRes = await fetch(`${API}/users/${discordId}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (uRes.status === 429) {
    const retry = Number(uRes.headers.get("retry-after") || "2");
    await sleep((retry + 0.5) * 1000);
    return resolveAvatar(discordId);
  }
  if (!uRes.ok) return null;
  const u = (await uRes.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
  const global = u.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${u.avatar}.png?size=256`
    : null;
  return {
    best: global || defaultAvatar(discordId),
    server: null,
    username: u.username,
    globalName: u.global_name,
    nick: null,
  };
}

async function main() {
  // Collect every distinct discordId from users + staff (one fetch per id).
  const usersWithDiscord = await db
    .select({ id: schema.users.id, discordId: schema.users.discordId })
    .from(schema.users)
    .where(isNotNull(schema.users.discordId));
  const staff = await db
    .select({ id: schema.staffMembers.id, discordId: schema.staffMembers.discordId, name: schema.staffMembers.name })
    .from(schema.staffMembers)
    .where(isNotNull(schema.staffMembers.discordId));

  const ids = new Set<string>();
  for (const u of usersWithDiscord) if (u.discordId) ids.add(u.discordId);
  for (const s of staff) if (s.discordId) ids.add(s.discordId);
  console.log(
    `Refresh Discord avatars: ${ids.size} discordIds uniques (${usersWithDiscord.length} users, ${staff.length} staff)…`,
  );

  const resolved = new Map<string, ResolvedAvatar>();
  let gone = 0;
  for (const id of ids) {
    const a = await resolveAvatar(id);
    if (a) resolved.set(id, a);
    else gone++;
    await sleep(300); // Discord REST politeness
  }
  console.log(`Résolus: ${resolved.size}, introuvables (compte supprimé): ${gone}`);

  // Update users by discordId.
  let usersUpdated = 0;
  for (const u of usersWithDiscord) {
    const a = u.discordId ? resolved.get(u.discordId) : undefined;
    if (!a) continue;
    await db
      .update(schema.users)
      .set({ image: a.best, serverAvatar: a.server, discordTag: a.username ?? undefined })
      .where(eq(schema.users.id, u.id));
    usersUpdated++;
  }

  // Update staff_members by discordId.
  let staffUpdated = 0;
  for (const s of staff) {
    const a = s.discordId ? resolved.get(s.discordId) : undefined;
    if (!a) continue;
    await db
      .update(schema.staffMembers)
      .set({
        imageUrl: a.best,
        serverAvatar: a.server,
        globalName: a.globalName,
        nickname: a.nick,
        name: a.nick || a.globalName || a.username || s.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.staffMembers.id, s.id));
    staffUpdated++;
  }

  // Re-sync the denormalised ranking avatar from the freshly-updated users.
  const synced = await db.execute(sql`
    UPDATE global_rankings g SET "avatarUrl" = u.image
    FROM users u
    WHERE g."userId" = u.id AND u.image IS NOT NULL AND u.image IS DISTINCT FROM g."avatarUrl"
  `);

  console.log(`Users updated: ${usersUpdated}`);
  console.log(`Staff updated: ${staffUpdated}`);
  console.log(`Rankings synced (via userId): ${(synced as { count?: number }).count ?? "ok"}`);

  // ── Pass B: URL-driven recovery ──────────────────────────────────────────
  // Rows whose avatar is a discordapp /avatars/<id>/<hash> URL but whose
  // discordId column is NULL (legacy imports) keep a STALE hash → 404. The id
  // is embedded in the URL path, so extract it and re-resolve. Covers
  // users.image, staff_members.imageUrl, global_rankings.avatarUrl (incl. the
  // name-only ranking rows with no userId) and the `null.png` (null-hash) bug.
  const AVATAR_RE = /discordapp\.com\/avatars\/(\d+)\//;
  async function freshFor(id: string): Promise<string | null> {
    if (resolved.has(id)) return resolved.get(id)!.best;
    const a = await resolveAvatar(id);
    await sleep(300);
    if (a) {
      resolved.set(id, a);
      return a.best;
    }
    return null;
  }

  let recovered = 0;
  const targets: Array<{ table: "users" | "staff_members" | "global_rankings"; col: string; idCol: string }> = [
    { table: "users", col: "image", idCol: "id" },
    { table: "staff_members", col: "imageUrl", idCol: "id" },
    { table: "global_rankings", col: "avatarUrl", idCol: "id" },
  ];
  for (const t of targets) {
    const rows = (await db.execute(
      sql`SELECT ${sql.identifier(t.idCol)} AS pk, ${sql.identifier(t.col)} AS url
          FROM ${sql.identifier(t.table)}
          WHERE ${sql.identifier(t.col)} ~ 'discordapp\\.com/avatars/[0-9]+/'`,
    )) as unknown as Array<{ pk: string; url: string }>;
    for (const r of rows) {
      const m = r.url.match(AVATAR_RE);
      if (!m) continue;
      const fresh = await freshFor(m[1]);
      if (fresh && fresh !== r.url) {
        await db.execute(
          sql`UPDATE ${sql.identifier(t.table)} SET ${sql.identifier(t.col)} = ${fresh}
              WHERE ${sql.identifier(t.idCol)} = ${r.pk}`,
        );
        recovered++;
      }
    }
  }
  console.log(`Pass B recovered (stale/no-discordId/null-hash avatars): ${recovered}`);
}

main()
  .then(() => db.$client.end())
  .catch(async (e) => {
    console.error("REFRESH AVATARS FAILED:", e);
    await db.$client.end().catch(() => {});
    process.exit(1);
  });
