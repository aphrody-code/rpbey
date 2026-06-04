/**
 * JSON loader for static data files.
 *
 * **Self-contained** : les fichiers `data/*` requis au runtime sont commités
 * dans le dépôt (`apps/web/data/`) et tracés dans la lambda Vercel via
 * `outputFileTracingIncludes` (cf. `next.config.ts`). On lit donc TOUJOURS
 * depuis le système de fichiers — Vercel comme VPS/dev — plus aucune dépendance
 * réseau `cdn.rpbey.fr`.
 *
 * Override possible via `NEXT_PUBLIC_ASSET_BASE` (legacy `NEXT_PUBLIC_CDN_DATA_URL`)
 * : si défini, fetch HTTP depuis cette origine (utile pour pointer un miroir/Blob
 * sans rebuild). Par défaut : lecture FS bundlée.
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

/**
 * Origine HTTP optionnelle pour les données (override). Vide par défaut → lecture
 * FS bundlée (self-contained Vercel). `NEXT_PUBLIC_ASSET_BASE` doit pointer une
 * origine servant `data/*` (ex. un miroir Blob). `NEXT_PUBLIC_CDN_DATA_URL` reste
 * supporté pour rétro-compat (mais n'est plus défini en prod).
 */
const REMOTE_BASE = (
  process.env.NEXT_PUBLIC_ASSET_BASE ??
  process.env.NEXT_PUBLIC_CDN_DATA_URL ??
  ""
).replace(/\/$/, "");

const store = new Map<string, unknown>();

async function loadFromFs(normalized: string): Promise<string> {
  // data/ + public/data/ supportés (selon où le fichier atterrit dans la lambda).
  // turbopackIgnore : empêche le NFT tracer Turbopack de tracer tout le CWD.
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), normalized),
    join(/* turbopackIgnore: true */ process.cwd(), "public", normalized),
    join(/* turbopackIgnore: true */ process.cwd(), "apps", "web", normalized),
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

async function loadJsonUncached<T = JsonValue>(relPath: string): Promise<T> {
  const normalized = relPath.replace(/^\.?\//, "");
  const hit = store.get(normalized);
  if (hit !== undefined) return hit as T;

  // Override HTTP explicite (miroir/Blob) — sinon lecture FS bundlée.
  if (REMOTE_BASE) {
    const url = `${REMOTE_BASE}/${normalized}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const parsed = (await res.json()) as T;
    store.set(normalized, parsed);
    return parsed;
  }

  const raw = await loadFromFs(normalized);
  const parsed = JSON.parse(raw) as T;
  store.set(normalized, parsed);
  return parsed;
}

export const loadJson = cache(loadJsonUncached) as <T = JsonValue>(relPath: string) => Promise<T>;

async function loadTextUncached(relPath: string): Promise<string> {
  const normalized = relPath.replace(/^\.?\//, "");

  if (REMOTE_BASE) {
    const url = `${REMOTE_BASE}/${normalized}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    return await res.text();
  }

  return loadFromFs(normalized);
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
