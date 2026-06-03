/**
 * curl-impersonate transport — Cloudflare-bypass HTTP client.
 *
 * Why not `puppeteer-extra` ?
 *  - Puppeteer launches a 200MB headless Chrome and is detected by CF's
 *    Runtime.enable fingerprint check.
 *  - curl-impersonate emits the same TLS+HTTP/2 fingerprint as a real Chrome,
 *    in 50ms with zero memory footprint.
 *
 * The binary is bundled at /home/ubuntu/vps/storage/bin/curl-impersonate/.
 * Override with env CHALLONGE_CURL_IMPERSONATE_DIR.
 *
 * Profiles available (chrome99 → chrome146, edge99/101, firefox133/135/144/147,
 * safari153/155/170/172_ios/180/180_ios/184/184_ios/260/260_ios/2601, tor145).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Hardening (inspired by Anthropic's WebFetchTool reference impl):
 *   - LRU cache with 15-min TTL + 50MB cap (configurable, disable per-call).
 *   - URL validation:  max 2000 chars, no creds, public-looking hostname.
 *   - http:// auto-upgraded to https://.
 *   - MAX_HTTP_CONTENT_LENGTH enforced via curl `--max-filesize`.
 *   - Cap MAX_REDIRECTS even if --follow-redirects is on.
 *   - Optional same-origin redirect policy (`safeRedirects: true`):
 *     allow www. toggle + path/query change but block cross-host redirects.
 *   - Typed errors (CurlImpersonateError, RedirectInfo).
 * ───────────────────────────────────────────────────────────────────────────
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { LRUCache } from "lru-cache";

import { loadCookieJar, resolveDefaultCookiePath } from "../utils/cookies";

// ─── Constants & types ──────────────────────────────────────────────────────

export type CurlImpersonateProfile =
  | "chrome99"
  | "chrome100"
  | "chrome101"
  | "chrome104"
  | "chrome107"
  | "chrome110"
  | "chrome116"
  | "chrome119"
  | "chrome120"
  | "chrome123"
  | "chrome124"
  | "chrome131"
  | "chrome131_android"
  | "chrome133a"
  | "chrome136"
  | "chrome142"
  | "chrome145"
  | "chrome146"
  | "chrome99_android"
  | "edge99"
  | "edge101"
  | "firefox133"
  | "firefox135"
  | "firefox144"
  | "firefox147"
  | "safari153"
  | "safari155"
  | "safari170"
  | "safari172_ios"
  | "safari180"
  | "safari180_ios"
  | "safari184"
  | "safari184_ios"
  | "safari260"
  | "safari260_ios"
  | "safari2601"
  | "tor145";

export interface CurlImpersonateOptions {
  /** Browser/version profile. Default `chrome131`. */
  profile?: CurlImpersonateProfile;
  /** Path to the curl-impersonate install directory. */
  binDir?: string;
  /** Path to a JSON cookie jar (auto-discovered by default). */
  cookiePath?: string;
  /** Per-request timeout (seconds). Default 30. */
  timeoutSec?: number;
  /** Follow redirects. Default true. */
  followRedirects?: boolean;
  /** Max redirects. Default 10. */
  maxRedirects?: number;
  /**
   * Refuse to follow redirects to a different origin (host strictly equal,
   * `www.` toggle allowed). Default false (follow anywhere up to maxRedirects).
   * When true, a cross-host redirect resolves to a `RedirectInfo` instead of
   * being followed — caller can re-issue with the new URL after vetting.
   */
  safeRedirects?: boolean;
  /** Extra HTTP headers to inject (after impersonation defaults). */
  extraHeaders?: Record<string, string>;
  /** Enable response cache. Default true. */
  cache?: boolean;
  /** Logger hook. */
  log?: (msg: string) => void;
}

export interface CurlImpersonateResponse {
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  body: string;
  /** Total request time in seconds. */
  timeSec: number;
  /** True if the response was served from cache (zero network). */
  fromCache?: boolean;
}

export interface RedirectInfo {
  type: "redirect";
  originalUrl: string;
  redirectUrl: string;
  statusCode: number;
}

export class CurlImpersonateError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
    public bodySample: string | null = null,
  ) {
    super(message);
    this.name = "CurlImpersonateError";
  }
}

