/**
 * Shadow-mode — run two scraper backends in parallel and record divergences.
 *
 * Controlled by the RPB_CHALLONGE_BACKEND environment variable:
 *   "bxc"  (default) — use only the BxcTransport path
 *   "puppeteer"           — legacy placeholder (BxcTransport is always used;
 *                           this is kept for rollback signalling at runtime)
 *   "both"                — run both concurrently, log diffs via observability,
 *                           return the primary (bxc) result
 */

import { recordEvent } from "./observability";

export type ScraperBackend = "puppeteer" | "bxc" | "both";

/**
 * Current active backend, resolved once at module load.
 * Default is "bxc" — Phase 4 migration complete.
 */
export const BACKEND: ScraperBackend =
  (process.env.RPB_CHALLONGE_BACKEND as ScraperBackend | undefined) ?? "bxc";

// ---------------------------------------------------------------------------
// Deep diff helper
// ---------------------------------------------------------------------------

/** A dotted-path describing where two values diverged. */
export interface DiffEntry {
  path: string;
  primaryValue: unknown;
  shadowValue: unknown;
}

/**
 * Recursively compare two values, collecting all leaf paths where they differ.
 * Arrays are compared element-by-element by index.
 * Objects are compared by key union.
 * Primitives use strict equality.
 *
 * Depth is capped at 10 to avoid runaway recursion on deep structures.
 */
export function deepDiff(primary: unknown, shadow: unknown, path = "", depth = 0): DiffEntry[] {
  if (depth > 10) return [];

  // Identical — no diff.
  if (primary === shadow) return [];

  // Both null / undefined.
  if (primary == null && shadow == null) return [];

  // Both arrays.
  if (Array.isArray(primary) && Array.isArray(shadow)) {
    const diffs: DiffEntry[] = [];
    const len = Math.max(primary.length, shadow.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepDiff(primary[i], shadow[i], `${path}[${i}]`, depth + 1));
    }
    return diffs;
  }

  // Both plain objects.
  if (isPlainObject(primary) && isPlainObject(shadow)) {
    const diffs: DiffEntry[] = [];
    const keys = new Set([...Object.keys(primary as object), ...Object.keys(shadow as object)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      diffs.push(
        ...deepDiff(
          (primary as Record<string, unknown>)[key],
          (shadow as Record<string, unknown>)[key],
          childPath,
          depth + 1,
        ),
      );
    }
    return diffs;
  }

  // Primitive mismatch (or type mismatch array/object/primitive).
  return [{ path: path || "(root)", primaryValue: primary, shadowValue: shadow }];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// withShadowMode
// ---------------------------------------------------------------------------

/**
 * Run primary and shadow functions according to BACKEND.
 *
 * - "bxc" / "puppeteer": runs only `primary`, ignores `shadow`.
 * - "both": runs both concurrently. Always returns primary result.
 *   On divergence, emits `shadow.diff` observability events (one per field).
 *   Shadow errors are swallowed (logged only) to avoid impacting production.
 *
 * @param label   Human-readable name for logging (e.g. "scrape:B_TS5").
 * @param primary Function that performs the bxc scrape.
 * @param shadow  Function that performs the comparison scrape (legacy path).
 */
export async function withShadowMode<T>(
  label: string,
  primary: () => Promise<T>,
  shadow: () => Promise<T>,
): Promise<T> {
  const backend = BACKEND;

  if (backend !== "both") {
    // Single backend — just run primary.
    return primary();
  }

  // "both" mode — run concurrently.
  const [primaryResult, shadowResult] = await Promise.allSettled([
    primary(),
    shadow().catch((err: unknown) => {
      // Shadow errors must not bubble up.
      recordEvent("shadow.diff", {
        label,
        fields: ["(shadow-error)"],
        primaryValue: null,
        shadowValue: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }),
  ]);

  // Primary failure propagates normally.
  if (primaryResult.status === "rejected") {
    throw primaryResult.reason as unknown;
  }

  const pValue = primaryResult.value;

  if (shadowResult.status === "fulfilled" && shadowResult.value !== undefined) {
    const diffs = deepDiff(pValue, shadowResult.value);
    if (diffs.length > 0) {
      for (const d of diffs) {
        recordEvent("shadow.diff", {
          label,
          path: d.path,
          primaryValue: safePreview(d.primaryValue),
          shadowValue: safePreview(d.shadowValue),
        });
      }
    } else {
      // Identical results — record success.
      recordEvent("shadow.diff", {
        label,
        identical: true,
        fields: [],
      });
    }
  }

  return pValue;
}

/** Truncate large values to avoid huge log lines. */
function safePreview(v: unknown): unknown {
  if (typeof v === "string" && v.length > 200) return v.slice(0, 200) + "…";
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (isPlainObject(v)) return `Object(${Object.keys(v).length} keys)`;
  return v;
}
