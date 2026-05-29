/**
 * Challonge user-profile parser (pure, bundlable).
 *
 * Parses the server-rendered `/users/{username}` profile page into a
 * `ScrapedUserProfile`. ZERO bxc / transport / FFI imports — input is a raw
 * HTML string, output is a plain typed object. Safe to bundle (Next.js, web).
 *
 * Calibrated against `tests/fixtures/user_profile.html` (captured offline,
 * user `Vincent___`). The Challonge "Overview" page exposes:
 *
 *   - displayName  → `<h3 class='name mini-badge-item'><span class='text'>…</span>`
 *   - avatarUrl    → `.profile-banner-avatar` `data-default-image` (Gravatar /
 *                    Challonge CDN fallback), or `data-image-src` when the user
 *                    uploaded a real avatar.
 *   - memberSince  → `<li class='item'>Member since October 2025</li>`
 *   - medals       → the `<h3 class='data'>N</h3>` inside each `stat-card`
 *                    whose `rank-tile` carries `chl-icon -gold|-silver|-bronze`
 *                    (Top Finishes block).
 *   - username     → recovered from the canonical hreflang
 *                    `<link … href='…/users/{Username}' …>` tags (preserves the
 *                    original casing), or the caller-supplied `opts.username`.
 *
 * The "Overview" tab does NOT render a per-tournament history list with
 * placements/dates — that lives on the `/users/{username}/tournaments` tab.
 * `tournamentHistory` is therefore parsed defensively: if a standard Challonge
 * tournament table/list is present it is extracted, otherwise it is `[]`.
 *
 * Every field is best-effort: a missing marker yields `null` (or `[]` /
 * an all-zero medal tally), never a throw.
 *
 * @module extractors/stores/user-profile
 */

import { type ScrapedUserProfile } from "../../types";

const ENTITY_DECODE: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&#x2f;": "/",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:quot|apos|amp|lt|gt|nbsp|#39|#x27|#x2[Ff]);/g,
    (m) => ENTITY_DECODE[m] ?? m,
  );
}

/** Strip all tags, collapse whitespace, decode entities. */
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a protocol-relative URL (`//host/…`) to `https://host/…`. */
function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  const u = decodeEntities(url).trim();
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  return u;
}

/**
 * Recover the canonical (original-cased) username from the page.
 *
 * The hreflang `<link …>` block carries the username verbatim:
 *   <link href='https://challonge.com/fr/users/Vincent___' hreflang='fr' …>
 */