// ─── Constants (mirroring Anthropic WebFetchTool defaults) ─────────────────

/** Hard cap to deter exfil-via-URL-length. */
const MAX_URL_LENGTH = 2000;
/** Per-response body cap. */
const MAX_HTTP_CONTENT_LENGTH = 10 * 1024 * 1024;
/** Cache: 15-min TTL, 50MB cap (matches WebFetchTool reference). */
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_BYTES = 50 * 1024 * 1024;

const DEFAULT_BIN_DIR =
  process.env.CHALLONGE_CURL_IMPERSONATE_DIR ?? join(homedir(), ".local", "bin");

// ─── LRU response cache ────────────────────────────────────────────────────

interface CacheEntry {
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  body: string;
  timeSec: number;
  bytes: number;
}

const RESPONSE_CACHE = new LRUCache<string, CacheEntry>({
  maxSize: CACHE_MAX_BYTES,
  ttl: CACHE_TTL_MS,
  sizeCalculation: (entry) => Math.max(1, entry.bytes),
});

/** Drop every cached response. */
export function clearCurlCache(): void {
  RESPONSE_CACHE.clear();
}

/** Cache size for diagnostics. */
export function curlCacheStats(): { size: number; entries: number } {
  return { size: RESPONSE_CACHE.calculatedSize ?? 0, entries: RESPONSE_CACHE.size };
}

// ─── URL helpers ───────────────────────────────────────────────────────────

