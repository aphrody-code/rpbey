/**
 * redis.ts — couche d'état du bot, **serverless / sans Redis**.
 *
 * Sur Cloud Run le bot tourne en singleton (min=1 / max=1, `--no-cpu-throttling`) :
 * une seule instance, donc aucun besoin d'un store partagé inter-process. Cet ex-module
 * Redis est désormais :
 *   1. Un **client Redis-compatible in-process** (`redis`) — Map + TTL + pub/sub
 *      (EventEmitter) — qui implémente la poignée de commandes réellement utilisées
 *      (`GET/SET/SETEX/DEL/HSET/HGET/HGETALL/HINCRBY/PUBLISH/SUBSCRIBE/DUPLICATE/PING`).
 *      Les appelants (`cache.ts`, `events-pubsub.ts`, `config-service.ts`, `persona.ts`,
 *      `RpbeyMention.ts`) restent inchangés. Plus aucune dépendance à `REDIS_URL`.
 *   2. Les **compteurs de mentions + méta de scan** rebackés en **Postgres Neon**
 *      (`@rpbey/db`, tables `bot_mentions` / `bot_scan_meta`) → durables aux redéploiements
 *      Cloud Run (une instance redémarrée perd sa mémoire ; Postgres non).
 *
 * Le hash spécial `rpb:mentions` et `rpb:mentions:meta` sont routés vers Postgres
 * (durables) ; toutes les autres clés (caches courts, verrous anti-spam, anti-répétition
 * persona) vivent en mémoire avec TTL — leur perte au restart est sans conséquence.
 */
import { client as dbClient } from "@rpbey/db";

import { logger } from "./logger.js";

const MENTIONS_KEY = "rpb:mentions";
const META_KEY = "rpb:mentions:meta";

// ─── Mentions + scan-meta : backend Postgres (durable) ──────────────────────

/** Get mention count: how many times `fromId` mentioned `toId` */
export async function getMentions(fromId: string, toId: string): Promise<number> {
  const rows = await dbClient<{ count: number }[]>`
    SELECT count FROM bot_mentions WHERE from_id = ${fromId} AND to_id = ${toId}
  `;
  return rows[0]?.count ?? 0;
}

/** Increment mention count (upsert : count = count + n) */
export async function incrMentions(fromId: string, toId: string, count: number): Promise<void> {
  if (count <= 0) return;
  await dbClient`
    INSERT INTO bot_mentions (from_id, to_id, count)
    VALUES (${fromId}, ${toId}, ${count})
    ON CONFLICT (from_id, to_id) DO UPDATE SET count = bot_mentions.count + ${count}
  `;
}

/** Set mention count (used by full scan) */
export async function setMentions(fromId: string, toId: string, count: number): Promise<void> {
  await dbClient`
    INSERT INTO bot_mentions (from_id, to_id, count)
    VALUES (${fromId}, ${toId}, ${count})
    ON CONFLICT (from_id, to_id) DO UPDATE SET count = ${count}
  `;
}

/** Get all mention pairs — clé `fromId:toId` → count (format historique du hash Redis) */
export async function getAllMentions(): Promise<Record<string, number>> {
  const rows = await dbClient<{ from_id: string; to_id: string; count: number }[]>`
    SELECT from_id, to_id, count FROM bot_mentions
  `;
  const result: Record<string, number> = {};
  for (const r of rows) result[`${r.from_id}:${r.to_id}`] = r.count;
  return result;
}

/** Clear all mention data (before full rescan) */
export async function clearMentions(): Promise<void> {
  await dbClient`TRUNCATE bot_mentions`;
}

/** Bulk upsert d'une rafale de paires `fromId:toId` → count (utilisé par le scan complet). */
async function bulkSetMentions(pairs: [string, number][]): Promise<void> {
  if (pairs.length === 0) return;
  const values = pairs.map(([key, count]) => {
    const idx = key.indexOf(":");
    return { from: key.slice(0, idx), to: key.slice(idx + 1), count };
  });
  // postgres.js : un seul round-trip via UNNEST des trois colonnes.
  const froms = values.map((v) => v.from);
  const tos = values.map((v) => v.to);
  const counts = values.map((v) => v.count);
  await dbClient`
    INSERT INTO bot_mentions (from_id, to_id, count)
    SELECT * FROM UNNEST(${froms}::text[], ${tos}::text[], ${counts}::int[])
    ON CONFLICT (from_id, to_id) DO UPDATE SET count = EXCLUDED.count
  `;
}

