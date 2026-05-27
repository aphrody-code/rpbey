#!/usr/bin/env bun
/**
 * Efface dans un seul channel les messages qui *parlent* d'un user (logs, etc.) :
 * mentions explicites, ID dans le contenu, embeds qui le référencent (author,
 * description, fields, footer). Le message peut être posté par n'importe qui
 * (typiquement un bot de logs).
 *
 * Usage :
 *   bun scripts/wipe-mentions-in-channel.ts --channel=<id>              # dry-run
 *   bun scripts/wipe-mentions-in-channel.ts --channel=<id> --confirm
 *   bun scripts/wipe-mentions-in-channel.ts --channel=<id> --user=<id> --confirm
 */
import {
	Client,
	GatewayIntentBits,
	type Embed,
	type Message,
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
const CHANNEL_ID = args.get("channel");
const CONFIRM = flags.has("confirm");
const DRY = !CONFIRM;
const FETCH_LIMIT = 100;
const MAX_AGE_BULK_MS = 14 * 24 * 60 * 60 * 1000 - 60_000;

// Cutoff temporel : on stoppe le scan dès qu'on tombe sur un message plus vieux.
// --since=today / --days=N / --hours=N
function resolveCutoff(): number {
	const since = args.get("since");
	if (since === "today") {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}
	const days = args.get("days");
	if (days) return Date.now() - Number(days) * 24 * 60 * 60 * 1000;
	const hours = args.get("hours");
	if (hours) return Date.now() - Number(hours) * 60 * 60 * 1000;
	return 0; // pas de cutoff = scan complet
}
const CUTOFF_MS = resolveCutoff();

const log = (msg: string) => process.stderr.write(`${msg}\n`);

if (!CHANNEL_ID) {
	log("--channel=<id> requis");
	process.exit(1);
}
if (!process.env.DISCORD_TOKEN) {
	log("DISCORD_TOKEN manquant.");
	process.exit(1);
}

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

await client.login(process.env.DISCORD_TOKEN);
await new Promise<void>((r) => client.once("clientReady", () => r()));

const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
if (!channel || !channel.isTextBased() || !("messages" in channel)) {
	log(`Channel ${CHANNEL_ID} introuvable ou non-texte.`);
	await client.destroy();
	process.exit(1);
}

const channelName =
	"name" in channel && channel.name ? channel.name : CHANNEL_ID;
const cutoffLabel = CUTOFF_MS
	? `since ${new Date(CUTOFF_MS).toISOString()}`
	: "no cutoff";
log(
	`[wipe-mentions] #${channelName} — cible ${USER_ID} — ${cutoffLabel} — mode ${DRY ? "DRY-RUN" : "DELETE"}`,
);

function embedMentions(embed: Embed, needle: string): boolean {
	const haystack: (string | null | undefined)[] = [
		embed.title,
		embed.description,
		embed.url,
		embed.author?.name,
		embed.author?.url,
		embed.footer?.text,
	];
	for (const f of embed.fields ?? []) {
		haystack.push(f.name, f.value);
	}
	return haystack.some((s) => typeof s === "string" && s.includes(needle));
}

function mentionsUser(m: Message, userId: string): boolean {
	if (m.mentions.users.has(userId)) return true;
	if (m.content.includes(userId)) return true;
	for (const e of m.embeds) {
		if (embedMentions(e, userId)) return true;
	}
	return false;
}

const stats = { scanned: 0, found: 0, deleted: 0, failed: 0 };
const matches: Message[] = [];

let before: string | undefined;
let reachedCutoff = false;
outer: while (true) {
	const batch = await (channel as TextBasedChannel).messages.fetch({
		limit: FETCH_LIMIT,
		before,
	});
	stats.scanned += batch.size;
	if (batch.size === 0) break;
	for (const m of batch.values()) {
		if (CUTOFF_MS && m.createdTimestamp < CUTOFF_MS) {
			reachedCutoff = true;
			break outer;
		}
		if (mentionsUser(m, USER_ID)) matches.push(m);
	}
	before = batch.last()?.id;
	if (batch.size < FETCH_LIMIT) break;
}
if (reachedCutoff) log("[wipe-mentions] cutoff atteint, scan stoppé.");

stats.found = matches.length;
log(`[wipe-mentions] scanned=${stats.scanned} found=${stats.found}`);

if (DRY) {
	log("[wipe-mentions] dry-run. Relance avec --confirm pour effacer.");
	if (matches.length > 0) {
		log("\nÉchantillon (max 5) :");
		for (const m of matches.slice(0, 5)) {
			const snippet = (
				m.content ||
				m.embeds[0]?.description ||
				m.embeds[0]?.title ||
				"[no text]"
			)
				.replace(/\s+/g, " ")
				.slice(0, 120);
			log(`  ${m.id} [${m.author.tag}] ${snippet}`);
		}
	}
	await client.destroy();
	process.exit(0);
}

const now = Date.now();
const bulkable = matches.filter(
	(m) => now - m.createdTimestamp < MAX_AGE_BULK_MS,
);
const old = matches.filter((m) => now - m.createdTimestamp >= MAX_AGE_BULK_MS);

for (let i = 0; i < bulkable.length; i += 100) {
	const slice = bulkable.slice(i, i + 100);
	if (
		slice.length < 2 ||
		!("bulkDelete" in channel) ||
		typeof channel.bulkDelete !== "function"
	) {
		for (const m of slice) {
			try {
				await m.delete();
				stats.deleted++;
			} catch (e) {
				stats.failed++;
				log(`  ✗ ${m.id} ${(e as Error).message}`);
			}
		}
		continue;
	}
	try {
		await channel.bulkDelete(slice, true);
		stats.deleted += slice.length;
	} catch (e) {
		log(`  ✗ bulk: ${(e as Error).message} — fallback unitaire`);
		for (const m of slice) {
			try {
				await m.delete();
				stats.deleted++;
			} catch (err) {
				stats.failed++;
				log(`  ✗ ${m.id} ${(err as Error).message}`);
			}
		}
	}
}

for (const m of old) {
	try {
		await m.delete();
		stats.deleted++;
	} catch (e) {
		stats.failed++;
		log(`  ✗ ${m.id} ${(e as Error).message}`);
	}
}

log(
	`[wipe-mentions] terminé — scanned=${stats.scanned} found=${stats.found} deleted=${stats.deleted} failed=${stats.failed}`,
);

await client.destroy();
process.exit(0);
