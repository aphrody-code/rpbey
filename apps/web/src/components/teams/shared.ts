/**
 * Helpers partagés des composants Équipes (clans) côté client.
 * Fetcher SWR sur l'enveloppe `{ ok, data }`, libellés de rôles, et utilitaires
 * de formatage. Aucun accès DB ici — tout passe par les routes `/api/teams*`.
 */
import type { TeamRole } from "@rpbey/api-contract";

/** Réponse standard des routes équipe : `{ ok, data }` ou `{ ok:false, error }`. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Fetcher SWR : déballe l'enveloppe et lève l'erreur métier le cas échéant. */
export async function teamsFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json || json.ok === false) {
    throw new Error(json?.error?.message ?? "Une erreur est survenue.");
  }
  return json.data as T;
}

/** POST/PATCH/DELETE JSON sur une route équipe ; renvoie le `data` déballé. */
export async function teamsMutate<T = unknown>(
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

export const ROLE_LABELS: Record<TeamRole, string> = {
  CAPTAIN: "Capitaine",
  CO_CAPTAIN: "Co-capitaine",
  MEMBER: "Membre",
};

export const ROLE_COLORS: Record<TeamRole, "warning" | "info" | "default"> = {
  CAPTAIN: "warning",
  CO_CAPTAIN: "info",
  MEMBER: "default",
};

/** Régions FR proposées au filtre / formulaire (champ libre côté DB). */
export const TEAM_REGIONS = [
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Hauts-de-France",
  "Grand Est",
  "Provence-Alpes-Côte d'Azur",
  "Pays de la Loire",
  "Normandie",
  "Bretagne",
  "Bourgogne-Franche-Comté",
  "Centre-Val de Loire",
  "Outre-mer",
  "International",
] as const;

export function canManage(role: TeamRole | null): boolean {
  return role === "CAPTAIN" || role === "CO_CAPTAIN";
}

export function formatDateFr(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export function formatTimeFr(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Initiales pour avatar de repli (équipe ou joueur). */
export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