/** Set last scan metadata */
export async function setScanMeta(channelsScanned: number, messagesScanned: number): Promise<void> {
  await setScanMetaKV("channelsScanned", String(channelsScanned));
  await setScanMetaKV("messagesScanned", String(messagesScanned));
  await setScanMetaKV("lastScan", new Date().toISOString());
}

async function setScanMetaKV(k: string, v: string): Promise<void> {
  await dbClient`
    INSERT INTO bot_scan_meta (k, v) VALUES (${k}, ${v})
    ON CONFLICT (k) DO UPDATE SET v = ${v}
  `;
}

/** Get last scan metadata */
export async function getScanMeta(): Promise<{
  channelsScanned: number;
  messagesScanned: number;
  lastScan: string | null;
}> {
  const rows = await dbClient<{ k: string; v: string }[]>`SELECT k, v FROM bot_scan_meta`;
  const map = new Map(rows.map((r) => [r.k, r.v]));
  return {
    channelsScanned: Number.parseInt(map.get("channelsScanned") ?? "0", 10),
    messagesScanned: Number.parseInt(map.get("messagesScanned") ?? "0", 10),
    lastScan: map.get("lastScan") ?? null,
  };
}

// ─── Client Redis-compatible in-process ─────────────────────────────────────
//
// Implémente la poignée de commandes réellement appelées dans le code. Toutes les
// clés (sauf le hash durable `rpb:mentions` / `rpb:mentions:meta`, routé Postgres)
// vivent en mémoire avec TTL. Pub/sub via EventEmitter. Compatible avec l'API de
// `Bun.RedisClient` pour les usages présents : `get/set/del/send/publish/subscribe/
// duplicate/ping/hget/hset/hgetall/hincrby`.

import { EventEmitter } from "node:events";

interface Entry {
  value: string;
  expiresAt: number | null; // epoch ms, null = pas de TTL
}

class InProcessRedis {
  private store = new Map<string, Entry>();
  private hashes = new Map<string, Map<string, string>>();
  private bus: EventEmitter;

  constructor(bus?: EventEmitter) {
    // Le bus est partagé entre le client racine et ses duplicatas (subscribers),
    // sinon un publish() ne serait jamais vu par un sub issu de duplicate().
    this.bus = bus ?? new EventEmitter();
    this.bus.setMaxListeners(0);
  }

