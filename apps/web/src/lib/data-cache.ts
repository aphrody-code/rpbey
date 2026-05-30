/**
 * JSON loader for static data files.
 *
 * - Sur Vercel : fetch `cdn.rpbey.fr/static/rpb-dashboard/data/*` (servi par
 *   nginx VPS, whitelist `/static/rpb-dashboard/`). Garde la lambda mince
 *   (pas de bundling FS, evite `function_size_exceeded` 250 MB).
 * - Sur VPS standalone / dev local : lecture FS directe via `readFile`.
 *
 * Override possible via `NEXT_PUBLIC_CDN_DATA_URL`.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Lecture FS runtime-agnostique : `Bun.file` quand le runtime est Bun (prod
 * systemd, dev), sinon `node:fs/promises` (ex. `next build` lancé sous Node pour
 * contourner un crash du tracer Bun). Comportement identique, zéro dépendance Bun
 * au build.
 */
async function readFileText(filePath: string): Promise<string> {
  const bun = (globalThis as { Bun?: { file(p: string): { text(): Promise<string> } } }).Bun;
  return bun ? await bun.file(filePath).text() : await readFile(filePath, "utf8");
}

const CDN_BASE =
  process.env.NEXT_PUBLIC_CDN_DATA_URL ?? "https://cdn.rpbey.fr/static/rpb-dashboard";

const store = new Map<string, unknown>();

async function loadJsonUncached<T = JsonValue>(relPath: string): Promise<T> {
  const normalized = relPath.replace(/^\.?\//, "");
  const hit = store.get(normalized);
  if (hit !== undefined) return hit as T;

  // Vercel : fetch CDN VPS (rpbey) avec ISR 1h.
  if (process.env.VERCEL === "1") {
    const url = `${CDN_BASE}/${normalized}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const parsed = (await res.json()) as T;
    store.set(normalized, parsed);
    return parsed;
  }

  // Dev local / VPS standalone : lecture FS directe (data/ + public/data/ supportés).
  // turbopackIgnore : empêche le NFT tracer Turbopack de tracer tout le CWD (warning
  // « Encountered unexpected file in NFT list ») — pattern utilisé par Next lui-même.
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), normalized),
    join(/* turbopackIgnore: true */ process.cwd(), "public", normalized),
  ];
  let lastErr: unknown = null;
  for (const filePath of candidates) {
    try {
      const raw = await readFileText(filePath);
      const parsed = JSON.parse(raw) as T;
      store.set(normalized, parsed);
      return parsed;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`not found: ${normalized}`);
}

export const loadJson = cache(loadJsonUncached) as <T = JsonValue>(relPath: string) => Promise<T>;

async function loadTextUncached(relPath: string): Promise<string> {
  const normalized = relPath.replace(/^\.?\//, "");

  if (process.env.VERCEL === "1") {
    const url = `${CDN_BASE}/${normalized}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    return await res.text();
  }

  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), normalized),
    join(/* turbopackIgnore: true */ process.cwd(), "public", normalized),
  ];
  let lastErr: unknown = null;
  for (const filePath of candidates) {
    try {
      return await readFileText(filePath);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`not found: ${normalized}`);
}

export const loadText = cache(loadTextUncached);

/** Same as `loadJson` but returns `null` on read/parse errors. */
export async function loadJsonSafe<T = JsonValue>(relPath: string): Promise<T | null> {
  try {
    return await loadJson<T>(relPath);
  } catch {
    return null;
  }
}

/** Test/dev helper to clear the cache (e.g. after a data regen). */
export function clearDataCache(relPath?: string) {
  if (relPath) store.delete(relPath);
  else store.clear();
}
