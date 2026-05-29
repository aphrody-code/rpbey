#!/usr/bin/env bun
/**
 * Reddit r/BeybladeX Scraper and Hype/Lexicon Analyzer using Bxc.
 * 
 * Fetches the subreddit, scrolls to load multiple posts, extracts titles and text,
 * correlates mentions with our product catalog/master parts, performs sentiment analysis,
 * and compiles a Beyblade X Lexicon/Glossary.
 * 
 * Usage:
 *   BXC_CHROME_BIN=/usr/local/bin/chromium bun apps/web/scripts/scrape-reddit.ts
 */

import { launchGhostBrowser } from "/home/ubuntu/bxc/src/profiles/ghost/index.ts";
import { scrollHuman } from "/home/ubuntu/bxc/src/profiles/ghost/index.ts";
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

// Configuration paths
const CATALOG_PATH = path.join(import.meta.dir, "../data/bx-catalog.json");
const PARTS_PATH = path.join(import.meta.dir, "../data/master-parts.json");
const HYPE_OUT_PATH = path.join(import.meta.dir, "../data/reddit-hype.json");
const LEXIQUE_OUT_PATH = path.join(import.meta.dir, "../data/beyblade-lexique.json");

// Define Lexicon Seed Terms (synonyms refined to avoid false positive matches on common English words)
const LEXICON_SEED = [
  {
    term: "X-Celerator Rail",
    definition: "The special gear-toothed rail running along the stadium wall in Beyblade X that allows Beyblades to engage in Extreme Dash maneuvers.",
    category: "Stadium / Equipment",
    synonyms: ["x-celerator rail", "celerator rail", "extreme line"]
  },
  {
    term: "Extreme Dash",
    definition: "The defining movement mechanic of Beyblade X, where the gear on the Bit catches on the X-Celerator Rail to accelerate to extreme speeds.",
    category: "Mechanics",
    synonyms: ["x-dash", "extreme dash", "xdash"]
  },
  {
    term: "Extreme Finish",
    definition: "A win condition worth 3 points, achieved by knocking the opponent's Beyblade out through the Extreme Zone (center exit).",
    category: "Match Rules",
    synonyms: ["extreme finish"]
  },
  {
    term: "Over Finish",
    definition: "A win condition worth 2 points, achieved by knocking the opponent's Beyblade into one of the side pockets (Over Zones).",
    category: "Match Rules",
    synonyms: ["over finish"]
  },
  {
    term: "Burst Finish",
    definition: "A win condition worth 2 points, achieved by causing the opponent's Beyblade to burst (separate into Blade, Ratchet, and Bit) during battle.",
    category: "Match Rules",
    synonyms: ["burst finish"]
  },
  {
    term: "Spin Finish",
    definition: "A win condition worth 1 point, achieved by out-spinning the opponent's Beyblade (having the last spinning Beyblade).",
    category: "Match Rules",
    synonyms: ["spin finish"]
  },
  {
    term: "Blade",
    definition: "The top metal layer of a Beyblade X, responsible for making contact and providing attack, defense, or stamina performance.",
    category: "Components",
    synonyms: ["beyblade blade"]
  },
  {
    term: "Ratchet",
    definition: "The middle layer of a Beyblade X that determines its height (e.g. 60 or 80) and has protrusions that can cause bursts.",
    category: "Components",
    synonyms: ["beyblade ratchet"]
  },
  {
    term: "Bit",
    definition: "The bottom tip component of a Beyblade X, determining movement behavior (e.g., Ball, Flat, Needle) and burst resistance.",
    category: "Components",
    synonyms: ["beyblade bit"]
  },
  {
    term: "Launcher Grip",
    definition: "An accessory that attaches to a string or ripcord launcher, providing a more stable and powerful launching hold.",
    category: "Accessories",
    synonyms: ["launcher grip"]
  },
  {
    term: "String Launcher",
    definition: "A launcher built with a pull-string and recoil spring system, preferred by many players for ease of use.",
    category: "Accessories",
    synonyms: ["string launcher"]
  },
  {
    term: "Deck",
    definition: "A set of three distinct Beyblades that a blader chooses for competitive tournament play under WBO deck rules.",
    category: "Competitive",
    synonyms: ["beyblade deck", "3on3 deck"]
  },
  {
    term: "Gimmick",
    definition: "A special design feature of a Beyblade parts, like rubber blades, free-spinning rings, or unique weight distribution.",
    category: "General Slang",
    synonyms: ["beyblade gimmick"]
  },
  {
    term: "Hasbro",
    definition: "The multinational company distributing and manufacturing the western releases of Beyblade X, featuring some localized naming.",
    category: "Brands",
    synonyms: ["hasbro"]
  },
  {
    term: "Takara Tomy",
    definition: "The original creator and Japanese manufacturer of Beyblade X, known for releasing the products first.",
    category: "Brands",
    synonyms: ["takara tomy", "takaratomy"]
  }
];

