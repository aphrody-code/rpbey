// enrich-meta.ts — enrichit l'algo MÉTA Beyblade X avec des signaux communautaires/sociaux.
//
// Pour chaque blade compétitif de NOTRE base, agrège 3 sources :
//   1. X (Twitter)  — via @aphrody-code/x (SearchTimeline), engagement = likes + RT + quote.
//   2. Reddit       — session authentifiée (cookie jar), r/BeybladeX + r/Beyblade, score posts.
//   3. Web          — via bxc (Google Web Search), nb de hits + snippets de tier/usage.
//
// Sortie : apps/web/data/meta-enrichment.json (cf. mission §3).
// communityScore = combinaison min-max normalisée (engagement X + score Reddit + web hits).
//
// Rejouable. Bun-only (jamais node/npm/tsx). Sourcer l'env aphrody AVANT :
//   set -a; . /home/ubuntu/aphrody/.env; set +a
//   bun apps/web/scripts/enrich-meta.ts
//
// Flags env :
//   ENRICH_LIMIT=N        ne traiter que les N premières blades (debug)
//   ENRICH_SKIP_WEB=1      sauter la source web (si bxc indispo)
//   ENRICH_X_PER_BLADE=N   nb de tweets visés par blade (def 20)
//   ENRICH_DELAY_MS=N      délai inter-blade (def 4000) — borne le rate-limit X (~50 req/15min)

import { XSession, XClient } from "/home/ubuntu/aphrody/packages/x/dist/index.js";
import { homedir } from "node:os";
import { join } from "node:path";

// -----------------------------------------------------------------------------
// 1. Liste canonique des blades compétitifs Beyblade X (fusion de 3 sources repo)
// -----------------------------------------------------------------------------
// Construite par union/dédup (casse normalisée) de :
//   - parts WHERE type='BLADE' (filtré : on retire les codes courts + beys NON-X :
//     Bakuten/Metal Fight/Burst/collabs Marvel-StarWars-Transformers).
//   - apps/web/data/bbx-weekly.json -> periods.4weeks Blade components.
//   - clés de BLADE_TIERS (apps/web/src/server/services/global-search.ts).
// On garde uniquement les blades de la génération Beyblade X (système 3-pièces).
const CANONICAL_BLADES: string[] = [
  // Tier S / A du métagame WBO + BLADE_TIERS
  "Wizard Rod",
  "Shark Scale",
  "Shark Edge",
  "Cobalt Dragoon",
  "Cobalt Drake",
  "Phoenix Wing",
  "Aero Pegasus",
  "Dran Sword",
  "Dran Buster",
  "Dran Brave",
  "Dran Dagger",
  "Tyranno Beat",
  "Hells Scythe",
  "Hells Chain",
  "Hells Hammer",
  "Hells Reaper",
  "Leon Claw",
  "Leon Crest",
  "Weiss Tiger",
  "Unicorn Sting",
  "Knight Shield",
  "Knight Lance",
  "Knight Mail",
  "Knight Fortress",
  "Viper Tail",
  // Reste du roster X présent en base / métagame
  "Wizard Arrow",
  "Wizard Arc",
  "Meteor Dragoon",
  "Wyvern Hover",
  "Wyvern Gale",
  "Silver Wolf",
  "Clock Mirage",
  "Golem Rock",
  "Scorpio Spear",
  "Mummy Curse",
  "Bear Scratch",
  "Croc Crunch",
  "Sphinx Cowl",
  "Phoenix Feather",
  "Phoenix Flare",
  "Phoenix Rudder",
  "Tricera Press",
  "Impact Drake",
  "Shelter Drake",
  "Shark Gill",
  "Black Shell",
  "Ghost Circle",
  "Cerberus Flame",
  "Crimson Garuda",
  "Bahamut Blitz",
  "Whale Wave",
  "Ptera Swing",
  "Rhino Horn",
  "Roar Tyranno",
  "Talon Ptera",
];

// -----------------------------------------------------------------------------
// 2. Sources
// -----------------------------------------------------------------------------

interface BladeRecord {
  name: string;
  xMentions: number;
  xEngagement: number;
  redditPosts: number;
  redditScore: number;
  webHits: number;
  communityScore: number; // rempli en post-traitement
  sampleQuotes: string[];
}