export function validateURL(url: string): { ok: true } | { ok: false; reason: string } {
  if (typeof url !== "string" || url.length === 0) {
    return { ok: false, reason: "URL must be a non-empty string" };
  }
  if (url.length > MAX_URL_LENGTH) {
    return { ok: false, reason: `URL exceeds ${MAX_URL_LENGTH} chars` };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "URL could not be parsed" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URL contains embedded credentials" };
  }
  if (parsed.hostname.split(".").length < 2) {
    return { ok: false, reason: "Hostname is not publicly resolvable" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }
  return { ok: true };
}

/** Upgrade `http://` to `https://` (matches WebFetchTool behaviour). */
export function upgradeToHttps(url: string): string {
  if (url.startsWith("http://")) return "https://" + url.slice(7);
  return url;
}

/**
 * Same-origin redirect check: protocol+port must match, host must be equal
 * up to a `www.` toggle. Path/query are unrestricted.
 */
export function isPermittedRedirect(originalUrl: string, redirectUrl: string): boolean {
  try {
    const a = new URL(originalUrl);
    const b = new URL(redirectUrl, originalUrl);
    if (a.protocol !== b.protocol) return false;
    if (a.port !== b.port) return false;
    if (b.username || b.password) return false;
    const strip = (h: string) => h.replace(/^www\./, "");
    return strip(a.hostname) === strip(b.hostname);
  } catch {
    return false;
  }
}

// ─── Option resolution ─────────────────────────────────────────────────────

interface ResolvedCurlOptions {
  profile: CurlImpersonateProfile;
  binDir: string;
  cookieHeader: string;
  timeoutSec: number;
  followRedirects: boolean;
  maxRedirects: number;
  safeRedirects: boolean;
  extraHeaders: Record<string, string>;
  cacheEnabled: boolean;
  log: (msg: string) => void;
}

function resolveOptions(opts: CurlImpersonateOptions): ResolvedCurlOptions {
  const binDir = opts.binDir ?? DEFAULT_BIN_DIR;
  if (!existsSync(/* turbopackIgnore: true */ binDir)) {
    throw new CurlImpersonateError(
      `curl-impersonate binary directory not found at ${binDir}. ` +
        `Install: curl -sSL https://github.com/lexiforest/curl-impersonate/releases/latest/download/curl-impersonate-v1.5.5.x86_64-linux-gnu.tar.gz | tar -xz -C ${binDir}`,
    );
  }
  const cookiePath = opts.cookiePath ?? resolveDefaultCookiePath();
  let cookieHeader = "";
  if (cookiePath) {
    try {
      cookieHeader = loadCookieJar(cookiePath).forFetch;
    } catch {
      cookieHeader = "";
    }
  }
  return {
    profile: opts.profile ?? "chrome131",
    binDir,
    cookieHeader,
    timeoutSec: opts.timeoutSec ?? 30,
    followRedirects: opts.followRedirects ?? true,
    maxRedirects: opts.maxRedirects ?? 10,
    safeRedirects: opts.safeRedirects ?? false,
    extraHeaders: opts.extraHeaders ?? {},
    cacheEnabled: opts.cache ?? true,
    log: opts.log ?? (() => {}),
  };
}

// ─── Core HTTP ─────────────────────────────────────────────────────────────

interface CurlSpawnResult {
  stdout: Uint8Array;
  stderr: string;
  code: number;
}

async function spawnCurl(bin: string, args: string[]): Promise<CurlSpawnResult> {
  const proc = Bun.spawn([bin, ...args], { stdin: null, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderrBytes, code] = await Promise.all([
    // Bun.readableStreamToBytes is the typed helper (runtime equivalent of .bytes())
    Bun.readableStreamToBytes(proc.stdout),
    Bun.readableStreamToBytes(proc.stderr),
    proc.exited,
  ]);
  return {
    stdout,
    stderr: new TextDecoder().decode(stderrBytes),
    code: code ?? -1,
  };
}

interface ParsedCurlOutput {
  headers: Record<string, string>;
  body: string;
  status: number;
  finalUrl: string;
  timeSec: number;
  redirectChain: Array<{ status: number; location: string | null }>;
}

function parseCurlOutput(raw: string): ParsedCurlOutput {
  const metaIdx = raw.lastIndexOf("\n");
  const meta = raw.slice(metaIdx + 1).trim();
  const [statusStr, finalUrl, timeStr] = meta.split("|");
  const status = Number(statusStr) || 0;
  const timeSec = Number(timeStr) || 0;
  const beforeMeta = raw.slice(0, metaIdx);

  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < beforeMeta.length) {
    const httpStart = beforeMeta.indexOf("HTTP/", cursor);
    if (httpStart === -1) break;
    const endA = beforeMeta.indexOf("\r\n\r\n", httpStart);
    const endB = beforeMeta.indexOf("\n\n", httpStart);
    const ends: Array<{ idx: number; len: number }> = [];
    if (endA !== -1) ends.push({ idx: endA, len: 4 });
    if (endB !== -1) ends.push({ idx: endB, len: 2 });
    if (ends.length === 0) break;
    const ending = ends.reduce((a, b) => (a.idx < b.idx ? a : b));
    blocks.push(beforeMeta.slice(httpStart, ending.idx));
    cursor = ending.idx + ending.len;
    if (!beforeMeta.slice(cursor).startsWith("HTTP/")) break;
  }
  const last = blocks[blocks.length - 1] ?? "";
  const headers: Record<string, string> = {};
  for (const line of last.split(/\r?\n/).slice(1)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const k = line.slice(0, colon).trim().toLowerCase();
    const v = line.slice(colon + 1).trim();
    headers[k] = v;
  }
  const redirectChain = blocks.map((b) => {
    const firstLine = b.split(/\r?\n/)[0] ?? "";
    const codeMatch = firstLine.match(/HTTP\/[\d.]+\s+(\d+)/);
    const locMatch = b.match(/^[Ll]ocation:\s*(.+)$/m);
    return {
      status: codeMatch ? Number(codeMatch[1]) : 0,
      location: (locMatch ? locMatch[1]?.trim() : null) ?? null,
    };
  });
  return {
    headers,
    body: beforeMeta.slice(cursor),
    status,
    finalUrl: finalUrl ?? "",
    timeSec,
    redirectChain,
  };
}

/**
 * Fetch a URL with browser-grade TLS fingerprint.
 *
 * @example
 *   const r = await curlImpersonateGet("https://challonge.com/fr/B_TS4/log");
 *   if (r.status === 200) console.log(r.body.length);
 *
 * @example  // with same-origin redirect policy
 *   const r = await curlImpersonateGet(url, { safeRedirects: true });
 *   if ("type" in r && r.type === "redirect") console.warn("cross-host:", r.redirectUrl);
 */
export async function curlImpersonateGet(
  url: string,
  options: CurlImpersonateOptions = {},
): Promise<CurlImpersonateResponse | RedirectInfo> {
  // ── Validation + http→https upgrade ──────────────────────────────────────
  const v = validateURL(url);
  if (!v.ok) throw new CurlImpersonateError(`Invalid URL: ${v.reason}`);
  const upgraded = upgradeToHttps(url);

  const opts = resolveOptions(options);
  const cacheKey = `${opts.profile}|${upgraded}`;

  // ── Cache ────────────────────────────────────────────────────────────────
  if (opts.cacheEnabled) {
    const hit = RESPONSE_CACHE.get(cacheKey);
    if (hit) {
      opts.log(`✓ cache hit: ${upgraded}`);
      return {
        status: hit.status,
        finalUrl: hit.finalUrl,
        headers: hit.headers,
        body: hit.body,
        timeSec: hit.timeSec,
        fromCache: true,
      };
    }
  }

  const bin = join(opts.binDir, `curl_${opts.profile}`);
  if (!existsSync(/* turbopackIgnore: true */ bin)) {
    throw new CurlImpersonateError(
      `Profile binary not found: ${bin}. Available profiles in ${opts.binDir}.`,
    );
  }

  // When safeRedirects is on, we deliberately disable curl's auto-follow and
  // handle the redirect chain ourselves, allowing us to stop at the first
  // cross-host hop.
  const useCurlAutoFollow = opts.followRedirects && !opts.safeRedirects;

  const args = [
    "-sS",
    "-w",
    "\n%{http_code}|%{url_effective}|%{time_total}",
    "--max-time",
    String(opts.timeoutSec),
    "--max-filesize",
    String(MAX_HTTP_CONTENT_LENGTH),
    "-D",
    "-",
  ];
  if (useCurlAutoFollow) {
    args.push("-L", "--max-redirs", String(opts.maxRedirects));
  }
  if (opts.cookieHeader) args.push("-b", opts.cookieHeader);
  for (const [k, v] of Object.entries(opts.extraHeaders)) {
    args.push("-H", `${k}: ${v}`);
  }

  let currentUrl = upgraded;
  let hops = 0;

  // ── Loop: only iterates >1 when safeRedirects is on ─────────────────────
  while (true) {
    args.push(currentUrl);
    opts.log(`→ ${opts.profile} GET ${currentUrl}${hops ? ` (hop ${hops})` : ""}`);

    const { stdout, stderr, code } = await spawnCurl(bin, args);
    args.pop(); // pop the URL for potential re-use on the next hop

    if (code !== 0) {
      // curl exit codes: 56 = max-filesize hit, 28 = timeout, etc.
      throw new CurlImpersonateError(
        `curl_${opts.profile} exited ${code}: ${stderr.trim().slice(0, 300)}`,
      );
    }

    const parsed = parseCurlOutput(new TextDecoder().decode(stdout));

    // Manual same-origin redirect handling
    if (
      opts.safeRedirects &&
      [301, 302, 303, 307, 308].includes(parsed.status) &&
      parsed.headers.location
    ) {
      const next = new URL(parsed.headers.location, currentUrl).toString();
      if (!isPermittedRedirect(currentUrl, next)) {
        return {
          type: "redirect",
          originalUrl: currentUrl,
          redirectUrl: next,
          statusCode: parsed.status,
        };
      }
      hops++;
      if (hops > opts.maxRedirects) {
        throw new CurlImpersonateError(
          `Too many redirects (>${opts.maxRedirects}) starting from ${upgraded}`,
        );
      }
      currentUrl = next;
      continue;
    }

    // Detect bytes for cache accounting; coerce to UTF-8 byte length.
    const bodyBytes = new TextEncoder().encode(parsed.body).byteLength;
    const finalUrl = parsed.finalUrl || currentUrl;

    if (opts.cacheEnabled && parsed.status >= 200 && parsed.status < 400) {
      RESPONSE_CACHE.set(cacheKey, {
        status: parsed.status,
        finalUrl,
        headers: parsed.headers,
        body: parsed.body,
        timeSec: parsed.timeSec,
        bytes: bodyBytes,
      });
    }

    return {
      status: parsed.status,
      finalUrl,
      headers: parsed.headers,
      body: parsed.body,
      timeSec: parsed.timeSec,
      fromCache: false,
    };
  }
}

/** Type guard for the redirect-info return shape. */
export function isRedirectInfo(r: CurlImpersonateResponse | RedirectInfo): r is RedirectInfo {
  return "type" in r && r.type === "redirect";
}
