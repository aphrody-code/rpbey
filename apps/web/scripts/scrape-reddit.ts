#!/usr/bin/env bun
/**
 * Reddit r/BeybladeX scraper + Hype/Lexicon analyzer.
 *
 * Acquisition : API JSON publique de Reddit (`/r/BeybladeX/{hot,top}.json`) via
 * curl-impersonate (`@aphrody-code/bxc`, profil chrome — même moteur TLS-fingerprint
 * que le scraper Challonge). Pas de navigateur headless, pas de bxc-engine à compiler.
 *
 * Corrèle les mentions avec le catalogue produits + master-parts, calcule des scores
 * d'engagement et de sentiment, et compile un lexique Beyblade X.
 *
 * Sorties : data/reddit-hype.json (consommé par recommendation-engine.ts) et
 * data/beyblade-lexique.json.
 *
 * NON-DESTRUCTIF : si Reddit bloque la requête (403 réputation d'IP datacenter —
 * fréquent depuis un VPS) ou si aucun post n'est récupéré, le script logge et
 * sort SANS écraser les fichiers existants. Lancer depuis une IP résidentielle
 * (workstation, ou VPS derrière le tunnel SOCKS) pour des données fraîches.
 *
 * Usage : bun apps/web/scripts/scrape-reddit.ts
 */

import { ImpersonatedClient } from "@aphrody-code/bxc/ffi/curl-impersonate";

const DATA_DIR = new URL("../data/", import.meta.url).pathname;
const TT_PRODUCTS_PATH = `${DATA_DIR}takaratomy-products.json`;
const FANDOM_PATH = `${DATA_DIR}fandom_products.json`;
const PARTS_PATH = `${DATA_DIR}master-parts.json`;
const HYPE_OUT_PATH = `${DATA_DIR}reddit-hype.json`;
const LEXIQUE_OUT_PATH = `${DATA_DIR}beyblade-lexique.json`;

const SUBREDDIT = "r/BeybladeX";
// Endpoints agrégés (dédupliqués par id) : récent + populaire historique.
const ENDPOINTS = [
  "https://www.reddit.com/r/BeybladeX/hot.json?limit=100",
  "https://www.reddit.com/r/BeybladeX/top.json?t=month&limit=100",
  "https://www.reddit.com/r/BeybladeX/top.json?t=year&limit=100",
];

