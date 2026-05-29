#!/usr/bin/env bun
/**
 * Construit `data/beyblade-sites.json` — catalogue complet des sites Beyblade du monde.
 *
 * Phase 1 (ce script) : agrège TOUT ce que rpbey utilise déjà — les 118 boutiques de
 * `bx-catalog.json` (métadonnées riches : région, type, plateforme, devise) + un seed
 * curé des hubs mondiaux non-boutique (officiels, wiki/DB, meta, communauté, tournois).
 * Dédupliqué par domaine. Sortie typée, écriture non-destructive (préserve si vide).
 *
 * Phase 2 (agent bxc récursif + aphrody MCP) : enrichit ce JSON avec les sites
 * découverts (recherche Google bxc_search + fetch + crawl récursif des liens),
 * en fusionnant par domaine sans écraser les entrées rpbey (source "rpbey" prioritaire).
 *
 * Usage : bun apps/web/scripts/build-beyblade-sites.ts
 */

const DATA = new URL("../data/", import.meta.url).pathname;
const OUT = `${DATA}beyblade-sites.json`;

export type SiteCategory =
  | "shop"
  | "marketplace"
  | "official"
  | "manufacturer"
  | "wiki"
  | "database"
  | "meta"
  | "community"
  | "tournament"
  | "social"
  | "news";

export interface BeybladeSite {
  name: string;
  url: string;
  domain: string;
  category: SiteCategory;
  region?: string;
  type?: string;
  platform?: string;
  currency?: string;
  productCount?: number;
  lang?: string;
  sources: string[];
}

// Type bx-catalog shop → catégorie du catalogue de sites.
function shopCategory(type?: string): SiteCategory {
  switch (type) {
    case "marketplace":
      return "marketplace";
    case "official":
      return "official";
    case "import":
      return "marketplace";
    default:
      return "shop"; // specialist | retailer | autre
  }
}

// Seed curé — hubs Beyblade mondiaux NON-boutique (référencés/utilisés par rpbey).
const SEED: BeybladeSite[] = [
  // Officiels / fabricants
  {
    name: "Beyblade Official (Hasbro)",
    url: "https://beyblade.com",
    domain: "beyblade.com",
    category: "official",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "Beyblade Shop (Hasbro)",
    url: "https://shop.beyblade.com",
    domain: "shop.beyblade.com",
    category: "official",
    region: "US",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "Hasbro Pulse",
    url: "https://shop.hasbro.com",
    domain: "shop.hasbro.com",
    category: "manufacturer",
    region: "US",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "Takara Tomy Beyblade X (officiel JP)",
    url: "https://beyblade.takaratomy.co.jp",
    domain: "beyblade.takaratomy.co.jp",
    category: "official",
    region: "JP",
    lang: "ja",
    sources: ["rpbey"],
  },
  {
    name: "Takara Tomy Mall",
    url: "https://takaratomymall.jp/shop/c/cBeyX/",
    domain: "takaratomymall.jp",
    category: "official",
    region: "JP",
    lang: "ja",
    sources: ["rpbey"],
  },
  // Wiki / bases de données
  {
    name: "Beyblade Wiki (Fandom)",
    url: "https://beyblade.fandom.com/wiki/Beyblade_X",
    domain: "beyblade.fandom.com",
    category: "wiki",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "Beyblade Planner",
    url: "https://beybladeplanner.com",
    domain: "beybladeplanner.com",
    category: "database",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  // Méta / stats
  {
    name: "Beyblade Weekly (méta WBO)",
    url: "https://bbxweekly.com/2weeks",
    domain: "bbxweekly.com",
    category: "meta",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  // Communauté / tournois
  {
    name: "World Beyblade Organization",
    url: "https://worldbeyblade.org",
    domain: "worldbeyblade.org",
    category: "community",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "Challonge (brackets)",
    url: "https://challonge.com",
    domain: "challonge.com",
    category: "tournament",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
  {
    name: "r/BeybladeX (Reddit)",
    url: "https://www.reddit.com/r/BeybladeX/",
    domain: "reddit.com",
    category: "community",
    region: "INT",
    lang: "en",
    sources: ["rpbey"],
  },
];

async function main() {
  const catalog = await Bun.file(`${DATA}bx-catalog.json`).json();
  const shops: Array<Record<string, unknown>> = catalog.shops ?? [];

  const byDomain = new Map<string, BeybladeSite>();

  // 1. Boutiques du catalogue (source de vérité riche).
  for (const s of shops) {
    const domain = String(s.domain ?? "").toLowerCase();
    if (!domain) continue;
    byDomain.set(domain, {
      name: String(s.name ?? domain),
      url: String(s.url ?? `https://${domain}`),
      domain,
      category: shopCategory(s.type as string | undefined),
      region: s.region as string | undefined,
      type: s.type as string | undefined,
      platform: s.platform as string | undefined,
      currency: s.currency as string | undefined,
      productCount: typeof s.productCount === "number" ? s.productCount : undefined,
      sources: Array.isArray(s.sources) ? (s.sources as string[]) : ["rpbey"],
    });
  }

  // 2. Seed curé (n'écrase pas une boutique déjà présente).
  for (const site of SEED) {
    if (!byDomain.has(site.domain)) byDomain.set(site.domain, site);
  }

  const sites = [...byDomain.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );

  const byCat: Record<string, number> = {};
  for (const s of sites) byCat[s.category] = (byCat[s.category] ?? 0) + 1;

  if (sites.length === 0) {
    console.error("0 site → sortie préservée (non-destructif).");
    process.exit(2);
  }

  await Bun.write(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: sites.length,
        byCategory: byCat,
        sites,
      },
      null,
      2,
    ),
  );
  console.log(`✓ ${sites.length} sites → ${OUT}`);
  console.log("par catégorie :", byCat);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
