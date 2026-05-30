/**
 * Helpers partagés des composants Sondages / Tier Lists côté client.
 * Fetcher SWR sur l'enveloppe `{ ok, data }`, mutateur JSON, libellés et couleurs
 * des tiers. Aucun accès DB ici — tout passe par les routes `/api/(v1/)polls*`
 * et `/api/(v1/)tier-lists*`.
 */
import type { PollKind, Tier, TierListKind } from "@rpbey/api-contract";

/** Catégorie des Beyblade Awards France 2025 (filtre `polls.category`). */
export const AWARDS_CATEGORY = "Beyblade Awards France 2025";

/** Lien vers le Google Form d'origine des Awards (contexte admin). */
export const AWARDS_GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeaemH2jJkqSXR8G6Lm_JDtXI3gs3bytOfFEvXC5nOunbUauw/viewform";

/** Gagnant EN TÊTE d'une catégorie d'award (option la plus votée) — preview palmarès. */
export interface AwardLeader {
  pollSlug: string;
  pollTitle: string;
  totalVotes: number;
  leader: { label: string; imageUrl: string | null; voteCount: number; percent: number } | null;
}

/** Réponse standard des routes : `{ ok, data }` ou `{ ok:false, error }`. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Fetcher SWR : déballe l'enveloppe et lève l'erreur métier le cas échéant. */
export async function pollsFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json || json.ok === false) {
    throw new Error(json?.error?.message ?? "Une erreur est survenue.");
  }
  return json.data as T;
}

/** POST/PATCH/DELETE JSON ; renvoie le `data` déballé. */
export async function pollsMutate<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json || json.ok === false) {
    throw new Error(json?.error?.message ?? "Une erreur est survenue.");
  }
  return json.data as T;
}

/** Ordre canonique des tiers (haut → bas). */
export const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"];

/**
 * Couleurs des tiers (S=rouge → F=gris). Calque l'usage tier-list classique :
 * bandeau coloré opaque, texte foncé pour rester lisible.
 */
export const TIER_COLORS: Record<Tier, { bg: string; on: string }> = {
  S: { bg: "#ff6b6b", on: "#3d0000" },
  A: { bg: "#ffa94d", on: "#3d1f00" },
  B: { bg: "#ffe066", on: "#3d3300" },
  C: { bg: "#a9e34b", on: "#163d00" },
  D: { bg: "#74c0fc", on: "#00253d" },
  F: { bg: "#adb5bd", on: "#212529" },
};

export const POLL_KIND_LABELS: Record<PollKind, string> = {
  SINGLE: "Choix unique",
  MULTIPLE: "Choix multiple",
  RATING: "Notation",
};

export const TIER_LIST_KIND_LABELS: Record<TierListKind, string> = {
  BEY: "Toupies",
  CHARACTER: "Personnages",
  SEASON: "Saisons",
};

export const SEASON_LABELS: Record<string, string> = {
  ORIGINAL: "Original",
  METAL: "Metal Saga",
  BURST: "Burst",
  X: "Beyblade X",
};

export function seasonLabel(season?: string | null): string {
  if (!season) return "";
  return SEASON_LABELS[season] ?? season;
}

export function formatVotes(n: number): string {
  return `${n} vote${n > 1 ? "s" : ""}`;
}

export function formatSubmissions(n: number): string {
  return `${n} soumission${n > 1 ? "s" : ""}`;
}
