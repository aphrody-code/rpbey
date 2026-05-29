#!/usr/bin/env bun
/**
 * Scrape bbxweekly.com → data/bbx-weekly.json (source de /meta).
 *
 * Le site est un SSR Astro derrière un Vercel "Attack Challenge Mode"
 * (challenge WebGL/canvas). On le franchit avec un Chromium headful (sous xvfb)
 * + puppeteer-extra-stealth + SwiftShader (WebGL logiciel) ; le cookie de
 * clearance est persisté dans un userDataDir pour les runs suivants.
 *
 * Les rankings sont rendus dans le DOM (pas d'API JSON). On extrait, par période
 * (/2weeks, /4weeks) et par catégorie, chaque composant (rang, nom, score,
 * position_change via ▲/▼). Les synergies du site sont derrière un expand par
 * ligne — non extraites ici (synergy: []), la page /meta gère le cas.
 *
 *   cd apps/web && xvfb-run -a bun scripts/scrape-bbx-weekly.ts [--dry]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteer = require("puppeteer-extra");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stealth = require("puppeteer-extra-plugin-stealth");
puppeteer.use(Stealth());

const DRY = process.argv.includes("--dry");
const PROFILE = "/tmp/bbx-chrome-profile2";
mkdirSync(PROFILE, { recursive: true });

const CATEGORY_TITLECASE: Record<string, string> = {
  "LOCK CHIP": "Lock Chip",
  RATCHET: "Ratchet",
  BLADE: "Blade",
  "OVER BLADE": "Over Blade",
  "ASSIST BLADE": "Assist Blade",
  BIT: "Bit",
};

interface Comp {
  name: string;
  score: number;
  position_change: number | "NEW";
  synergy: never[];
}
interface Cat {
  category: string;
  components: Comp[];
}
interface Period {
  metadata: {
    dataSource: string;
    weekId: string;
    startDate: string;
    endDate: string;
    eventsScanned: number;
    partsAnalyzed: number;
  };
  categories: Cat[];
}

async function scrapePeriod(
  // biome-ignore lint: puppeteer Page type
  page: any,
  periodPath: "2weeks" | "4weeks",
): Promise<Period> {
  await page.goto(`https://bbxweekly.com/${periodPath}`, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
  // franchir le checkpoint si présent
  for (let i = 0; i < 20; i++) {
    const blocked = await page.evaluate(() =>
      /checkpoint|verifying/i.test(document.body?.innerText ?? ""),
    );
    if (!blocked) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  await new Promise((r) => setTimeout(r, 1500));

  const raw = await page.evaluate(() => {
    const knownCats = ["LOCK CHIP", "RATCHET", "BLADE", "OVER BLADE", "ASSIST BLADE", "BIT"];
    const out: {
      category: string;
      comps: { rank: number; name: string; score: number; dir: number; isNew: boolean }[];
    }[] = [];
    let current: (typeof out)[number] | null = null;

    // Parcours en ordre document : titres de catégorie + lignes de rang.
    const nodes = document.querySelectorAll('[data-slot="card-title"], span.min-w-8');
    for (const node of nodes) {
      const slot = node.closest('[data-slot="card-title"]');
      if (slot === node || node.getAttribute?.("data-slot") === "card-title") {
        const label = (node.textContent ?? "").trim().toUpperCase();
        if (knownCats.includes(label)) {
          current = { category: label, comps: [] };
          out.push(current);
        }
        continue;
      }
      // node = span de rang "#N" (+ flèche éventuelle)
      if (!current) continue;
      const rankTxt = (node.textContent ?? "").trim();
      const rankM = rankTxt.match(/#?\s*(\d+)/);
      if (!rankM) continue;
      const rank = parseInt(rankM[1], 10);
      const arrows = node.querySelector("span")?.textContent ?? "";
      const dir = arrows.includes("▲") ? 1 : arrows.includes("▼") ? -1 : 0;
      // remonte à la ligne (contient nom + score)
      const row = node.closest("div.h-14") ?? node.parentElement?.parentElement;
      if (!row) continue;
      const nameEl = row.querySelector(".text-left.font-bold");
      const name = (nameEl?.textContent ?? "").trim();
      if (!name) continue;
      // score = 1er nombre dans le bloc score (sibling du nom)
      const scoreBlock = nameEl?.parentElement?.querySelector(
        ".flex.items-center.gap-2 span, span",
      );
      let score = 0;
      const sTxt = scoreBlock?.textContent?.trim() ?? "";
      const sM = sTxt.match(/(\d+)/);
      if (sM) score = parseInt(sM[1], 10);
      const isNew = /\bNEW\b/i.test(row.textContent ?? "");
      current.comps.push({ rank, name, score, dir, isNew });
    }

    // métadonnées (footer)
    const body = document.body?.innerText ?? "";
    const grab = (re: RegExp) => body.match(re)?.[1]?.trim() ?? "";
    return {
      cats: out,
      meta: {
        weekId: grab(/Week ID\s*([0-9]{4}-W[0-9]{1,2})/i),
        startDate: grab(/Start Date\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i),
        endDate: grab(/End Date\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i),
        eventsScanned: parseInt(grab(/Events?\s*Scanned\s*([0-9]+)/i) || "0", 10),
        partsAnalyzed: parseInt(grab(/Parts?\s*Analyzed\s*([0-9]+)/i) || "0", 10),
      },
    };
  });

  // Le site rend un layout desktop ET mobile → chaque catégorie peut
  // apparaître 2× dans le DOM. On garde la 1ʳᵉ occurrence (desktop, complète).
  type RawCat = {
    category: string;
    comps: { rank: number; name: string; score: number; dir: number; isNew: boolean }[];
  };
  const seen = new Set<string>();
  const categories: Cat[] = [];
  for (const c of raw.cats as RawCat[]) {
    const category = CATEGORY_TITLECASE[c.category] ?? c.category;
    if (seen.has(category)) continue;
    seen.add(category);
    categories.push({
      category,
      components: c.comps
        .sort((a, b) => a.rank - b.rank)
        .map((x) => ({
          name: x.name,
          score: x.score,
          position_change: x.isNew ? ("NEW" as const) : x.dir,
          synergy: [] as never[],
        })),
    });
  }

  return {
    metadata: {
      dataSource: `bbxweekly/${periodPath === "2weeks" ? "14d" : "28d"}`,
      weekId: raw.meta.weekId,
      startDate: raw.meta.startDate,
      endDate: raw.meta.endDate,
      eventsScanned: raw.meta.eventsScanned,
      partsAnalyzed: raw.meta.partsAnalyzed,
    },
    categories,
  };
}

const browser = await puppeteer.launch({
  headless: false,
  executablePath: process.env.CHROME ?? "/usr/local/bin/chromium",
  userDataDir: PROFILE,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1400,1000",
    "--lang=fr-FR,fr",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
await page.setUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
);

const twoWeeks = await scrapePeriod(page, "2weeks");
const fourWeeks = await scrapePeriod(page, "4weeks");
await browser.close();

const result = {
  scrapedAt: new Date().toISOString(),
  periods: { "2weeks": twoWeeks, "4weeks": fourWeeks },
};

const summary = (p: Period) =>
  `${p.metadata.weekId} ${p.metadata.startDate}→${p.metadata.endDate} | ${p.categories.length} cats | ${p.categories.reduce((n: number, c: Cat) => n + c.components.length, 0)} comps | ${p.metadata.eventsScanned} events`;
console.log("[2weeks]", summary(twoWeeks));
console.log("[4weeks]", summary(fourWeeks));
for (const c of fourWeeks.categories)
  console.log(
    `  ${c.category}: ${c.components
      .slice(0, 3)
      .map((x) => `${x.name}(${x.score})`)
      .join(", ")}…`,
  );

if (DRY) {
  console.log("\n[dry] pas d'écriture. JSON valide:", !!result.periods["4weeks"].categories.length);
} else {
  const out = join(process.cwd(), "data", "bbx-weekly.json");
  await Bun.write(out, JSON.stringify(result, null, 2));
  console.log(`\nÉcrit → ${out}`);
}
process.exit(0);
