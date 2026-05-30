/**
 * Synchronise les vrais staff/admin depuis Discord vers `staff_members` :
 * re-fetch l'avatar COURANT (les hash stockés périment → 404), le pseudo serveur,
 * le globalName et le nom, par `discordId`. Idempotent ; sortie `Added: N / Updated: M`
 * (parsée par l'action admin `syncStaffFromDiscord`).
 *
 * Lancer : bun --env-file apps/web/.env scripts/sync-staff-db.ts
 * Env requis : DISCORD_TOKEN, GUILD_ID (ou DISCORD_GUILD_ID).
 */
import { db, schema } from "@rpbey/db";
import { eq, isNotNull } from "drizzle-orm";

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
const API = "https://discord.com/api/v10";

if (!TOKEN || !GUILD) {
  console.error("DISCORD_TOKEN et GUILD_ID requis dans l'environnement.");
  process.exit(1);
}

interface DiscordMember {
  avatar: string | null; // avatar serveur
  nick: string | null;
  user: { id: string; username: string; global_name: string | null; avatar: string | null };
}

/** Meilleure URL d'avatar : serveur > global > défaut. */
function avatarUrl(m: DiscordMember): { server: string | null; best: string } {
  const id = m.user.id;
  let server: string | null = null;
  if (m.avatar) {
    server = `https://cdn.discordapp.com/guilds/${GUILD}/users/${id}/avatars/${m.avatar}.png?size=256`;
  }
  let global: string | null = null;
  if (m.user.avatar) {
    global = `https://cdn.discordapp.com/avatars/${id}/${m.user.avatar}.png?size=256`;
  }
  const def = `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
  return { server, best: server || global || def };
}

async function fetchMember(discordId: string): Promise<DiscordMember | null> {
  const res = await fetch(`${API}/guilds/${GUILD}/members/${discordId}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") || "2");
    await new Promise((r) => setTimeout(r, (retry + 0.5) * 1000));
    return fetchMember(discordId);
  }
  if (!res.ok) return null;
  return (await res.json()) as DiscordMember;
}

async function main() {
  const staff = await db.query.staffMembers.findMany({
    where: isNotNull(schema.staffMembers.discordId),
    columns: { id: true, discordId: true, name: true },
  });
  console.log(`Sync de ${staff.length} membres staff depuis Discord (guild ${GUILD})…`);

  let updated = 0;
  let missing = 0;
  for (const s of staff) {
    const m = await fetchMember(s.discordId!);
    if (!m) {
      missing++;
      console.warn(`  ! ${s.name} (${s.discordId}) introuvable sur le serveur`);
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    const { server, best } = avatarUrl(m);
    const displayName = m.nick || m.user.global_name || m.user.username || s.name;
    await db
      .update(schema.staffMembers)
      .set({
        imageUrl: best,
        serverAvatar: server,
        globalName: m.user.global_name,
        nickname: m.nick,
        name: displayName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.staffMembers.id, s.id));
    updated++;
    await new Promise((r) => setTimeout(r, 300)); // politeness Discord REST
  }

  console.log(`Added: 0`);
  console.log(`Updated: ${updated}`);
  if (missing) console.log(`Introuvables: ${missing}`);
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error("SYNC STAFF FAILED:", e);
    process.exit(1);
  });
