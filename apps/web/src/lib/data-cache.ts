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

import { readFile, stat } from "node:fs/promises";
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

async function getFileStat(filePath: string) {
  return await stat(filePath);
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

type CacheEntry<T> =
  | {
      value: T;
      lastChecked: number;
      isRemote: true;
    }
  | {
      value: T;
      mtimeMs: number;
      lastChecked: number;
      isRemote: false;
    };

const store = new Map<string, CacheEntry<any>>();

async function getFileMtime(normalized: string): Promise<number> {
  const rest = normalized.startsWith("data/") ? normalized.substring(5) : normalized;
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "public", "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "apps", "web", "data", rest),
  ];
  for (const filePath of candidates) {
    try {
      const st = await getFileStat(filePath);
      return st.mtimeMs;
    } catch {
      // continue
    }
  }
  throw new Error(`not found: ${normalized}`);
}

async function getFileStatsAndContent(
  normalized: string,
): Promise<{ content: string; mtimeMs: number }> {
  const rest = normalized.startsWith("data/") ? normalized.substring(5) : normalized;
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "public", "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "apps", "web", "data", rest),
  ];
  let lastErr: unknown = null;
  for (const filePath of candidates) {
    try {
      const st = await getFileStat(filePath);
      const content = await readFileText(filePath);
      return { content, mtimeMs: st.mtimeMs };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`not found: ${normalized}`);
}

async function loadFromFs(normalized: string): Promise<string> {
  // data/ + public/data/ supportés (selon où le fichier atterrit dans la lambda).
  // turbopackIgnore : empêche le NFT tracer Turbopack de tracer tout le CWD.
  const rest = normalized.startsWith("data/") ? normalized.substring(5) : normalized;
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "public", "data", rest),
    join(/* turbopackIgnore: true */ process.cwd(), "apps", "web", "data", rest),
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
  const now = performance.now();

  const cached = store.get(normalized);
  if (cached) {
    if (cached.isRemote) {
      // Pour les requêtes distantes, TTL de 10 secondes
      if (now - cached.lastChecked < 10000) {
        return cached.value as T;
      }
    } else {
      // Pour les lectures FS, TTL de 2 secondes avant de vérifier le mtime
      if (now - cached.lastChecked < 2000) {
        return cached.value as T;
      }
      // Vérifier le mtime du fichier
      try {
        const mtimeMs = await getFileMtime(normalized);
        if (mtimeMs === cached.mtimeMs) {
          cached.lastChecked = now;
          return cached.value as T;
        }
      } catch {
        // continue
      }
    }
  }

  // Override HTTP explicite (miroir/Blob) — sinon lecture FS bundlée.
  if (REMOTE_BASE) {
    const url = `${REMOTE_BASE}/${normalized}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const parsed = (await res.json()) as T;
    store.set(normalized, {
      value: parsed,
      lastChecked: now,
      isRemote: true,
    });
    return parsed;
  }

  const { content, mtimeMs } = await getFileStatsAndContent(normalized);
  const parsed = JSON.parse(content) as T;
  store.set(normalized, {
    value: parsed,
    mtimeMs,
    lastChecked: now,
    isRemote: false,
  });
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
