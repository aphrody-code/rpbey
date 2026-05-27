import { type ClassValue, clsx } from "clsx";

/**
 * Merge class names conditionally
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a date to French locale
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  });
}

/**
 * Format a date in short format (e.g., "25 déc. 2024")
 */
export function formatDateShort(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date with time to French locale
 */
export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Parse a stat string (e.g. "29+") to a number
 */
export function parseStat(stat: string | number | null | undefined): number {
  if (typeof stat === "number") return stat;
  if (!stat) return 0;
  const match = String(stat).match(/^(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Avatar src sûr : renvoie `undefined` pour les valeurs invalides
 * ("none"/vide/non-url) afin que MUI Avatar tombe sur son fallback (initiales)
 * au lieu de requêter `/none` (404). Les données BTS/ranking contiennent "none".
 */
export function avatarSrc(url?: string | null): string | undefined {
  if (!url || url === "none" || url === "null" || url === "undefined") return undefined;
  return url.startsWith("http") || url.startsWith("/") ? url : undefined;
}