  private alive(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async get(key: string): Promise<string | null> {
    return this.alive(key)?.value ?? null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, { value, expiresAt: null });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (key === MENTIONS_KEY) {
        await clearMentions();
        n++;
        continue;
      }
      if (this.store.delete(key)) n++;
      if (this.hashes.delete(key)) n++;
    }
    return n;
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (key === MENTIONS_KEY) {
      const idx = field.indexOf(":");
      const v = await getMentions(field.slice(0, idx), field.slice(idx + 1));
      return v ? String(v) : null;
    }
    if (key === META_KEY) {
      const rows = await dbClient<{ v: string }[]>`SELECT v FROM bot_scan_meta WHERE k = ${field}`;
      return rows[0]?.v ?? null;
    }
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (key === MENTIONS_KEY) {
      await setMentions(field.slice(0, field.indexOf(":")), field.slice(field.indexOf(":") + 1), Number(value));
      return 1;
    }
    if (key === META_KEY) {
      await setScanMetaKV(field, value);
      return 1;
    }
    let h = this.hashes.get(key);
    if (!h) this.hashes.set(key, (h = new Map()));
    const fresh = h.has(field) ? 0 : 1;
    h.set(field, value);
    return fresh;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (key === MENTIONS_KEY) {
      const idx = field.indexOf(":");
      const from = field.slice(0, idx);
      const to = field.slice(idx + 1);
      await incrMentions(from, to, increment);
      return getMentions(from, to);
    }
    let h = this.hashes.get(key);
    if (!h) this.hashes.set(key, (h = new Map()));
    const next = Number.parseInt(h.get(field) ?? "0", 10) + increment;
    h.set(field, String(next));
    return next;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (key === MENTIONS_KEY) {
      const all = await getAllMentions();
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(all)) out[k] = String(v);
      return out;
    }
    if (key === META_KEY) {
      const rows = await dbClient<{ k: string; v: string }[]>`SELECT k, v FROM bot_scan_meta`;
      return Object.fromEntries(rows.map((r) => [r.k, r.v]));
    }
    return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
  }

  /**
   * Commande générique façon `Bun.RedisClient.send(cmd, args)`. Couvre les
   * commandes employées par le code : SET (+EX/NX), SETEX, GET, DEL, HSET (multi-field).
   * Retourne `null` quand la sémantique Redis le voudrait (ex. SET NX sur clé existante).
   */
  async send(command: string, args: string[]): Promise<unknown> {
    const cmd = command.toUpperCase();
    switch (cmd) {
      case "GET":
        return this.get(args[0]!);
      case "SET": {
        const key = args[0]!;
        const value = args[1]!;
        let nx = false;
        let exSeconds: number | null = null;
        for (let i = 2; i < args.length; i++) {
          const opt = args[i]!.toUpperCase();
          if (opt === "NX") nx = true;
          else if (opt === "EX") exSeconds = Number.parseInt(args[++i]!, 10);
          else if (opt === "PX") exSeconds = Number.parseInt(args[++i]!, 10) / 1000;
        }
        if (nx && this.alive(key)) return null; // déjà présent → échec NX
        this.store.set(key, {
          value,
          expiresAt: exSeconds !== null ? Date.now() + exSeconds * 1000 : null,
        });
        return "OK";
      }
      case "SETEX": {
        const [key, ttl, value] = args as [string, string, string];
        this.store.set(key, { value, expiresAt: Date.now() + Number.parseInt(ttl, 10) * 1000 });
        return "OK";
      }
      case "DEL":
        return this.del(...args);
      case "HSET": {
        const key = args[0]!;
        const pairs: [string, string][] = [];
        for (let i = 1; i + 1 < args.length; i += 2) pairs.push([args[i]!, args[i + 1]!]);
        if (key === MENTIONS_KEY) {
          await bulkSetMentions(pairs.map(([f, v]) => [f, Number(v)] as [string, number]));
          return pairs.length;
        }
        if (key === META_KEY) {
          for (const [f, v] of pairs) await setScanMetaKV(f, v);
          return pairs.length;
        }
        let h = this.hashes.get(key);
        if (!h) this.hashes.set(key, (h = new Map()));
        let added = 0;
        for (const [f, v] of pairs) {
          if (!h.has(f)) added++;
          h.set(f, v);
        }
        return added;
      }
      default:
        logger.warn(`[redis:in-process] commande non gérée: ${cmd} (no-op)`);
        return null;
    }
  }

  // ─── Pub/Sub (in-process EventEmitter) ──
  async publish(channel: string, message: string): Promise<number> {
    this.bus.emit(channel, message);
    return this.bus.listenerCount(channel);
  }

  async subscribe(channel: string, listener: (message: string) => void): Promise<void> {
    this.bus.on(channel, listener);
  }

  async unsubscribe(channel?: string): Promise<void> {
    if (channel) this.bus.removeAllListeners(channel);
    else this.bus.removeAllListeners();
  }

  /** Renvoie une nouvelle connexion logique partageant le même bus pub/sub. */
  async duplicate(): Promise<InProcessRedis> {
    return new InProcessRedis(this.bus);
  }

  close(): void {
    this.store.clear();
    this.hashes.clear();
  }
}

/**
 * Client d'état du bot — drop-in Redis in-process (aucune connexion réseau).
 * Conserve le nom d'export `redis` pour ne rien casser chez les appelants.
 */
export const redis = new InProcessRedis();

logger.info("[redis] backend in-process (serverless) — mentions/scan-meta sur Postgres Neon");
