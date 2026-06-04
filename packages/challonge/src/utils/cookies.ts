/**
 * Cookie jar parsing + detection helpers.
 *
 * Serverless-safe: the cookie *source* is env-driven first
 * (`CHALLONGE_COOKIES` = inline JSON jar), so no persistent filesystem is
 * required. Any filesystem read is best-effort and guarded — on a read-only
 * serverless fs (Vercel lambdas, Cloud Run) `process.cwd()` is ephemeral and
 * the storage path will simply be absent, which is handled gracefully instead
 * of throwing.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RawCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: string | null;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface PuppeteerCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

/**
 * Sentinel returned by {@link resolveDefaultCookiePath} when the cookie jar is
 * supplied inline via the `CHALLONGE_COOKIES` env var instead of a file path.
 * {@link loadCookieJar} recognises this token and parses `CHALLONGE_COOKIES`
 * directly, so no filesystem access happens at all on serverless runtimes.
 */
export const INLINE_COOKIE_SOURCE = "env:CHALLONGE_COOKIES";

/** Read the inline cookie jar from env, if present and non-empty. */
function inlineCookieJson(): string | undefined {
  const raw = process.env.CHALLONGE_COOKIES;
  return raw && raw.trim() ? raw : undefined;
}

const COOKIE_CANDIDATES_FACTORY = (extra?: string): string[] => {
  // Filesystem candidates are best-effort only. `process.cwd()` is meaningless
  // on a read-only serverless fs; these paths are simply never found there.
  const out: string[] = [];
  if (extra) out.push(extra);
  if (process.env.CHALLONGE_COOKIE_PATH) out.push(process.env.CHALLONGE_COOKIE_PATH);
  try {
    out.push(resolve(process.cwd(), "storage/cookies/challonge_cookie.json"));
    out.push(resolve(process.cwd(), "../../storage/cookies/challonge_cookie.json"));
  } catch {
    // process.cwd() can throw in exotic sandboxes — ignore, env source covers it.
  }
  return out;
};

/**
 * Resolve a cookie source. Order: inline env jar (`CHALLONGE_COOKIES`) >
 * explicit `extra` path > `CHALLONGE_COOKIE_PATH` > best-effort cwd-relative
 * files. Returns {@link INLINE_COOKIE_SOURCE} when the inline env jar is used,
 * a real path when a readable file is found, or `null` otherwise. Never throws.
 */
export function resolveDefaultCookiePath(extra?: string): string | null {
  // Env-driven source wins so serverless runtimes need no filesystem at all.
  if (inlineCookieJson()) return INLINE_COOKIE_SOURCE;
  for (const p of COOKIE_CANDIDATES_FACTORY(extra)) {
    try {
      if (existsSync(p)) return p;
    } catch {
      // existsSync can throw on permission errors — treat as "not found".
    }
  }
  return null;
}

function normalizeSameSite(s?: string): "Strict" | "Lax" | "None" {
  if (s === "None") return "None";
  if (s === "Lax") return "Lax";
  return "Strict";
}

/**
 * Load a cookie jar from a file path or the inline env source.
 *
 * Pass {@link INLINE_COOKIE_SOURCE} (or call with no resolvable path and set
 * `CHALLONGE_COOKIES`) to parse the jar straight from the environment with no
 * filesystem access — the serverless-friendly path. Real file paths are read
 * with `readFileSync`; failures throw (callers such as `BxcTransport` catch and
 * degrade gracefully to an anonymous request).
 */
export function loadCookieJar(filePath: string): {
  raw: RawCookie[];
  forPuppeteer: PuppeteerCookie[];
  forFetch: string;
} {
  let raw: RawCookie[] = [];
  if (filePath === INLINE_COOKIE_SOURCE) {
    const inline = inlineCookieJson();
    if (!inline) {
      throw new Error("CHALLONGE_COOKIES env is empty or unset");
    }
    try {
      raw = JSON.parse(inline);
    } catch (err) {
      throw new Error(`Cannot parse CHALLONGE_COOKIES env jar: ${(err as Error).message}`, {
        cause: err,
      });
    }
  } else {
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      throw new Error(`Cannot read cookie jar at ${filePath}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  const challonge = raw.filter((c) => c.domain.includes("challonge.com"));

  const forPuppeteer: PuppeteerCookie[] = challonge.map((c) => {
    const cookie: PuppeteerCookie = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: normalizeSameSite(c.sameSite),
    };
    if (c.expires && c.expires !== "Session") {
      const t = new Date(c.expires).getTime();
      if (Number.isFinite(t)) cookie.expires = Math.floor(t / 1000);
    }
    return cookie;
  });

  const forFetch = challonge.map((c) => `${c.name}=${c.value}`).join("; ");

  return { raw: challonge, forPuppeteer, forFetch };
}

/**
 * Returns true if the session cookie is missing or visibly invalid.
 * The Challonge session cookie has the shape `<base64>--<sig>--<sig2>`.
 */
export function isSessionCookieValid(jar: RawCookie[]): boolean {
  const session = jar.find((c) => c.name === "_challonge_session_production");
  if (!session?.value) return false;
  // Cheap structural check
  return session.value.includes("--") && session.value.length > 100;
}

/**
 * Returns true if cf_clearance is present (might still be IP-bound).
 */
export function hasCfClearance(jar: RawCookie[]): boolean {
  return jar.some((c) => c.name === "cf_clearance" && !!c.value);
}
