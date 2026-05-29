/**
 * Activity-feed (log) store extractor — pure, bundlable.
 *
 * Single source of truth for turning a parsed `_initialStoreState` map into
 * `ScrapedLogEntry[]`. Moved verbatim out of `scraper.ts` (P3 registry split):
 * the implementation is byte-for-byte identical, only relocated so the
 * extractor stays free of any bxc / transport / FFI import and can be reused
 * from the route registry.
 *
 * Input is a `Record<string, unknown>` (the parsed store); output is
 * `ScrapedLogEntry[]`. Universally bundlable (Next.js).
 *
 * @module extractors/stores/log
 */

import { type ScrapedLogEntry } from "../../types";

/** Loose shape of a single raw activity-feed entry across Challonge layouts. */
export interface LogEntryRaw {
  created_at?: string;
  timestamp?: string;
  date?: string;
  type?: string;
  action?: string;
  event_type?: string;
  message?: string;
  description?: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Extract activity-feed entries from a parsed `_initialStoreState` map.
 *
 * Handles both the current (2026) layout — `LogEntryListStore` is an array
 * directly — and the legacy `{ entries: [...] }` / `{ log: [...] }` wrappers
 * (incl. `TournamentStore.log` / `TournamentStore.activity_log`).
 *
 * @param store  Parsed `_initialStoreState` map.
 * @returns Parsed log entries (empty array when none found).
 */
export function storeToLogEntries(store: Record<string, unknown>): ScrapedLogEntry[] {
  // Current Challonge layout (2026): _initialStoreState['LogEntryListStore'] = [...] directly
  const directArray = store["LogEntryListStore"];
  if (Array.isArray(directArray)) {
    const entries = directArray as LogEntryRaw[];
    return entries.map((entry) => ({
      timestamp: entry.created_at ?? entry.timestamp ?? entry.date ?? "",
      type:
        entry.type ??
        entry.action ??
        entry.event_type ??
        (entry as Record<string, unknown>)["key"]?.toString() ??
        "activity",
      message: entry.description ?? entry.message ?? entry.text ?? "",
      raw: entry,
    }));
  }

  // Legacy layout: wrapped in { entries: [...] } or { log: [...] }
  const ls =
    (store["LogEntryListStore"] as Record<string, unknown> | null) ??
    (store["LogStore"] as Record<string, unknown> | null) ??
    (store["ActivityStore"] as Record<string, unknown> | null);

  const rawEntries =
    (ls?.["entries"] as LogEntryRaw[] | null) ??
    (ls?.["log"] as LogEntryRaw[] | null) ??
    ((store["TournamentStore"] as Record<string, unknown> | null)?.["log"] as
      | LogEntryRaw[]
      | null) ??
    ((store["TournamentStore"] as Record<string, unknown> | null)?.["activity_log"] as
      | LogEntryRaw[]
      | null);

  if (!Array.isArray(rawEntries) || rawEntries.length === 0) return [];

  return rawEntries.map((entry) => ({
    timestamp: entry.created_at ?? entry.timestamp ?? entry.date ?? "",
    type: entry.type ?? entry.action ?? entry.event_type ?? "unknown",
    message: entry.message ?? entry.description ?? entry.text ?? JSON.stringify(entry),
    raw: entry,
  }));
}
