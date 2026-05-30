#!/usr/bin/env bun
/**
 * sync-discord-members.ts — enrichit la table `users` avec le MAXIMUM de données
 * Discord disponibles par l'API REST, pour chaque utilisateur déjà lié à un compte
 * Discord (`users.discordId`). Pendant social du sync bot `/synchroniser`, mais
 * pilotable côté web (REST pur, sans gateway ni intent présence) — idempotent.
 *
 * Données récupérées par membre (REST `/guilds/{id}/members`) :
 *   globalName, nickname (nick de serveur), serverAvatar (avatar de guilde),
 *   image (avatar global), discordTag, roles ([{id,name,color}] via /guilds/{id}/roles),
 *   joinedAt, premiumSince (boost). `status`/`activities` sont GATEWAY-only → non
 *   couverts ici (le bot les met à jour en live via ses events présence).
 *
 * Sécurité : le token n'est JAMAIS lu/loggé — il transite uniquement dans l'en-tête
 * `Authorization` de fetch. Lancer avec l'env du bot :
 *   bun --env-file=apps/bot/.env apps/web/scripts/sync-discord-members.ts
 *
 * Invariant timestamp : `joinedAt`/`premiumSince` sont `mode:"string"` → string ISO ;
 * `updatedAt` (mode:"date") est géré par `$onUpdate` de Drizzle (ne pas y toucher).
 */
import { db, schema } from "@rpbey/db";
import { eq } from "drizzle-orm";

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const PAGE = 1000; // max membres/req

if (!TOKEN) {
  console.error("[discord-members] DISCORD_TOKEN absent (lancer avec --env-file=apps/bot/.env).");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("[discord-members] DISCORD_GUILD_ID / GUILD_ID absent de l'environnement.");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let invalid = 0;

/** GET REST Discord, rate-limit aware (honore retry_after / reset-after), retry 5xx. */
async function discordGet<T>(path: string, attempt = 0): Promise<T | null> {
  if (invalid > 1000) throw new Error("[discord-members] trop de requêtes invalides — arrêt.");
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "User-Agent": "DiscordBot (https://rpbey.fr, 1.0.0)",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      invalid++;
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      const retry = Math.max(body.retry_after ?? 1, Number(res.headers.get("retry-after") ?? 0));
      console.warn(`[discord-members] 429 — pause ${retry.toFixed(2)}s`);
      await sleep(retry * 1000 + 250);
      return discordGet<T>(path, attempt);
    }
    if (res.status === 401) throw new Error("[discord-members] 401 — DISCORD_TOKEN invalide.");
    if (res.status === 403) {
      // 403 sur /members = intent GUILD_MEMBERS non activé pour le bot.
      throw new Error(
        "[discord-members] 403 — l'intent privilégié GUILD_MEMBERS doit être activé pour le bot.",
      );
    }
    if (res.status === 404) {
      invalid++;
      return null;
    }
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1");
    const resetAfter = Number(res.headers.get("x-ratelimit-reset-after") ?? "0");
    if (remaining <= 0 && resetAfter > 0) await sleep(resetAfter * 1000 + 100);
    return (await res.json()) as T;
  } catch (e) {
    if (attempt >= 5) throw e;
    await sleep(Math.min(15_000, 600 * 2 ** attempt));
    return discordGet<T>(path, attempt + 1);
  }
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}
interface GuildMember {
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    discriminator?: string;
  };
  nick?: string | null;
  avatar?: string | null;
  roles: string[];
  joined_at?: string | null;
  premium_since?: string | null;
}

/** #rrggbb depuis l'entier couleur Discord (0 = pas de couleur). */
function hexColor(c: number): string | null {
  if (!c) return null;
  return `#${c.toString(16).padStart(6, "0")}`;
}

function tagOf(u: NonNullable<GuildMember["user"]>): string {
  return !u.discriminator || u.discriminator === "0"
    ? u.username
    : `${u.username}#${u.discriminator}`;
}

function globalAvatarUrl(u: NonNullable<GuildMember["user"]>): string {
  if (u.avatar) {
    const ext = u.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=256`;
  }
  // Avatar par défaut (index basé sur l'id pour les comptes migrés pseudo#0).
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function serverAvatarUrl(member: GuildMember): string | null {
  if (!member.avatar || !member.user) return null;
  const ext = member.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${member.user.id}/avatars/${member.avatar}.${ext}?size=256`;
}

async function main() {
  const t0 = Date.now();

  // 1. Carte des rôles (id → {name,color}) pour enrichir les rôles des membres.
  const guildRoles = (await discordGet<DiscordRole[]>(`/guilds/${GUILD_ID}/roles`)) ?? [];
  const roleMap = new Map(
    guildRoles.map((r) => [r.id, { name: r.name, color: hexColor(r.color) }]),
  );
  console.log(`[discord-members] ${roleMap.size} rôles de guilde chargés.`);

  // 2. Users existants liés à Discord (on n'enrichit QUE des comptes déjà présents).
  const known = await db.query.users.findMany({ columns: { id: true, discordId: true } });
  const discordIdToUser = new Map<string, string>();
  for (const u of known) if (u.discordId) discordIdToUser.set(u.discordId, u.id);
  console.log(`[discord-members] ${discordIdToUser.size} users liés à un discordId (cibles).`);

  // 3. Pagination de TOUS les membres de la guilde (cursor `after` par snowflake).
  let after = "0";
  let scanned = 0;
  let updated = 0;
  let unmatched = 0;
  for (;;) {
    const page = await discordGet<GuildMember[]>(
      `/guilds/${GUILD_ID}/members?limit=${PAGE}&after=${after}`,
    );
    if (!page || page.length === 0) break;
    scanned += page.length;

    for (const m of page) {
      const u = m.user;
      if (!u) continue;
      const userId = discordIdToUser.get(u.id);
      if (!userId) {
        unmatched++;
        continue;
      }
      const roles = m.roles
        .map((rid) => {
          const r = roleMap.get(rid);
          return r ? { id: rid, name: r.name, color: r.color } : null;
        })
        .filter((r): r is { id: string; name: string; color: string | null } => r !== null);

      await db
        .update(schema.users)
        .set({
          globalName: u.global_name ?? null,
          nickname: m.nick ?? null,
          discordTag: tagOf(u),
          serverAvatar: serverAvatarUrl(m),
          image: globalAvatarUrl(u),
          roles,
          joinedAt: m.joined_at ?? null,
          premiumSince: m.premium_since ?? null,
        })
        .where(eq(schema.users.id, userId))
        .catch((e) =>
          console.error(`[discord-members] échec MAJ ${userId}:`, (e as Error).message),
        );
      updated++;
    }

    // Curseur = plus grand snowflake de la page (les membres sont triés par id).
    const maxId = page.reduce((mx, m) => {
      const id = m.user?.id;
      return id && BigInt(id) > BigInt(mx) ? id : mx;
    }, after);
    if (maxId === after) break;
    after = maxId;
    if (page.length < PAGE) break;
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n[discord-members] OK en ${secs}s — ${scanned} membres scannés, ` +
      `${updated} users enrichis, ${unmatched} membres sans compte site (ignorés).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[discord-members] échec:", err);
  process.exit(1);
});