// Lexique de départ (définitions rédigées — indépendantes du scraping ; le scraping
// ne fait qu'enrichir mentionsCount / popularityTier / examplesFromReddit).
const LEXICON_SEED = [
  {
    term: "X-Celerator Rail",
    definition:
      "The special gear-toothed rail running along the stadium wall in Beyblade X that allows Beyblades to engage in Extreme Dash maneuvers.",
    category: "Stadium / Equipment",
    synonyms: ["x-celerator rail", "celerator rail", "extreme line"],
  },
  {
    term: "Extreme Dash",
    definition:
      "The defining movement mechanic of Beyblade X, where the gear on the Bit catches on the X-Celerator Rail to accelerate to extreme speeds.",
    category: "Mechanics",
    synonyms: ["x-dash", "extreme dash", "xdash"],
  },
  {
    term: "Extreme Finish",
    definition:
      "A win condition worth 3 points, achieved by knocking the opponent's Beyblade out through the Extreme Zone (center exit).",
    category: "Match Rules",
    synonyms: ["extreme finish"],
  },
  {
    term: "Over Finish",
    definition:
      "A win condition worth 2 points, achieved by knocking the opponent's Beyblade into one of the side pockets (Over Zones).",
    category: "Match Rules",
    synonyms: ["over finish"],
  },
  {
    term: "Burst Finish",
    definition:
      "A win condition worth 2 points, achieved by causing the opponent's Beyblade to burst (separate into Blade, Ratchet, and Bit) during battle.",
    category: "Match Rules",
    synonyms: ["burst finish"],
  },
  {
    term: "Spin Finish",
    definition:
      "A win condition worth 1 point, achieved by out-spinning the opponent's Beyblade (having the last spinning Beyblade).",
    category: "Match Rules",
    synonyms: ["spin finish"],
  },
  {
    term: "Blade",
    definition:
      "The top layer of a Beyblade X, responsible for making contact and providing attack, defense, or stamina performance.",
    category: "Components",
    synonyms: ["beyblade blade"],
  },
  {
    term: "Ratchet",
    definition:
      "The middle layer of a Beyblade X that determines its height (e.g. 60 or 80) and has protrusions that can cause bursts.",
    category: "Components",
    synonyms: ["beyblade ratchet"],
  },
  {
    term: "Bit",
    definition:
      "The bottom tip component of a Beyblade X, determining movement behavior (e.g. Ball, Flat, Needle) and burst resistance.",
    category: "Components",
    synonyms: ["beyblade bit"],
  },
  {
    term: "Launcher Grip",
    definition:
      "An accessory that attaches to a string or ripcord launcher, providing a more stable and powerful launching hold.",
    category: "Accessories",
    synonyms: ["launcher grip"],
  },
  {
    term: "String Launcher",
    definition:
      "A launcher built with a pull-string and recoil spring system, preferred by many players for ease of use.",
    category: "Accessories",
    synonyms: ["string launcher"],
  },
  {
    term: "Deck",
    definition:
      "A set of three distinct Beyblades that a blader chooses for competitive tournament play under WBO deck rules.",
    category: "Competitive",
    synonyms: ["beyblade deck", "3on3 deck"],
  },
  {
    term: "Gimmick",
    definition:
      "A special design feature of a Beyblade part, like rubber blades, free-spinning rings, or unique weight distribution.",
    category: "General Slang",
    synonyms: ["beyblade gimmick"],
  },
  {
    term: "Hasbro",
    definition:
      "The multinational company distributing and manufacturing the western releases of Beyblade X, featuring some localized naming.",
    category: "Brands",
    synonyms: ["hasbro"],
  },
  {
    term: "Takara Tomy",
    definition:
      "The original creator and Japanese manufacturer of Beyblade X, known for releasing the products first.",
    category: "Brands",
    synonyms: ["takara tomy", "takaratomy"],
  },
];

const POSITIVE_WORDS = [
  "cooking",
  "cook",
  "meta",
  "best",
  "good",
  "love",
  "top",
  "great",
  "win",
  "op",
  "s-tier",
  "stier",
  "amazing",
  "awesome",
  "hype",
  "must-buy",
  "crazy",
  "solid",
  "beast",
];
const NEGATIVE_WORDS = [
  "bad",
  "worst",
  "trash",
  "broken",
  "mid",
  "weak",
  "hate",
  "fail",
  "lose",
  "nerf",
  "f-tier",
  "garbage",
  "expensive",
  "unusable",
  "skip",
];

interface Post {
  id: string;
  title: string;
  author: string;
  score: number;
  commentCount: number;
  permalink: string;
  bodyText: string;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return (await Bun.file(path).json()) as T;
  } catch {
    return null;
  }
}

/** Récupère et fusionne les posts des endpoints JSON Reddit. */
async function fetchPosts(): Promise<Post[]> {
  const client = new ImpersonatedClient({
    profile: "chrome131",
    timeoutMs: 30_000,
  });
  const byId = new Map<string, Post>();

  try {
    for (const url of ENDPOINTS) {
      try {
        const res = await client.fetch(url);
        const text = await res.text();
        if (res.status !== 200 || !text.trimStart().startsWith("{")) {
          console.warn(`  [${res.status}] bloqué/non-JSON : ${url}`);
          continue;
        }
        const json = JSON.parse(text);
        const children = json?.data?.children ?? [];
        for (const child of children) {
          const d = child?.data;
          if (!d?.id || byId.has(d.id)) continue;
          byId.set(d.id, {
            id: d.id,
            title: d.title ?? "",
            author: d.author ?? "",
            score: Number(d.score ?? 0),
            commentCount: Number(d.num_comments ?? 0),
            permalink: d.permalink ?? "",
            bodyText: (d.selftext ?? "").toString(),
          });
        }
        console.log(`  [200] ${children.length} posts <- ${url}`);
      } catch (err) {
        console.warn(`  ERR ${url} : ${(err as Error).message}`);
      }
    }
  } finally {
    client.close();
  }

  return [...byId.values()];
}

