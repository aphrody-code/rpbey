#!/usr/bin/env bun
/**
 * Efface les messages d'un user (par défaut le compte owner) sur tous les
 * salons texte/thread accessibles d'une ou plusieurs guilds.
 *
 *   - Pas d'output Discord (pas de DM, pas de message public, pas de mod-log).
 *   - Logs uniquement sur stderr (silencieusable via 2>/dev/null).
 *   - Audit log Discord existera quand même : impossible à contourner côté API.
 *
 * Usage :
 *   bun scripts/wipe-my-messages.ts --confirm              # toutes guilds
 *   bun scripts/wipe-my-messages.ts --guild=<id> --confirm
 *   bun scripts/wipe-my-messages.ts --user=<id> --confirm
 *   bun scripts/wipe-my-messages.ts                         # dry-run par défaut
 *
 * Token : DISCORD_TOKEN (lu depuis .env via Bun).
 */
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type Guild,
  type GuildBasedChannel,
  type Message,
  PermissionFlagsBits,
  type TextBasedChannel,
} from "discord.js";

const DEFAULT_USER_ID = "281114294152724491";

const args = new Map<string, string>();
const flags = new Set<string>();
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--") && a.includes("=")) {
    const [k, v] = a.slice(2).split("=", 2);
    args.set(k, v);
  } else if (a.startsWith("--")) {
    flags.add(a.slice(2));
  }
}

const USER_ID = args.get("user") ?? DEFAULT_USER_ID;
const GUILD_FILTER = args.get("guild");
const CONFIRM = flags.has("confirm");
const DRY = !CONFIRM;
const FETCH_LIMIT = 100;
const MAX_AGE_BULK_MS = 14 * 24 * 60 * 60 * 1000 - 60_000; // marge 1min
const CHANNEL_CONCURRENCY = Number(args.get("concurrency") ?? "12");

const log = (msg: string) => process.stderr.write(`${msg}\n`);

if (!process.env.DISCORD_TOKEN) {
  log("DISCORD_TOKEN manquant.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

await client.login(process.env.DISCORD_TOKEN);
await new Promise<void>((r) => client.once("clientReady", () => r()));

const me = client.user;
if (!me) {
  log("Bot non ready.");
  process.exit(1);
}
log(
  `[wipe] connecté en tant que ${me.tag} — cible ${USER_ID} — mode ${DRY ? "DRY-RUN" : "DELETE"}`,
);

const guilds = GUILD_FILTER
  ? [client.guilds.cache.get(GUILD_FILTER)].filter((g): g is Guild => !!g)
  : [...client.guilds.cache.values()];

if (guilds.length === 0) {
  log("Aucune guild ciblée.");
  await client.destroy();
  process.exit(0);
}

const stats = { scanned: 0, found: 0, deleted: 0, failed: 0, skipped: 0 };

function canDelete(channel: GuildBasedChannel): channel is GuildBasedChannel & TextBasedChannel {
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.AnnouncementThread &&
    channel.type !== ChannelType.GuildVoice
  ) {
    return false;
  }
  const perms = channel.permissionsFor(me!);
  if (!perms) return false;
  return (
    perms.has(PermissionFlagsBits.ViewChannel) &&
    perms.has(PermissionFlagsBits.ReadMessageHistory) &&
    perms.has(PermissionFlagsBits.ManageMessages)
  );
}

async function collectMatchingMessages(channel: TextBasedChannel): Promise<Message[]> {
  const out: Message[] = [];
  let before: string | undefined;
  while (true) {
    const batch = await channel.messages.fetch({ limit: FETCH_LIMIT, before });
    stats.scanned += batch.size;
    if (batch.size === 0) break;
    for (const m of batch.values()) {
      if (m.author.id === USER_ID) out.push(m);
    }
    before = batch.last()?.id;
    if (batch.size < FETCH_LIMIT) break;
  }
  return out;
}

async function deleteOne(msg: Message) {
  if (DRY) {
    stats.deleted++;
    return;
  }
  try {
    await msg.delete();
    stats.deleted++;
  } catch (e) {
    stats.failed++;
    log(`  ✗ ${msg.id} ${(e as Error).message}`);
  }
}

async function processChannel(channel: GuildBasedChannel) {
  if (!canDelete(channel)) {
    stats.skipped++;
    return;
  }
  let matches: Message[];
  try {
    matches = await collectMatchingMessages(channel);
  } catch (e) {
    log(`  ✗ fetch ${channel.name}: ${(e as Error).message}`);
    stats.failed++;
    return;
  }
  if (matches.length === 0) return;
  stats.found += matches.length;
  log(`  #${channel.name} → ${matches.length} match(es)`);

  const now = Date.now();
  const bulkable = matches.filter((m) => now - m.createdTimestamp < MAX_AGE_BULK_MS);
  const old = matches.filter((m) => now - m.createdTimestamp >= MAX_AGE_BULK_MS);

  for (let i = 0; i < bulkable.length; i += 100) {
    const slice = bulkable.slice(i, i + 100);
    if (DRY) {
      stats.deleted += slice.length;
      continue;
    }
    // Discord exige 2-100 messages pour bulk-delete — sous le seuil = unitaire.
    if (
      slice.length < 2 ||
      !("bulkDelete" in channel) ||
      typeof channel.bulkDelete !== "function"
    ) {
      for (const m of slice) await deleteOne(m);
      continue;
    }
    try {
      await channel.bulkDelete(slice, true);
      stats.deleted += slice.length;
    } catch (e) {
      log(`  ✗ bulk: ${(e as Error).message} — fallback unitaire`);
      for (const m of slice) await deleteOne(m);
    }
  }

  for (const m of old) await deleteOne(m);
}

async function pMap<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      try {
        await fn(items[idx]!);
      } catch (e) {
        log(`  ✗ worker: ${(e as Error).message}`);
      }
    }
  });
  await Promise.all(workers);
}

async function processGuild(guild: Guild) {
  log(`[guild] ${guild.name} (${guild.id})`);
  await guild.channels.fetch();
  const targets: GuildBasedChannel[] = [];
  for (const ch of guild.channels.cache.values()) {
    if (ch && "messages" in ch) targets.push(ch as GuildBasedChannel);
  }
  const threads = await guild.channels.fetchActiveThreads().catch(() => null);
  if (threads) {
    for (const t of threads.threads.values()) targets.push(t as GuildBasedChannel);
  }
  log(
    `[guild] ${guild.name} — scan ${targets.length} channels (concurrency=${CHANNEL_CONCURRENCY})`,
  );
  await pMap(targets, processChannel, CHANNEL_CONCURRENCY);
}

for (const g of guilds) {
  try {
    await processGuild(g);
  } catch (e) {
    log(`[guild ${g.id}] erreur ${(e as Error).message}`);
  }
}

log(
  `[wipe] terminé — scanned=${stats.scanned} found=${stats.found} ${DRY ? "would-delete" : "deleted"}=${stats.deleted} failed=${stats.failed} skipped-channels=${stats.skipped}`,
);
if (DRY) log("[wipe] dry-run. Relance avec --confirm pour effacer réellement.");

await client.destroy();
process.exit(0);
