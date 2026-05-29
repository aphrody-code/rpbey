/**
 * Organisation landing-page parser (pure, bundlable).
 *
 * Parses an organisation page on Challonge into a {@link ScrapedOrg}. Two page
 * shapes are handled by the same function:
 *
 *   1. **Org index** — a true `<subdomain>.challonge.com` (or
 *      `challonge.com/<subdomain>`) landing that lists the org's public
 *      tournaments as anchor cards. Each card yields a `tournaments[]` entry
 *      (name, slug, url, plus best-effort state/game/participants/start).
 *
 *   2. **Hosted-tournament page** — a single tournament served under an org
 *      (e.g. `challonge.com/fr/B_TS4`, hosted by an org). No tournament list is
 *      rendered, but the page still carries org header metadata (display name in
 *      the og:description "hosted by …" clause, logo via the org `og:image`
 *      asset path) and the tournament itself, which is surfaced from the embedded
 *      `_initialStoreState['TournamentStore']` (and/or og:title).
 *
 * Pure: ZERO bxc / transport / FFI imports. Input is a raw HTML string; output
 * is a plain {@link ScrapedOrg}. Reuses {@link parseInitialStoreState} (also
 * pure) when a hydration store is present. Universally bundlable (Next.js).
 *
 * @module extractors/stores/org-landing
 */

import { type ScrapedOrg } from "../../types";
import { parseInitialStoreState } from "../store-state";

// ---------------------------------------------------------------------------
// HTML helpers (local, pure)
// ---------------------------------------------------------------------------

/** Decode the handful of HTML entities Challonge emits in attribute/text. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip tags and collapse whitespace from an HTML fragment. */
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read a `<meta>` content value by property/name. Tolerates attribute order
 * (`content` before or after `property`) and single/double quotes.
 */
function metaContent(html: string, key: string): string | null {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // content="…" … property="key"
  const a = new RegExp(
    `<meta[^>]+content=['"]([^'"]*)['"][^>]*(?:property|name)=['"]${esc}['"]`,
    "i",
  ).exec(html);
  if (a?.[1] != null) return decodeEntities(a[1]);
  // property="key" … content="…"
  const b = new RegExp(
    `<meta[^>]+(?:property|name)=['"]${esc}['"][^>]*content=['"]([^'"]*)['"]`,
    "i",
  ).exec(html);
  if (b?.[1] != null) return decodeEntities(b[1]);
  return null;
}

/**
 * Derive the org subdomain from a Challonge URL or host.
 *  - `acme.challonge.com[/…]` → `acme`
 *  - `challonge.com/<sub>[/…]` (custom-domain orgs) → `<sub>`
 * Returns `null` when nothing usable is present.
 */
function subdomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = /^https?:\/\/([a-z0-9_-]+)\.challonge\.com/i.exec(url);
  if (host && host[1] && host[1].toLowerCase() !== "www" && host[1].toLowerCase() !== "challonge") {
    return host[1];
  }
  return null;
}

const ORG_NAME_STOPWORDS = /\b(a challonge community|challonge|community)\b/gi;

/**
 * Pull the org display name out of an og:description such as
 * "Explore this tournament hosted by RPB, a Challonge Community".
 */
function orgNameFromDescription(desc: string | null): string | null {
  if (!desc) return null;
  const m = /hosted by\s+(.+?)(?:,|\.|\s+on\b|$)/i.exec(desc);
  if (!m?.[1]) return null;
  const name = m[1]
    .replace(ORG_NAME_STOPWORDS, "")
    .replace(/[,\s]+$/, "")
    .trim();
  return name.length > 0 ? name : null;
}

// ---------------------------------------------------------------------------
// Tournament-list extraction (org index shape)
// ---------------------------------------------------------------------------

interface RawTournamentLink {
  name: string;
  slug: string;
  url: string;
}

/**
 * Collect tournament anchors from an org index page. Matches anchors pointing at
 * `<sub>.challonge.com/<slug>` or `challonge.com/[locale/]<slug>` and keeps the
 * link text as the name. Skips known static/footer slugs and dedupes by slug.
 */