// Sentiment words lists
const POSITIVE_WORDS = ["cooking", "cook", "meta", "best", "good", "love", "top", "great", "win", "op", "s-tier", "stier", "amazing", "awesome", "hype", "must-buy", "crazy", "solid", "hype", "w", "beast"];
const NEGATIVE_WORDS = ["bad", "worst", "trash", "broken", "mid", "weak", "hate", "fail", "lose", "nerf", "f-tier", "garbage", "l", "expensive", "unusable", "skip"];

interface Post {
  title: string;
  author: string;
  score: number;
  commentCount: number;
  permalink: string;
  bodyText: string;
}

async function main() {
  console.log("Starting Beyblade X Reddit Scraper & NLP Pipeline...");

  // Ensure BXC_CHROME_BIN is set, otherwise default to local chromium
  if (!process.env.BXC_CHROME_BIN) {
    process.env.BXC_CHROME_BIN = "/usr/local/bin/chromium";
  }

  // 1. Load catalog, fandom and parts dictionaries
  let productCodes: string[] = [];
  let partNames: string[] = [];
  const codeToKeywords: Record<string, string[]> = {};

  try {
    const TT_PRODUCTS_PATH = path.join(import.meta.dir, "../data/takaratomy-products.json");
    if (fs.existsSync(TT_PRODUCTS_PATH)) {
      const ttProducts = JSON.parse(fs.readFileSync(TT_PRODUCTS_PATH, "utf-8"));
      // Extract codes directly from the Takara Tomy official database entries
      const codes = new Set<string>();
      for (const prod of ttProducts) {
        if (prod.code) {
          codes.add(prod.code.toUpperCase());
        }
      }
      productCodes = Array.from(codes);
      console.log(`Loaded ${productCodes.length} product codes from takaratomy-products.`);
    } else {
      console.warn("Takara Tomy products file not found. Fallback to basic codes.");
      productCodes = ["BX-01", "BX-02", "BX-10", "UX-01", "UX-04", "CX-01"];
    }

    const FANDOM_PATH = path.join(import.meta.dir, "../data/fandom_products.json");
    if (fs.existsSync(FANDOM_PATH)) {
      const fandom = JSON.parse(fs.readFileSync(FANDOM_PATH, "utf-8"));
      for (const item of fandom) {
        if (item.code && item.name) {
          const code = item.code.toUpperCase();
          const clean = item.name.replace(/^(Starter|Booster|Unique Line Starter|Random Booster Vol\.\d+)\s+/i, "");
          const base = clean.replace(/\s+\d-\d{2}[a-zA-Z]{1,3}$/, "").trim().toLowerCase();
          const keywords = [base];
          
          // Split CamelCase if needed
          const splitCamel = base.replace(/([a-z])([A-Z])/g, "$1 $2");
          if (splitCamel !== base) {
            keywords.push(splitCamel);
          }
          codeToKeywords[code] = keywords;
        }
      }
      console.log(`Loaded mapping for ${Object.keys(codeToKeywords).length} product codes from fandom_products.`);
    }

    if (fs.existsSync(PARTS_PATH)) {
      const parts = JSON.parse(fs.readFileSync(PARTS_PATH, "utf-8"));
      partNames = parts.map((p: any) => p.name).filter(Boolean);
      console.log(`Loaded ${partNames.length} parts from master-parts.`);
    }
  } catch (err: any) {
    console.error("Error loading dictionaries:", err.message);
  }

  // 2. Launch browser via Bxc Ghost Profile
  console.log("Launching Ghost Browser...");
  const ghost = await launchGhostBrowser({
    fingerprint: { os: "linux", browser: "chrome" },
    locale: "fr-FR",
    timezone: "Europe/Paris",
  });

  const posts: Post[] = [];

  try {
    const targetUrl = "https://www.reddit.com/r/BeybladeX/";
    let html = "";
    let pageTitle = "";
    let isBlocked = false;

    // Retry loop for navigation
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Navigating to target subreddit (attempt ${attempt}/${maxRetries}): ${targetUrl}`);
        await ghost.page.goto(targetUrl);
        await new Promise((r) => setTimeout(r, 8000));
        
        pageTitle = await ghost.page.title();
        html = await ghost.page.content();

        if (pageTitle && html.length > 300000) {
          console.log("Successfully navigated without Cloudflare block!");
          isBlocked = false;
          break;
        } else {
          console.warn(`Attempt ${attempt} resulted in block screen or empty title.`);
          isBlocked = true;
        }
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err.message);
        isBlocked = true;
      }
      if (attempt < maxRetries) {
        console.log("Waiting 5s before retry...");
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // Scroll if not blocked
    if (!isBlocked && html.length > 300000) {
      const scrollCount = 4;
      for (let s = 1; s <= scrollCount; s++) {
        console.log(`Scrolling page (step ${s}/${scrollCount})...`);
        await ghost.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5);
        });
        await new Promise((r) => setTimeout(r, 3000));
      }
      html = await ghost.page.content();
    } else {
      console.warn("Target blocked by Cloudflare or navigation failed. Falling back to cached local HTML file...");
      const cachePath = "/home/ubuntu/.gemini/antigravity-cli/brain/eeb535e4-da9d-463a-bb6a-da1542ac9393/scratch/reddit_scrape_debug.html";
      const fallbackPath = "/home/ubuntu/.gemini/antigravity-cli/brain/eeb535e4-da9d-463a-bb6a-da1542ac9393/scratch/reddit_ghost_content.html";
      
      let selectedPath = "";
      if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 300000) {
        selectedPath = cachePath;
      } else if (fs.existsSync(fallbackPath)) {
        selectedPath = fallbackPath;
      }

      if (selectedPath) {
        html = fs.readFileSync(selectedPath, "utf-8");
        console.log(`Loaded cached HTML from ${selectedPath} of length ${html.length} bytes.`);
      } else {
        console.error("No cached HTML file found!");
      }
    }

    // Only write to debug file if we successfully scraped a fresh valid page
    if (!isBlocked && html.length > 300000) {
      fs.writeFileSync("/home/ubuntu/.gemini/antigravity-cli/brain/eeb535e4-da9d-463a-bb6a-da1542ac9393/scratch/reddit_scrape_debug.html", html);
    }
    const $ = cheerio.load(html);

    // Parse posts
    $("shreddit-post").each((i, el) => {
      const title = $(el).attr("post-title") || "";
      const author = $(el).attr("author") || "";
      const score = parseInt($(el).attr("score") || "0", 10);
      const commentCount = parseInt($(el).attr("comment-count") || "0", 10);
      const permalink = $(el).attr("permalink") || "";

      // Try finding text body
      const bodyEl = $(el).find("[slot='text-body']") || $(el).find(".md") || $(el).find("div[class*='feed-post-text']");
      const bodyText = bodyEl ? bodyEl.text().trim() : "";

      if (title) {
        posts.push({ title, author, score, commentCount, permalink, bodyText });
      }
    });

    console.log(`Successfully scraped ${posts.length} posts from /r/BeybladeX.`);
  } catch (err: any) {
    console.error("Failed to scrape Reddit:", err.stack);
  } finally {
    console.log("Closing Browser.");
    await ghost.close();
  }

  if (posts.length === 0) {
    console.error("No posts scraped. Exiting analysis.");
    return;
  }

  // 3. Process mentions and calculate hype metrics
  console.log("Analyzing hype patterns...");

  const mentionsCount: Record<string, number> = {};
  const engagementSum: Record<string, number> = {};
  const sentimentScoreAccum: Record<string, number> = {};
  const postListByProduct: Record<string, string[]> = {};

  // Init metrics
  for (const code of productCodes) {
    mentionsCount[code] = 0;
    engagementSum[code] = 0;
    sentimentScoreAccum[code] = 0;
    postListByProduct[code] = [];
  }

  // Analyze posts
  for (const post of posts) {
    const combinedText = `${post.title} ${post.bodyText}`.toLowerCase();

    // Sentiment check
    let posCount = 0;
    let negCount = 0;
    for (const w of POSITIVE_WORDS) {
      if (combinedText.includes(w)) posCount++;
    }
    for (const w of NEGATIVE_WORDS) {
      if (combinedText.includes(w)) negCount++;
    }
    // Normalized sentiment from 0 to 1 (0.5 is neutral)
    const sentiment = (posCount + negCount > 0) 
      ? 0.5 + ((posCount - negCount) / (posCount + negCount)) * 0.5
      : 0.5;

    // Check for product codes or name keywords mentions
    for (const code of productCodes) {
      let isMentioned = false;
      const codeRegex = new RegExp(`\\b${code.replace("-", "-?")}\\b`, "i");
      
      if (codeRegex.test(combinedText)) {
        isMentioned = true;
      } else {
        const keywords = codeToKeywords[code] || [];
        for (const kw of keywords) {
          if (kw.length >= 3 && combinedText.includes(kw)) {
            isMentioned = true;
            break;
          }
        }
      }

      if (isMentioned) {
        mentionsCount[code] += 1;
        engagementSum[code] += (post.score + post.commentCount * 2);
        sentimentScoreAccum[code] += sentiment;
        postListByProduct[code].push(post.title);
      }
    }
  }

  // Calculate final hype scores
  const finalHypeScores: Record<string, number> = {};
  const sortedProducts: Array<{ code: string; score: number; mentions: number }> = [];

  let maxHypeVal = 0.001;
  const rawHypeVals: Record<string, number> = {};

  for (const code of productCodes) {
    const mentions = mentionsCount[code];
    if (mentions === 0) {
      rawHypeVals[code] = 0.0;
      continue;
    }

    const engagement = engagementSum[code];
    const avgSentiment = sentimentScoreAccum[code] / mentions;

    // Raw hype formula: popularity (mentions) + engagement + sentiment quality
    const rawVal = (mentions * 2.0) + (engagement * 0.5) + (avgSentiment * 10);
    rawHypeVals[code] = rawVal;
    if (rawVal > maxHypeVal) maxHypeVal = rawVal;
  }

  // Normalize final hype scores between 0.1 and 1.0 (to avoid 0 hype for active products)
  for (const code of productCodes) {
    if (rawHypeVals[code] === 0) {
      finalHypeScores[code] = 0.5; // Default/neutral hype for products not mentioned
    } else {
      finalHypeScores[code] = 0.5 + (rawHypeVals[code] / maxHypeVal) * 0.5;
    }

    sortedProducts.push({
      code,
      score: finalHypeScores[code],
      mentions: mentionsCount[code]
    });
  }

  sortedProducts.sort((a, b) => b.score - a.score);

  // Write Hype JSON output
  const hypeOutput = {
    generatedAt: new Date().toISOString(),
    subreddit: "r/BeybladeX",
    analyzedPostCount: posts.length,
    hypeScores: finalHypeScores,
    productMentions: sortedProducts.map(p => ({
      code: p.code,
      hypeScore: Number(p.score.toFixed(2)),
      mentions: p.mentions,
      recentPostTitles: (postListByProduct[p.code] || []).slice(0, 3)
    })).filter(p => p.mentions > 0)
  };

  fs.writeFileSync(HYPE_OUT_PATH, JSON.stringify(hypeOutput, null, 2));
  console.log(`Saved Reddit hype report to: ${HYPE_OUT_PATH}`);

  // 4. Update Beyblade Lexicon/Glossary
  console.log("Analyzing Beyblade Lexicon...");

  const finalLexicon = LEXICON_SEED.map(seed => {
    let mentions = 0;
    const matchedPosts: string[] = [];

    for (const post of posts) {
      const combinedText = `${post.title} ${post.bodyText}`.toLowerCase();
      // Match seed term or synonyms
      const matches = [seed.term.toLowerCase(), ...seed.synonyms].some(syn => {
        const regex = new RegExp(`\\b${syn}\\b`, "i");
        return regex.test(combinedText);
      });

      if (matches) {
        mentions++;
        if (matchedPosts.length < 3) {
          matchedPosts.push(post.title);
        }
      }
    }

    // Determine popularity tier
    let popularityTier = "Low";
    if (mentions >= 10) popularityTier = "Very High";
    else if (mentions >= 5) popularityTier = "High";
    else if (mentions >= 2) popularityTier = "Medium";

    return {
      term: seed.term,
      definition: seed.definition,
      category: seed.category,
      mentionsCount: mentions,
      popularityTier,
      examplesFromReddit: matchedPosts
    };
  });

  const lexiconOutput = {
    generatedAt: new Date().toISOString(),
    totalTermsCount: finalLexicon.length,
    terms: finalLexicon
  };

  fs.writeFileSync(LEXIQUE_OUT_PATH, JSON.stringify(lexiconOutput, null, 2));
  console.log(`Saved Beyblade Lexicon to: ${LEXIQUE_OUT_PATH}`);

  console.log("\nReddit scraping and analysis pipeline complete!");
}

main().catch(err => {
  console.error("Unhandled error in scraper:", err);
  process.exit(1);
});
