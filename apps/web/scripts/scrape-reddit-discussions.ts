#!/usr/bin/env bun
/**
 * Crawler Reddit Beyblade → data/reddit-discussions.json.
 *
 * Crawle r/Beyblade + r/BeybladeX (top de l'année + hot) via les listings JSON
 * non-authentifiés de Reddit, extrait les posts (titre + selftext) et le meilleur
 * commentaire de chaque post, déduplique, exclut les contenus supprimés
 * ([removed]/[deleted]), trie par score et garde les ~300-500 meilleures
 * discussions. Sortie typée (RedditDiscussionSchema) + écriture non-destructive
 * (un blocage ne doit jamais écraser des données réelles par du vide).
 *
 * Transports tentés DANS L'ORDRE (le premier qui PASSE gagne) :
 *   1. curl-impersonate (TLS-fingerprint Chrome) — le + rapide, mais pas de proxy.
 *   2. moteur bxc Chrome (profil `stealth`) — accepte un proxy via REDDIT_PROXY /
 *      ALL_PROXY (le moteur lit l'env), seul recours pour contourner un blocage IP.
 *
 * Réalité VPS (mesuré 2026-05-29) : l'IP datacenter du VPS est bloquée par la
 * "network security" de Reddit — `www.reddit.com`/`oauth.reddit.com` renvoient 403
 * ou la page « You've been blocked by network security » même au vrai Chrome
 * stealth, et curl-impersonate (TLS parfait) est aussi 403. Ce n'est PAS un
 * blocage TLS/UA mais un blocage IP réseau. Le crawler reste fonctionnel dès
 * qu'un transport passe : SOCKS résidentiel up (127.0.0.1:1080), un proxy
 * résidentiel (REDDIT_PROXY=socks5://… ou http://…), ou une IP non bloquée.
 *
 * Usage :
 *   bun scripts/scrape-reddit-discussions.ts
 *   REDDIT_PROXY=socks5://127.0.0.1:1080 bun scripts/scrape-reddit-discussions.ts
 *
 * Bun only.
 */
process.env.LIBCURL_IMPERSONATE_PATH ??=
  "/home/ubuntu/bxc/vendor/curl-impersonate/libcurl-impersonate.so";
if (!process.env.BXC_CHROME_BIN) process.env.BXC_CHROME_BIN = "/usr/local/bin/chromium";

import { join } from "node:path";
import { RedditDiscussionSchema } from "@rpbey/api-contract";
import { ImpersonatedClient } from "@aphrody-code/bxc/ffi/curl-impersonate";
import { Browser } from "@aphrody-code/bxc/browser";
import { validateRecords } from "./lib/ghost-scraper.ts";

const SUBREDDITS = ["Beyblade", "BeybladeX"] as const;
const LISTINGS = [
  { sort: "top", qs: "t=year&limit=100" },
  { sort: "hot", qs: "limit=100" },
] as const;
const MAX_DISCUSSIONS = 500;
const TOP_COMMENTS_PER_POST = 1; // meilleur commentaire injecté dans `text` si le post n'a pas de selftext
const PROXY = process.env.REDDIT_PROXY ?? process.env.ALL_PROXY ?? "";

const UA = "rpbey-beyblade-search/1.0 (+https://rpbey.fr)";

// ── Types des listings JSON Reddit (sous-ensemble utile). ──
interface RedditThing<T> {
  kind: string;
  data: T;
}
interface RedditListing<T> {
  kind: "Listing";
  data: { children: RedditThing<T>[]; after: string | null };
}
interface RedditPostData {
  name: string; // fullname t3_xxx
  id: string;
  subreddit: string;
  author: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  stickied?: boolean;
  removed_by_category?: string | null;
}
interface RedditCommentData {
  body: string;
  author: string;
  score: number;
}

const REMOVED = new Set(["[removed]", "[deleted]", "[ Removed by Reddit ]", ""]);