const X_PER_BLADE = Number(process.env.ENRICH_X_PER_BLADE || 20);
const DELAY_MS = Number(process.env.ENRICH_DELAY_MS || 4000);
const SKIP_WEB = process.env.ENRICH_SKIP_WEB === "1";
const LIMIT = Number(process.env.ENRICH_LIMIT || 0);
// ENRICH_ONLY="A,B,C" : ne (re)traiter que ces blades et MERGER dans le JSON existant
// (backfill rejouable des blades manqués par un rate-limit transitoire).
const ONLY = (process.env.ENRICH_ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REDDIT_JAR = join(homedir(), ".aphrody", "reddit-session-cookies.txt");

// --- X ---
async function searchX(
  client: XClient,
  blade: string,
): Promise<{ mentions: number; engagement: number; quotes: string[]; rateLimited: boolean }> {
  const query = `${blade} beyblade x`;
  try {
    // "Top" privilégie l'engagement (signal communautaire plus fort que "Latest").
    const res = await client.search(query, X_PER_BLADE, undefined, "Top");
    let engagement = 0;
    const quotes: string[] = [];
    for (const t of res.tweets) {
      engagement += (t.like_count || 0) + (t.retweet_count || 0) + (t.quote_count || 0);
    }
    // 2-3 extraits : tweets les plus engageants, texte non vide, dédupliqués.
    const ranked = [...res.tweets]
      .filter((t) => (t.text || "").trim().length > 0)
      .sort(
        (a, b) =>
          (b.like_count || 0) +
          (b.retweet_count || 0) -
          ((a.like_count || 0) + (a.retweet_count || 0)),
      );
    for (const t of ranked) {
      const clean = (t.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (clean && !quotes.includes(clean)) quotes.push(clean);
      if (quotes.length >= 3) break;
    }
    return { mentions: res.tweets.length, engagement, quotes, rateLimited: false };
  } catch (e: any) {
    const msg = e?.message || String(e);
    const rl = /429|rate.?limit/i.test(msg);
    console.error(`  [X] "${query}" failed: ${msg}${rl ? " (RATE-LIMITED)" : ""}`);
    return { mentions: 0, engagement: 0, quotes: [], rateLimited: rl };
  }
}

// --- Reddit ---
async function searchRedditSub(
  blade: string,
  sub: string,
): Promise<{ posts: number; score: number; titles: string[]; ok: boolean; status: number }> {
  const q = encodeURIComponent(blade);
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${q}&restrict_sr=1&sort=top&t=year&limit=15&raw_json=1`;
  try {
    const proc = Bun.spawnSync([
      "curl",
      "-s",
      "-w",
      "\n%{http_code}",
      "-b",
      REDDIT_JAR,
      "-A",
      UA,
      url,
    ]);
    const out = proc.stdout.toString();
    const nl = out.lastIndexOf("\n");
    const body = out.slice(0, nl);
    const status = Number(out.slice(nl + 1).trim()) || 0;
    if (status !== 200) return { posts: 0, score: 0, titles: [], ok: false, status };
    const data = JSON.parse(body);
    const children = data?.data?.children || [];
    let score = 0;
    const titles: string[] = [];
    for (const c of children) {
      score += c?.data?.score || 0;
    }
    for (const c of children.slice(0, 3)) {
      const title = (c?.data?.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
      if (title) titles.push(title);
    }
    return { posts: children.length, score, titles, ok: true, status };
  } catch (e: any) {
    console.error(`  [Reddit r/${sub}] "${blade}" failed: ${e?.message || e}`);
    return { posts: 0, score: 0, titles: [], ok: false, status: -1 };
  }
}

async function searchReddit(
  blade: string,
): Promise<{ posts: number; score: number; titles: string[]; ok: boolean; statuses: number[] }> {
  const subs = ["BeybladeX", "Beyblade"];
  let posts = 0;
  let score = 0;
  const titles: string[] = [];
  const statuses: number[] = [];
  let anyOk = false;
  const seen = new Set<string>();
  for (const sub of subs) {
    const r = await searchRedditSub(blade, sub);
    statuses.push(r.status);
    if (r.ok) {
      anyOk = true;
      posts += r.posts;
      score += r.score;
      for (const t of r.titles) {
        if (!seen.has(t)) {
          seen.add(t);
          titles.push(t);
        }
      }
    }
    await sleep(800);
  }
  return { posts, score, titles: titles.slice(0, 3), ok: anyOk, statuses };
}

// --- Web (Bing via bxc curl-impersonate, en sous-process) ---
// On invoque le moteur bxc en sous-process Bun pour confiner bun:ffi (libcurl-impersonate)
// hors de ce process. L'IP du VPS est bot-wallée par Google/DDG → Bing est la source fiable.
const LIBCURL_PATH =
  process.env.LIBCURL_IMPERSONATE_PATH ||
  "/home/ubuntu/bxc/vendor/curl-impersonate/libcurl-impersonate.so";
async function searchWeb(
  blade: string,
): Promise<{ hits: number; snippets: string[]; ok: boolean }> {
  // Mener avec le nom du blade fait varier la profondeur indexée (le signal web) ;
  // "beyblade x meta tier" cadre le contexte compétitif.
  const query = `${blade} beyblade x meta tier list competitive`;
  try {
    const proc = Bun.spawnSync(["bun", join(import.meta.dir, "recon-web.ts"), blade, query], {
      env: { ...process.env, LIBCURL_IMPERSONATE_PATH: LIBCURL_PATH },
      stderr: "pipe",
    });
    const out = proc.stdout.toString().trim();
    if (!out) {
      const err = proc.stderr.toString().trim();
      console.error(`  [Web] "${query}" no output: ${err.slice(0, 160)}`);
      return { hits: 0, snippets: [], ok: false };
    }
    const parsed = JSON.parse(out) as { hits: number; snippets: string[]; ok: boolean };
    return parsed;
  } catch (e: any) {
    console.error(`  [Web] "${query}" failed: ${e?.message || e}`);
    return { hits: 0, snippets: [], ok: false };
  }
}

// -----------------------------------------------------------------------------
// 3. Normalisation cross-source -> communityScore (0..100)
// -----------------------------------------------------------------------------
function minMax(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return (v: number) => (span <= 0 ? 0 : (v - min) / span);
}

function computeCommunityScores(records: BladeRecord[]): void {
  // On normalise chaque signal en log (les distributions sont très skewées :
  // une poignée de blades captent l'essentiel de l'engagement), puis min-max.
  const lg = (v: number) => Math.log10(1 + Math.max(0, v));
  const xVals = records.map((r) => lg(r.xEngagement));
  const rVals = records.map((r) => lg(r.redditScore));
  const wVals = records.map((r) => lg(r.webHits));
  const nx = minMax(xVals);
  const nr = minMax(rVals);
  const nw = minMax(wVals);
  // Pondération : X (buzz temps réel) 0.45, Reddit (discussion de fond) 0.40, Web 0.15.
  const W_X = 0.45;
  const W_R = 0.4;
  const W_W = 0.15;
  for (const r of records) {
    const s = W_X * nx(lg(r.xEngagement)) + W_R * nr(lg(r.redditScore)) + W_W * nw(lg(r.webHits));
    r.communityScore = Math.round(s * 1000) / 10; // 0..100, 1 décimale
  }
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
async function main() {
  let blades = LIMIT > 0 ? CANONICAL_BLADES.slice(0, LIMIT) : CANONICAL_BLADES;
  if (ONLY.length > 0) {
    const onlyLow = new Set(ONLY.map((s) => s.toLowerCase()));
    blades = CANONICAL_BLADES.filter((b) => onlyLow.has(b.toLowerCase()));
  }
  console.log(
    `=== enrich-meta : ${blades.length} blades${ONLY.length ? " (ONLY/merge)" : ""}, X_PER=${X_PER_BLADE}, delay=${DELAY_MS}ms, web=${SKIP_WEB ? "SKIP" : "on"} ===`,
  );

  // X auth
  let client: XClient | null = null;
  let xAuthOk = false;
  try {
    const session = XSession.load();
    client = new XClient(session);
    const me = await client.whoami();
    xAuthOk = true;
    console.log(`[X] authenticated as @${me.screen_name}`);
  } catch (e: any) {
    console.error(`[X] AUTH FAILED: ${e?.message || e} — X mentions will be 0`);
  }

  const records: BladeRecord[] = [];
  const coverage = {
    xCovered: 0,
    xMissed: [] as string[],
    xRateLimited: false,
    redditCovered: 0,
    redditMissed: [] as string[],
    webCovered: 0,
    webMissed: [] as string[],
  };

  let idx = 0;
  for (const blade of blades) {
    idx++;
    console.log(`\n[${idx}/${blades.length}] ${blade}`);
    const rec: BladeRecord = {
      name: blade,
      xMentions: 0,
      xEngagement: 0,
      redditPosts: 0,
      redditScore: 0,
      webHits: 0,
      communityScore: 0,
      sampleQuotes: [],
    };

    // X
    if (xAuthOk && client) {
      const x = await searchX(client, blade);
      rec.xMentions = x.mentions;
      rec.xEngagement = x.engagement;
      if (x.quotes.length) rec.sampleQuotes.push(...x.quotes.slice(0, 2));
      if (x.rateLimited) {
        coverage.xRateLimited = true;
        coverage.xMissed.push(blade);
      } else {
        coverage.xCovered++;
      }
      console.log(`  [X] ${x.mentions} tweets, engagement=${x.engagement}`);
    } else {
      coverage.xMissed.push(blade);
    }

    // Reddit
    const r = await searchReddit(blade);
    rec.redditPosts = r.posts;
    rec.redditScore = r.score;
    if (r.ok) {
      coverage.redditCovered++;
      // 1 titre Reddit comme quote complémentaire si on manque d'extraits X.
      if (rec.sampleQuotes.length < 2 && r.titles.length) {
        rec.sampleQuotes.push(`[Reddit] ${r.titles[0]}`);
      }
    } else {
      coverage.redditMissed.push(blade);
    }
    console.log(`  [Reddit] ${r.posts} posts, score=${r.score} (status ${r.statuses.join("/")})`);

    // Web
    if (!SKIP_WEB) {
      const w = await searchWeb(blade);
      rec.webHits = w.hits;
      if (w.ok) {
        coverage.webCovered++;
        // Les snippets Bing depuis cette IP sont souvent hors-sujet (mauvais sens du
        // nom du blade). On ne retient un snippet web QUE s'il mentionne "beyblade"
        // ET le nom du blade — sinon on garde les extraits X (toujours pertinents).
        if (rec.sampleQuotes.length < 3) {
          const bladeLow = blade.toLowerCase();
          const topical = w.snippets.find((s) => {
            const sl = s.toLowerCase();
            return sl.includes("beyblade") && sl.includes(bladeLow.split(" ")[0]);
          });
          if (topical) {
            const snip = topical.replace(/\s+/g, " ").trim().slice(0, 200);
            rec.sampleQuotes.push(`[Web] ${snip}`);
          }
        }
      } else {
        coverage.webMissed.push(blade);
      }
      console.log(`  [Web] ${w.hits} hits${w.ok ? "" : " (FAILED)"}`);
    }

    rec.sampleQuotes = rec.sampleQuotes.slice(0, 3);
    records.push(rec);

    if (idx < blades.length) await sleep(DELAY_MS);
  }

  const outPath = join(import.meta.dir, "..", "data", "meta-enrichment.json");

  // En mode ONLY : merger dans le JSON existant (les nouveaux records écrasent
  // les homonymes), puis recalculer communityScore sur l'ensemble complet.
  let finalRecords = records;
  if (ONLY.length > 0) {
    try {
      const prev = (await Bun.file(outPath).json()) as { blades: BladeRecord[] };
      const byName = new Map<string, BladeRecord>();
      for (const r of prev.blades || []) byName.set(r.name.toLowerCase(), r);
      for (const r of records) byName.set(r.name.toLowerCase(), r);
      finalRecords = [...byName.values()];
      console.log(
        `[merge] ${records.length} (re)traités fusionnés dans ${prev.blades?.length ?? 0} existants -> ${finalRecords.length}`,
      );
    } catch {
      console.error("[merge] JSON existant introuvable/illisible — écriture du sous-ensemble seul");
    }
  }

  computeCommunityScores(finalRecords);
  finalRecords.sort((a, b) => b.communityScore - a.communityScore);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "x+reddit+web",
    blades: finalRecords,
  };

  await Bun.write(outPath, JSON.stringify(output, null, 2) + "\n");

  // Rapport
  console.log("\n=== RAPPORT ===");
  console.log(
    `Blades dans le fichier : ${finalRecords.length} (traités ce run : ${records.length})`,
  );
  console.log(
    `X     : ${coverage.xCovered}/${blades.length} couverts${coverage.xRateLimited ? " (RATE-LIMIT rencontré)" : ""}; manqués: ${coverage.xMissed.length ? coverage.xMissed.join(", ") : "aucun"}`,
  );
  console.log(
    `Reddit: ${coverage.redditCovered}/${blades.length} couverts; manqués: ${coverage.redditMissed.length ? coverage.redditMissed.join(", ") : "aucun"}`,
  );
  if (!SKIP_WEB)
    console.log(
      `Web   : ${coverage.webCovered}/${blades.length} couverts; manqués: ${coverage.webMissed.length ? coverage.webMissed.join(", ") : "aucun"}`,
    );
  console.log("\nTop 5 communityScore :");
  for (const r of finalRecords.slice(0, 5)) {
    console.log(
      `  ${r.communityScore.toFixed(1).padStart(5)}  ${r.name}  (X eng=${r.xEngagement}, Reddit=${r.redditScore}, web=${r.webHits})`,
    );
  }
  console.log(`\nEcrit -> ${outPath}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
