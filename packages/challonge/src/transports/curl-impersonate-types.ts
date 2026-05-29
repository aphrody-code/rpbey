/**
 * Shared types and pure utility functions for the curl-impersonate transport.
 *
 * This module is imported by both the legacy facade (curl-impersonate.ts) and
 * the new BxcTransport (bxc.ts) to keep a single source of truth.
 */

// ─── Profile type ──────────────────────────────────────────────────────────────

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

// ─── Response types ────────────────────────────────────────────────────────────

export interface CurlImpersonateOptions {
  /** Browser/version profile. Default `chrome131`. */
  profile?: CurlImpersonateProfile;
  /** Path to the curl-impersonate install directory (legacy, ignored by BxcTransport). */
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
   * being followed.
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

// ─── URL helpers ───────────────────────────────────────────────────────────────

const MAX_URL_LENGTH = 2000;

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

/** Type guard for the redirect-info return shape. */
export function isRedirectInfo(r: CurlImpersonateResponse | RedirectInfo): r is RedirectInfo {
  return "type" in r && r.type === "redirect";
}
