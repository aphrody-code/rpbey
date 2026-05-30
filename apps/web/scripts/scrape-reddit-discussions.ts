#!/usr/bin/env bun
/**
 * scrape-reddit-discussions.ts — crawler Reddit Beyblade AUTHENTIFIÉ → corpus de recherche.
 *
 * L'IP datacenter du VPS est bloquée pour Reddit ANONYME (403 / "blocked by
 * network security" sur tous les transports, y compris Tor+navigateur car la vérif
 * PoW reste non résolue). MAIS une requête **authentifiée** (cookie `reddit_session`
 * d'un compte connecté) passe normalement — comme le crawler X. Vérifié live :
 * `top.json?t=year` authentifié → HTTP 200 + vrais posts.
 *
 * Session : cookie jar Netscape dans `~/.aphrody/reddit-session-cookies.txt` (SECRET,
 * hors repo, jamais committé) — override via `REDDIT_COOKIE_FILE`. Le fetch shell-out
 * `curl -b <jar>` (curl gère le format Netscape ; le secret ne transite pas par argv).
 *
 * Sortie : `data/reddit-discussions.json` au shape `RedditDiscussionSchema`
 * (`@rpbey/api-contract`), indexé par `global-search.ts` `loadRedditDiscussions`
 * (catégorie "discussion", source "reddit"). Non-destructif : 0 post -> exit 2 sans écraser.
 *
 *   bun apps/web/scripts/scrape-reddit-discussions.ts
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { RedditDiscussionSchema } from "@rpbey/api-contract";

const COOKIE_FILE =
  process.env.REDDIT_COOKIE_FILE ?? join(homedir(), ".aphrody", "reddit-session-cookies.txt");
const OUT = join(import.meta.dir, "..", "data", "reddit-discussions.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SUBREDDITS = ["BeybladeX", "Beyblade"];
const SORTS: Array<{ path: string; query: string }> = [
  { path: "top", query: "t=year&limit=100" },
  { path: "hot", query: "limit=100" },
];
const PAGES_PER_SORT = 3;
const CAP = 500;
const COMMENT_ENRICH_TOP = 80; // enrichit les N meilleurs posts sans selftext avec leur top-commentaire

interface RedditChild {
  kind: string;
  data: {
    id: string;
    name: string;
    subreddit: string;
    author: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    permalink: string;
    created_utc: number;
    stickied: boolean;
    removed_by_category?: string | null;
  };
}

/** Fetch authentifié via curl + cookie jar (le secret reste dans le fichier, pas dans argv). */
async function fetchJson(url: string): Promise<unknown | null> {
  const proc = Bun.spawn(
    [
      "curl",
      "-s",
      "--max-time",
      "30",
      "-b",
      COOKIE_FILE,
      "-A",
      UA,
      "-H",
      "Accept: application/json",
      url,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  if (!out || out.trimStart().startsWith("<")) return null; // page HTML = blocage/login
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function crawlListing(
  sub: string,
  sort: { path: string; query: string },
): Promise<RedditChild[]> {
  const all: RedditChild[] = [];
  let after: string | null = null;
  for (let page = 0; page < PAGES_PER_SORT; page++) {
    const afterParam = after ? `&after=${after}&count=${all.length}` : "";
    const url = `https://www.reddit.com/r/${sub}/${sort.path}.json?${sort.query}${afterParam}&raw_json=1`;
    const json = (await fetchJson(url)) as {
      data?: { children?: RedditChild[]; after?: string | null };
    } | null;
    const children = json?.data?.children ?? [];
    if (children.length === 0) break;
    all.push(...children);
    after = json?.data?.after ?? null;
    if (!after) break;
    await sleep(600);
  }
  return all;
}

/** Top-commentaire d'un post (texte additionnel pour les posts média sans selftext). */
async function topComment(sub: string, postId: string): Promise<string> {
  const url = `https://www.reddit.com/r/${sub}/comments/${postId}.json?sort=top&limit=1&raw_json=1`;
  const json = (await fetchJson(url)) as Array<{ data?: { children?: RedditChild[] } }> | null;
  const c = Array.isArray(json) ? json[1]?.data?.children?.[0]?.data : undefined;
  const body = (c as { body?: string } | undefined)?.body ?? "";
  return typeof body === "string" && body !== "[removed]" && body !== "[deleted]"
    ? body.trim()
    : "";
}

function clean(s: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

async function main() {
  if (!(await Bun.file(COOKIE_FILE).exists())) {
    console.error(
      `[reddit] cookie jar absent : ${COOKIE_FILE} — session requise. Abandon (non-destructif).`,
    );
    process.exit(2);
  }

  const byId = new Map<string, RedditChild["data"]>();
  for (const sub of SUBREDDITS) {
    for (const sort of SORTS) {
      const children = await crawlListing(sub, sort);
      for (const ch of children) {
        if (ch.kind !== "t3") continue;
        const d = ch.data;
        if (d.stickied || d.removed_by_category) continue;
        if (!d.author || d.author === "[deleted]") continue;
        if (!byId.has(d.id)) byId.set(d.id, d);
      }
      console.log(`[reddit] r/${sub}/${sort.path}: cumul ${byId.size} posts uniques`);
    }
  }

  if (byId.size === 0) {
    console.error(
      "[reddit] 0 post récupéré (session expirée / bloqué ?). Fichier préservé, exit 2.",
    );
    process.exit(2);
  }

  const posts = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, CAP);

  // Enrichissement top-commentaire pour les meilleurs posts sans selftext (média/lien).
  let enriched = 0;
  for (const d of posts) {
    if (enriched >= COMMENT_ENRICH_TOP) break;
    if (clean(d.selftext).length >= 40) continue;
    const c = await topComment(d.subreddit, d.id);
    if (c) {
      (d as { _topComment?: string })._topComment = c;
      enriched++;
      await sleep(400);
    }
  }

  const discussions = posts.map((d) => {
    const body = clean(d.selftext) || clean((d as { _topComment?: string })._topComment ?? "");
    return {
      id: d.name, // fullname t3_xxx
      subreddit: d.subreddit,
      author: `u/${d.author}`,
      title: clean(d.title),
      text: body,
      score: d.score,
      comments: d.num_comments,
      url: `https://www.reddit.com${d.permalink}`,
      createdAt: new Date(d.created_utc * 1000).toISOString(),
    };
  });

  // Validation Zod (garantit le contrat consommé par global-search).
  const valid = discussions.filter((x) => RedditDiscussionSchema.safeParse(x).success);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "reddit",
    count: valid.length,
    discussions: valid,
  };
  await Bun.write(OUT, JSON.stringify(payload, null, 2));
  const bySub: Record<string, number> = {};
  for (const d of valid) bySub[d.subreddit] = (bySub[d.subreddit] ?? 0) + 1;
  console.log(
    `[reddit] OK — ${valid.length} discussions écrites (${enriched} enrichies top-comment) → ${OUT}`,
  );
  console.log("[reddit] par subreddit :", JSON.stringify(bySub));
}

await main();