function usernameFromLinks(html: string): string | null {
  const m = /href=['"]https?:\/\/challonge\.com\/(?:[a-z]{2}\/)?users\/([^'"/?]+)['"]/i.exec(html);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

/** Display name from the profile banner header. */
function parseDisplayName(html: string): string | null {
  // <h3 class='name mini-badge-item'>\n<span class='text'>Vincent___</span>
  const m =
    /<h3[^>]*class=['"][^'"]*\bname\b[^'"]*['"][^>]*>[\s\S]*?<span[^>]*class=['"][^'"]*\btext\b[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i.exec(
      html,
    );
  const v = m ? stripTags(m[1] ?? "") : "";
  return v || null;
}

/** Avatar URL — prefers an uploaded image, falls back to the default/Gravatar. */
function parseAvatarUrl(html: string): string | null {
  const banner =
    /<[a-zA-Z][^>]*class=['"][^'"]*profile-banner-avatar[^'"]*['"][^>]*>/i.exec(html)?.[0] ?? "";
  if (banner) {
    const src =
      /data-image-src=['"]([^'"]+)['"]/i.exec(banner)?.[1] ??
      /data-default-image=['"]([^'"]+)['"]/i.exec(banner)?.[1] ??
      null;
    const abs = absoluteUrl(src);
    if (abs) return abs;
  }
  // Fallback: first portrait/avatar <img>.
  const img = /<img[^>]*class=['"][^'"]*(?:portrait|avatar)[^'"]*['"][^>]*>/i.exec(html)?.[0] ?? "";
  return absoluteUrl(/src=['"]([^'"]+)['"]/i.exec(img)?.[1] ?? null);
}

/** "Member since …" label from the banner meta list. */
function parseMemberSince(html: string): string | null {
  const m = /Member since\s+([^<]+)</i.exec(html);
  return m?.[1] ? stripTags(m[1]) : null;
}

/** Optional free-text location, if rendered in the header meta. */
function parseLocation(html: string): string | null {
  const m = /<li[^>]*class=['"][^'"]*\blocation\b[^'"]*['"][^>]*>([\s\S]*?)<\/li>/i.exec(html);
  const v = m ? stripTags(m[1] ?? "") : "";
  return v || null;
}

/** Optional bio / "about" blurb. */
function parseBio(html: string): string | null {
  const m =
    /<(?:p|div)[^>]*class=['"][^'"]*\b(?:bio|about|profile-bio)\b[^'"]*['"][^>]*>([\s\S]*?)<\/(?:p|div)>/i.exec(
      html,
    );
  const v = m ? stripTags(m[1] ?? "") : "";
  return v || null;
}

/**
 * Medal tally from the "Top Finishes" block.
 *
 * Each medal is a `stat-card` whose `rank-tile` holds a trophy icon
 * (`chl-icon -gold|-silver|-bronze`) and whose body shows the count in
 * `<h3 class='data'>N</h3>`.
 */
function parseMedals(html: string): {
  gold: number;
  silver: number;
  bronze: number;
} {
  const medals = { gold: 0, silver: 0, bronze: 0 };
  const cardRe =
    /<div[^>]*class=['"][^'"]*\bstat-card\b[^'"]*['"][^>]*>([\s\S]*?)(?=<div[^>]*class=['"][^'"]*\bstat-card\b|<\/div>\s*<\/div>\s*<\/div>)/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const card = m[1] ?? "";
    let kind: "gold" | "silver" | "bronze" | null = null;
    if (/chl-icon\s+-gold/i.test(card)) kind = "gold";
    else if (/chl-icon\s+-silver/i.test(card)) kind = "silver";
    else if (/chl-icon\s+-bronze/i.test(card)) kind = "bronze";
    if (!kind) continue;
    const dataM = /<h3[^>]*class=['"][^'"]*\bdata\b[^'"]*['"][^>]*>\s*([\d,]+)\s*<\/h3>/i.exec(
      card,
    );
    const n = dataM ? parseInt((dataM[1] ?? "0").replace(/,/g, ""), 10) : 0;
    medals[kind] = Number.isFinite(n) ? n : 0;
  }
  return medals;
}

/**
 * Defensive tournament-history parse (the `/users/{username}/tournaments` tab
 * layout). On the Overview page no such table exists → returns `[]`.
 *
 * Looks for rows linking to a tournament permalink and, when present, lifts a
 * placement (`Nth` / final-rank cell) and a date cell alongside the name.
 */
function parseTournamentHistory(html: string): ScrapedUserProfile["tournamentHistory"] {
  const out: NonNullable<ScrapedUserProfile["tournamentHistory"]> = [];
  // Each tournament row carries a link to a tournament page (not /users, not
  // /communities). We accept rows inside a "tournament" list/table.
  const rowRe =
    /<tr[^>]*>([\s\S]*?)<\/tr>|<a[^>]+class=['"][^'"]*tournament[^'"]*['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const block = m[1] ?? m[0] ?? "";
    const linkM =
      /<a[^>]+href=['"]https?:\/\/challonge\.com\/([^'"?#]+)['"][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!linkM) continue;
    const path = decodeEntities(linkM[1] ?? "");
    // Skip user/community/static links — keep only tournament permalinks.
    if (
      /^[a-z]{2}\//i.test(path) ||
      /^(users|communities|tournaments\/|settings|pricing)/i.test(path)
    )
      continue;
    if (path.includes("/")) continue; // tournament permalinks are top-level slugs
    const name = stripTags(linkM[2] ?? "");
    if (!name) continue;
    const slug = path || null;
    const placeM = />\s*(\d+)(?:st|nd|rd|th)\b/i.exec(block);
    const placement = placeM?.[1] ? parseInt(placeM[1], 10) : null;
    const dateM =
      /<time[^>]*datetime=['"]([^'"]+)['"]/i.exec(block)?.[1] ??
      /(\d{4}-\d{2}-\d{2})/.exec(block)?.[1] ??
      null;
    const gameM = /data-game(?:-name)?=['"]([^'"]+)['"]/i.exec(block)?.[1] ?? null;
    out.push({
      name,
      slug,
      placement,
      date: dateM,
      gameName: gameM ? stripTags(gameM) : null,
    });
  }
  return out;
}

/**
 * Parse a Challonge `/users/{username}` profile page into a
 * `ScrapedUserProfile`. Pure (no I/O), defensive (missing fields → null/[]).
 *
 * @param html  Raw HTML of the profile page.
 * @param opts  Optional `{ username }` to seed the canonical handle when it
 *              cannot be recovered from the page markup.
 */
export function parseUserProfile(html: string, opts?: { username?: string }): ScrapedUserProfile {
  const displayName = parseDisplayName(html);
  const fromLinks = usernameFromLinks(html);
  const username = (opts?.username || fromLinks || displayName || "").trim();
  const profileUrl = username
    ? `https://challonge.com/users/${username}`
    : "https://challonge.com/";

  return {
    username,
    displayName,
    avatarUrl: parseAvatarUrl(html),
    location: parseLocation(html),
    bio: parseBio(html),
    memberSince: parseMemberSince(html),
    medals: parseMedals(html),
    tournamentHistory: parseTournamentHistory(html),
    profileUrl,
  };
}