async function main() {
  console.log(`Beyblade X Reddit scraper (${SUBREDDIT}) — acquisition curl-impersonate...`);

  // 1. Dictionnaires de correspondance code → mots-clés.
  const productCodes: string[] = [];
  const codeToKeywords: Record<string, string[]> = {};
  let partNames: string[] = [];

  const ttProducts = await readJson<Array<{ code?: string }>>(TT_PRODUCTS_PATH);
  if (ttProducts) {
    const codes = new Set<string>();
    for (const p of ttProducts) if (p.code) codes.add(p.code.toUpperCase());
    productCodes.push(...codes);
    console.log(`Codes produits (takaratomy) : ${productCodes.length}`);
  } else {
    productCodes.push("BX-01", "BX-02", "BX-10", "UX-01", "UX-04", "CX-01");
    console.warn("takaratomy-products.json absent — fallback codes basiques.");
  }

  const fandom = await readJson<Array<{ code?: string; name?: string }>>(FANDOM_PATH);
  if (fandom) {
    for (const item of fandom) {
      if (!item.code || !item.name) continue;
      const code = item.code.toUpperCase();
      const clean = item.name.replace(
        /^(Starter|Booster|Unique Line Starter|Random Booster Vol\.\d+)\s+/i,
        "",
      );
      const base = clean
        .replace(/\s+\d-\d{2}[a-zA-Z]{1,3}$/, "")
        .trim()
        .toLowerCase();
      const keywords = [base];
      const splitCamel = base.replace(/([a-z])([A-Z])/g, "$1 $2");
      if (splitCamel !== base) keywords.push(splitCamel);
      codeToKeywords[code] = keywords;
    }
    console.log(`Mapping mots-clés (fandom) : ${Object.keys(codeToKeywords).length}`);
  }

  const parts = await readJson<Array<{ name?: string }>>(PARTS_PATH);
  if (parts) {
    partNames = parts.map((p) => p.name).filter((n): n is string => Boolean(n));
    console.log(`Parts (master-parts) : ${partNames.length}`);
  }

  // 2. Acquisition.
  console.log("Récupération des posts Reddit...");
  const posts = await fetchPosts();
  console.log(`Total posts uniques : ${posts.length}`);

  if (posts.length === 0) {
    console.error(
      "Aucun post récupéré (probable blocage IP datacenter par Reddit). " +
        "Fichiers existants PRÉSERVÉS (non-destructif). " +
        "Relancer depuis une IP résidentielle / le tunnel SOCKS.",
    );
    process.exit(2);
  }

  // 3. Mentions + métriques de hype.
  console.log("Analyse de la hype...");
  const mentionsCount: Record<string, number> = {};
  const engagementSum: Record<string, number> = {};
  const sentimentAccum: Record<string, number> = {};
  const postsByProduct: Record<string, string[]> = {};
  for (const code of productCodes) {
    mentionsCount[code] = 0;
    engagementSum[code] = 0;
    sentimentAccum[code] = 0;
    postsByProduct[code] = [];
  }

  for (const post of posts) {
    const text = `${post.title} ${post.bodyText}`.toLowerCase();
    let pos = 0;
    let neg = 0;
    for (const w of POSITIVE_WORDS) if (text.includes(w)) pos++;
    for (const w of NEGATIVE_WORDS) if (text.includes(w)) neg++;
    const sentiment = pos + neg > 0 ? 0.5 + ((pos - neg) / (pos + neg)) * 0.5 : 0.5;

    for (const code of productCodes) {
      const codeRegex = new RegExp(`\\b${code.replace("-", "-?")}\\b`, "i");
      let mentioned = codeRegex.test(text);
      if (!mentioned) {
        for (const kw of codeToKeywords[code] ?? []) {
          if (kw.length >= 3 && text.includes(kw)) {
            mentioned = true;
            break;
          }
        }
      }
      if (mentioned) {
        mentionsCount[code]++;
        engagementSum[code] += post.score + post.commentCount * 2;
        sentimentAccum[code] += sentiment;
        postsByProduct[code].push(post.title);
      }
    }
  }

  const rawHype: Record<string, number> = {};
  let maxHype = 0.001;
  for (const code of productCodes) {
    const m = mentionsCount[code];
    if (m === 0) {
      rawHype[code] = 0;
      continue;
    }
    const avgSentiment = sentimentAccum[code] / m;
    const raw = m * 2.0 + engagementSum[code] * 0.5 + avgSentiment * 10;
    rawHype[code] = raw;
    if (raw > maxHype) maxHype = raw;
  }

  const hypeScores: Record<string, number> = {};
  const sorted: Array<{ code: string; score: number; mentions: number }> = [];
  for (const code of productCodes) {
    // 0.5 neutre si non mentionné ; sinon 0.5 → 1.0 selon la hype normalisée.
    hypeScores[code] = rawHype[code] === 0 ? 0.5 : 0.5 + (rawHype[code] / maxHype) * 0.5;
    sorted.push({
      code,
      score: hypeScores[code],
      mentions: mentionsCount[code],
    });
  }
  sorted.sort((a, b) => b.score - a.score);

  await Bun.write(
    HYPE_OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        subreddit: SUBREDDIT,
        analyzedPostCount: posts.length,
        hypeScores,
        productMentions: sorted
          .filter((p) => p.mentions > 0)
          .map((p) => ({
            code: p.code,
            hypeScore: Number(p.score.toFixed(2)),
            mentions: p.mentions,
            recentPostTitles: (postsByProduct[p.code] ?? []).slice(0, 3),
          })),
      },
      null,
      2,
    ),
  );
  console.log(
    `Hype écrite → ${HYPE_OUT_PATH} (${sorted.filter((p) => p.mentions > 0).length} produits mentionnés)`,
  );

  // 4. Lexique.
  console.log("Mise à jour du lexique...");
  const terms = LEXICON_SEED.map((seed) => {
    let mentions = 0;
    const examples: string[] = [];
    const needles = [seed.term.toLowerCase(), ...seed.synonyms];
    for (const post of posts) {
      const text = `${post.title} ${post.bodyText}`.toLowerCase();
      if (needles.some((s) => new RegExp(`\\b${s}\\b`, "i").test(text))) {
        mentions++;
        if (examples.length < 3) examples.push(post.title);
      }
    }
    let tier = "Low";
    if (mentions >= 10) tier = "Very High";
    else if (mentions >= 5) tier = "High";
    else if (mentions >= 2) tier = "Medium";
    return {
      term: seed.term,
      definition: seed.definition,
      category: seed.category,
      mentionsCount: mentions,
      popularityTier: tier,
      examplesFromReddit: examples,
    };
  });

  await Bun.write(
    LEXIQUE_OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalTermsCount: terms.length,
        terms,
      },
      null,
      2,
    ),
  );
  console.log(`Lexique écrit → ${LEXIQUE_OUT_PATH} (${terms.length} termes)`);
  console.log("Pipeline Reddit terminé.");
}

main().catch((err) => {
  console.error("Erreur non gérée dans le scraper :", err);
  process.exit(1);
});
