/**
 * Client REST économie + lecture des frames anime (web). Toutes les requêtes
 * authentifiées portent le Bearer (`gacha_token`) minté par `/discord_token`.
 *
 * Dans Discord, les URL absolues sont réécrites vers le proxy `/.proxy/<mapping>`
 * (cf. env.ts `proxifyUrl`) — `api` pour le serveur gacha, `web` pour rpbey.fr.
 */
import { GACHA_REST_URL, proxifyUrl, WEB_BASE } from "../env";
import type {
  AnimeFramesResponse,
  DailyResult,
  GachaBalance,
  MultiPullResult,
  PullResult,
  RestEnvelope,
} from "../types";

let bearer = "";

export function setBearer(token: string): void {
  bearer = token;
}

async function rest<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const url = proxifyUrl(`${GACHA_REST_URL}${path}`, "api");
  const res = await fetch(url, {
    method,
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
  const body = (await res.json()) as RestEnvelope<T> | T;
  if (typeof body === "object" && body !== null && "ok" in body) {
    const env = body as RestEnvelope<T>;
    if (!env.ok) throw new Error(env.error?.message ?? "Erreur serveur");
    return (env.result ?? (env as unknown as T)) as T;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return body as T;
}

export const api = {
  pull: () => rest<PullResult>("/api/gacha/pull", "POST"),
  pull10: () => rest<MultiPullResult>("/api/gacha/pull10", "POST"),
  daily: () => rest<DailyResult>("/api/gacha/daily", "POST"),
  balance: () => rest<GachaBalance>("/api/gacha/balance", "GET"),
};

/**
 * Frames d'anime notables (backgrounds de scène). Endpoint web public, donc pas
 * de Bearer requis. Réponse = `{ frames, nextCursor, total }`.
 */
export async function fetchNotableFrames(opts: {
  series?: string;
  limit?: number;
}): Promise<AnimeFramesResponse> {
  const qs = new URLSearchParams({ notable: "true", limit: String(opts.limit ?? 24) });
  if (opts.series) qs.set("series", opts.series);
  const url = proxifyUrl(`${WEB_BASE}/api/v1/anime/frames?${qs.toString()}`, "web");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AnimeFramesResponse;
}

/** URL de l'image d'une carte (rendu OG du web), proxifiée si dans Discord. */
export function cardImageUrl(cardId: string): string {
  return proxifyUrl(`${WEB_BASE}/api/gacha/card?id=${encodeURIComponent(cardId)}`, "web");
}