function isBlockedHtml(s: string): boolean {
  const head = s.slice(0, 4000).toLowerCase();
  return (
    head.includes("blocked by network") ||
    head.includes("whoa there") ||
    head.includes("<!doctype html") ||
    head.includes("<html")
  );
}

// ── Transport 1 : curl-impersonate (pas de proxy). ──
async function fetchJsonImpersonate(url: string): Promise<unknown | { __blocked: number }> {
  const client = new ImpersonatedClient({ profile: "chrome131", timeoutMs: 25_000 });
  try {
    const res = await client.fetch(url, { headers: { "User-Agent": UA } });
    const body = await res.text();
    if (res.status >= 400 || isBlockedHtml(body)) return { __blocked: res.status };
    try {
      return JSON.parse(body);
    } catch {
      return { __blocked: res.status };
    }
  } catch {
    return { __blocked: -1 };
  } finally {
    client.close?.();
  }
}

// ── Transport 2 : moteur Chrome stealth (accepte un proxy via l'env du moteur). ──
async function fetchJsonChrome(url: string): Promise<unknown | { __blocked: number }> {
  const page = await Browser.newPage({
    profile: "stealth" as never,
    spawnOpts: PROXY ? ({ proxy: PROXY } as never) : undefined,
  });
  try {
    const nav = await page.goto(url, { timeoutMs: 35_000 });
    await Bun.sleep(2_500);
    const html = await page.content();
    // Chrome rend le JSON dans un <pre> ; on récupère le texte brut.
    const m = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    const raw = m ? decodeEntities(m[1]) : html;
    if (isBlockedHtml(raw) || (nav?.status ?? 0) >= 400) return { __blocked: nav?.status ?? -1 };
    try {
      return JSON.parse(raw);
    } catch {
      return { __blocked: nav?.status ?? -1 };
    }
  } catch {
    return { __blocked: -1 };
  } finally {
    await page.close?.();
  }
}

function decodeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

type Transport = (url: string) => Promise<unknown | { __blocked: number }>;
const TRANSPORTS: { name: string; fn: Transport }[] = [
  { name: "curl-impersonate", fn: fetchJsonImpersonate },
  { name: "chrome-stealth", fn: fetchJsonChrome },
];

let activeTransport: Transport | null = null;
let activeName = "";

/** Sélectionne (une fois) le premier transport qui passe le blocage, puis le réutilise. */
async function fetchJson(url: string): Promise<unknown | null> {
  if (activeTransport) {
    const r = await activeTransport(url);
    if (r && typeof r === "object" && "__blocked" in r) {
      console.warn(`  [${activeName}] bloqué (${(r as { __blocked: number }).__blocked}) : ${url}`);
      return null;
    }
    return r;
  }
  for (const t of TRANSPORTS) {
    const r = await t.fn(url);
    if (r && typeof r === "object" && "__blocked" in r) {
      console.warn(`  [${t.name}] bloqué (${(r as { __blocked: number }).__blocked}) : ${url}`);
      continue;
    }
    activeTransport = t.fn;
    activeName = t.name;
    console.log(`  ✓ transport actif : ${t.name}${PROXY ? ` (proxy ${PROXY})` : ""}`);
    return r;
  }
  return null;
}

function isListing(x: unknown): x is RedditListing<RedditPostData> {
  return (
    !!x &&
    typeof x === "object" &&
    (x as RedditListing<unknown>).kind === "Listing" &&
    Array.isArray((x as RedditListing<unknown>).data?.children)
  );
}

