/**
 * events-pubsub.ts
 *
 * Thin helper to publish business events on Redis pub/sub channels.
 * Consumed by the web dashboard via SSE (apps/web/src/app/api/events/route.ts).
 *
 * Channels:
 *   rpb:events:tournament  — tournament sync/finalize events
 *   rpb:events:ranking     — ranking sync completion events
 *
 * Best-effort: never throws; logs a warning on failure so caller is unaffected.
 */

import { redis } from "./redis.js";
import { logger } from "./logger.js";

export type EventChannel = "tournament" | "ranking";

const CHANNEL_PREFIX = "rpb:events:";

/**
 * Publish a business event JSON payload to the given Redis channel.
 * Fire-and-forget: errors are caught and logged as warnings.
 */
export async function publishEvent(channel: EventChannel, payload: object): Promise<void> {
  const fullChannel = `${CHANNEL_PREFIX}${channel}`;
  try {
    const json = JSON.stringify({ channel, ts: Date.now(), ...payload });
    await redis.publish(fullChannel, json);
  } catch (err) {
    logger.warn(`[events-pubsub] Failed to publish on ${fullChannel}:`, err);
  }
}
