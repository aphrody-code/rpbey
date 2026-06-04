/**
 * events-pubsub.ts
 *
 * Bus d'événements métier **in-process** (EventEmitter). Sur Cloud Run le bot est
 * un singleton (une seule instance) : un bus mémoire suffit, plus aucun Redis pub/sub.
 *
 * Historiquement ces événements étaient publiés sur des canaux Redis et consommés
 * par le dashboard web via SSE (`apps/web/src/app/api/events/route.ts`). Le web étant
 * désormais un déploiement séparé (Vercel), le fan-out cross-process ne le concernait
 * déjà plus depuis le découplage ; les consommateurs intra-process (s'il y en a)
 * s'abonnent via `subscribeEvent`.
 *
 * Canaux :
 *   tournament — événements de sync/finalisation de tournoi
 *   ranking    — événements de fin de sync de classement
 *
 * Best-effort : ne lève jamais ; journalise un warning en cas d'échec pour ne pas
 * affecter l'appelant.
 */

import { EventEmitter } from "node:events";

import { logger } from "./logger.js";

export type EventChannel = "tournament" | "ranking";

const bus = new EventEmitter();
bus.setMaxListeners(0);

/**
 * Publie un événement métier (payload JSON) sur le canal donné.
 * Fire-and-forget : les erreurs sont capturées et journalisées en warning.
 */
export async function publishEvent(channel: EventChannel, payload: object): Promise<void> {
  try {
    const event = { channel, ts: Date.now(), ...payload };
    bus.emit(channel, event);
  } catch (err) {
    logger.warn(`[events-pubsub] Échec de publication sur ${channel}:`, err);
  }
}

/**
 * S'abonne à un canal d'événements métier in-process. Retourne une fonction de
 * désabonnement. Best-effort, ne lève jamais.
 */
export function subscribeEvent(
  channel: EventChannel,
  listener: (event: Record<string, unknown>) => void,
): () => void {
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