/** Récupère le meilleur commentaire (non supprimé) d'un post via /comments/<id>.json. */
async function fetchTopComment(subreddit: string, postId: string): Promise<string> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=${TOP_COMMENTS_PER_POST}&sort=top&raw_json=1`;
  const data = await fetchJson(url);
  if (!Array.isArray(data) || data.length < 2) return "";
  const commentListing = data[1] as RedditListing<RedditCommentData>;
  if (!isListing(commentListing)) return "";
  for (const c of (commentListing as RedditListing<RedditCommentData>).data.children) {
    if (c.kind !== "t1") continue;
    const body = (c.data as RedditCommentData).body?.trim() ?? "";
    if (!REMOVED.has(body) && body.length > 0) return body;
  }
  return "";
}

async function main() {
  console.log("Crawl Reddit Beyblade (r/Beyblade + r/BeybladeX)…");
  const seen = new Set<string>();
  const posts = new Map<string, RedditPostData>();

  for (const sub of SUBREDDITS) {
    for (const { sort, qs } of LISTINGS) {
      const url = `https://www.reddit.com/r/${sub}/${sort}.json?${qs}&raw_json=1`;
      const data = await fetchJson(url);
      if (!isListing(data)) {
        console.warn(`  r/${sub}/${sort} : aucune donnée exploitable`);
        continue;
      }
      let n = 0;
      for (const child of data.data.children) {
        if (child.kind !== "t3") continue;
        const p = child.data;
        if (p.stickied) continue;
        if (seen.has(p.id)) continue;
        const selftext = (p.selftext ?? "").trim();
        if (REMOVED.has((p.title ?? "").trim()) && REMOVED.has(selftext)) continue;
        if (p.removed_by_category) continue;
        if (REMOVED.has((p.author ?? "").trim())) continue;
        seen.add(p.id);
        posts.set(p.id, p);
        n++;
      }
      console.log(`  r/${sub}/${sort} : +${n} posts (cumul ${posts.size})`);
      await Bun.sleep(1_200); // courtoisie / rate-limit
    }
  }

  if (posts.size === 0) {
    console.error(
      "\n✗ 0 post récupéré — tous les transports sont bloqués (blocage IP datacenter Reddit).",
    );
    console.error(
      "  Contournements : REDDIT_PROXY=socks5://… (proxy résidentiel) ou relancer depuis une IP non bloquée.",
    );
    console.error("  data/reddit-discussions.json PRÉSERVÉ (non-destructif).");
    await Browser.close?.();
    process.exit(2);
  }

  // Tri par score décroissant, on cape avant d'aller chercher les commentaires.
  const ranked = [...posts.values()].sort((a, b) => b.score - a.score).slice(0, MAX_DISCUSSIONS);

  console.log(`\nEnrichissement commentaires (posts sans selftext) sur ${ranked.length} posts…`);
  const raw: unknown[] = [];
  let commentFetches = 0;
  for (const p of ranked) {
    let text = (p.selftext ?? "").trim();
    if (!text && commentFetches < MAX_DISCUSSIONS) {
      text = await fetchTopComment(p.subreddit, p.id);
      commentFetches++;
      await Bun.sleep(800);
    }
    raw.push({
      id: p.name || `t3_${p.id}`,
      subreddit: p.subreddit,
      author: `u/${p.author}`,
      title: (p.title ?? "").trim(),
      text,
      score: Math.round(p.score ?? 0),
      comments: Math.max(0, Math.round(p.num_comments ?? 0)),
      url: `https://www.reddit.com${p.permalink}`,
      createdAt: new Date((p.created_utc ?? 0) * 1000).toISOString(),
    });
  }

  const report = validateRecords(raw, RedditDiscussionSchema);
  if (report.invalid > 0) {
    console.warn(`  ⚠ ${report.invalid} rejeté(s) par le schéma : ${report.errors.join(" · ")}`);
  }

  await Browser.close?.();

  if (report.valid.length === 0) {
    console.error("\n✗ 0 discussion valide. data/reddit-discussions.json PRÉSERVÉ.");
    process.exit(2);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "reddit",
    count: report.valid.length,
    discussions: report.valid,
  };

  const out = join(import.meta.dir, "..", "data", "reddit-discussions.json");
  const tmp = `${out}.tmp`;
  await Bun.write(tmp, JSON.stringify(payload, null, 2));
  await Bun.write(out, Bun.file(tmp));
  await Bun.file(tmp)
    .unlink?.()
    .catch(() => {});

  console.log(`\n✓ ${report.valid.length} discussions Reddit (transport ${activeName}) → ${out}`);
}

await main();