function extractTournamentLinks(html: string, subdomain: string | null): RawTournamentLink[] {
  const STATIC = new Set([
    "about",
    "contact",
    "partners",
    "pricing",
    "privacy_policy",
    "terms_of_service",
    "organizedplay",
    "tournaments",
    "login",
    "signup",
    "users",
    "sign_in",
    "sign_up",
    "settings",
  ]);
  const out: RawTournamentLink[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const rawHref = decodeEntities(m[1] ?? "");
    const text = stripTags(m[2] ?? "");
    if (!text) continue;

    let slug: string | null = null;
    let url: string | null = null;

    // <sub>.challonge.com/<slug>
    const subHost =
      /^https?:\/\/([a-z0-9_-]+)\.challonge\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?([A-Za-z0-9_-]+)\/?$/i.exec(
        rawHref,
      );
    if (
      subHost &&
      subHost[1] &&
      subHost[1].toLowerCase() !== "www" &&
      (!subdomain || subHost[1].toLowerCase() === subdomain.toLowerCase())
    ) {
      slug = subHost[2] ?? null;
      url = rawHref;
    } else {
      // challonge.com/[locale/]<slug>
      const flat =
        /^https?:\/\/challonge\.com\/(?:[a-z]{2}(?:[-_][A-Za-z]{2})?\/)?([A-Za-z0-9_-]+)\/?$/i.exec(
          rawHref,
        );
      if (flat?.[1]) {
        slug = flat[1];
        url = rawHref;
      }
    }

    if (!slug || !url) continue;
    if (STATIC.has(slug.toLowerCase())) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ name: text, slug, url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Single-tournament-page fallback (hosted-tournament shape)
// ---------------------------------------------------------------------------

/**
 * When the page is a single hosted tournament (no tournament list), surface that
 * one tournament from the embedded TournamentStore / og:* meta so the org is not
 * returned empty-handed.
 */
function tournamentFromStore(
  html: string,
  ogUrl: string | null,
  ogTitle: string | null,
): ScrapedOrg["tournaments"][number] | null {
  let store: Record<string, unknown> = {};
  try {
    store = parseInitialStoreState(html);
  } catch {
    store = {};
  }
  const tStore = store["TournamentStore"] as { tournament?: Record<string, unknown> } | undefined;
  const t = tStore?.tournament;

  const url = (typeof t?.["full_url"] === "string" ? (t["full_url"] as string) : null) ?? ogUrl;
  if (!url) return null;

  // slug = last path segment of the canonical url (locale-stripped)
  const slugMatch = /\/([A-Za-z0-9_-]+)\/?$/.exec(url.replace(/[?#].*$/, ""));
  const slug = slugMatch?.[1] ?? "";
  if (!slug) return null;

  const name =
    (typeof t?.["name"] === "string" && (t["name"] as string).trim().length > 0
      ? (t["name"] as string)
      : null) ??
    (ogTitle ? ogTitle.replace(/\s*-\s*Challonge\s*$/i, "").trim() : null) ??
    slug;

  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : null;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

  return {
    name,
    slug,
    url,
    state: str(t?.["state"]),
    gameName: str(t?.["game_name"]),
    participantsCount: num(t?.["participants_count"] ?? t?.["participant_count"]),
    startAt: str(t?.["started_at"] ?? t?.["start_at"]),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an organisation landing page into a {@link ScrapedOrg}.
 *
 * Handles both the org-index shape (lists tournaments) and the
 * hosted-tournament shape (single tournament + org header metadata). Always
 * returns a well-formed object; `tournaments` may be empty.
 *
 * @param html  Raw HTML of the org page.
 * @param opts  Optional overrides — `subdomain` pins the org subdomain when it
 *              cannot be inferred from the page URL/host.
 */
export function parseOrgLanding(html: string, opts?: { subdomain?: string }): ScrapedOrg {
  const ogUrl = metaContent(html, "og:url");
  const ogTitle = metaContent(html, "og:title");
  const ogDescription = metaContent(html, "og:description");
  const ogImage = metaContent(html, "og:image");
  const canonical =
    /<link[^>]+rel=['"]canonical['"][^>]*href=['"]([^'"]+)['"]/i.exec(html)?.[1] ??
    /<link[^>]+href=['"]([^'"]+)['"][^>]*rel=['"]canonical['"]/i.exec(html)?.[1] ??
    null;

  const subdomain = opts?.subdomain ?? subdomainFromUrl(ogUrl) ?? subdomainFromUrl(canonical) ?? "";

  const url = ogUrl ?? canonical ?? (subdomain ? `https://${subdomain}.challonge.com` : "");

  // Org display name: prefer the "hosted by …" clause, else a clean og:title.
  const name =
    orgNameFromDescription(ogDescription) ??
    (ogTitle ? ogTitle.replace(/\s*-\s*Challonge\s*$/i, "").trim() : null) ??
    (subdomain || null);

  // Logo: only an org-scoped asset counts (avoid leaking a tournament cover).
  const logoUrl =
    ogImage && /\/organizations\/images\//.test(ogImage) ? ogImage.replace(/&amp;/g, "&") : null;

  let tournaments: ScrapedOrg["tournaments"] = extractTournamentLinks(html, subdomain || null).map(
    (l) => ({
      name: l.name,
      slug: l.slug,
      url: l.url,
      state: null as string | null,
      gameName: null as string | null,
      participantsCount: null as number | null,
      startAt: null as string | null,
    }),
  );

  // Hosted-tournament fallback: no index list → surface the embedded tournament.
  if (tournaments.length === 0) {
    const single = tournamentFromStore(html, ogUrl ?? canonical, ogTitle);
    if (single) tournaments = [single];
  }

  return {
    subdomain,
    name,
    description: ogDescription ?? null,
    logoUrl,
    url,
    tournaments,
  };
}
