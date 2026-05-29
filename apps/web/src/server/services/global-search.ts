import "server-only";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import { loadCatalog, computeGroups, groupSlug } from "@/lib/bx-catalog";
import { loadJsonSafe } from "@/lib/data-cache";
import { listAnimeSeries, listParts, listRankings, listTournaments } from "@/server/dal/search";

/**
 * Service de recherche globale — assemble l'index `GlobalSearchItem[]`
 * (produits catalogue, pièces DB, tournois, bladers, lexique, anime, sites, pages).
 * UI-agnostic : aucune dépendance React/MUI. Consommé par `/api/search/global`
 * (legacy) et `/api/v1/search`.
 */

// Pages/sections du site rpbey.fr — entrées de navigation indexées (catégorie "page").
const SITE_PAGES: Array<{ title: string; url: string; desc: string }> = [
  {
    title: "Comparateur de prix Beyblade X",
    url: "/comparateur",
    desc: "Prix en direct, multi-boutiques",
  },
  {
    title: "Recherche",
    url: "/search",
    desc: "Moteur de recherche Beyblade",
  },
  {
    title: "Builder de combo",
    url: "/builder",
    desc: "Construis et analyse ton combo",
  },
  {
    title: "Tournois",
    url: "/tournaments",
    desc: "Brackets, résultats, calendrier",
  },
  {
    title: "Classements",
    url: "/rankings",
    desc: "SATR, Stardust, World Beyblade",
  },
  {
    title: "Pièces Beyblade X",
    url: "/parts",
    desc: "Base de données des pièces et tiers",
  },
  {
    title: "Anime Beyblade",
    url: "/anime",
    desc: "Séries et épisodes en streaming",
  },
  {
    title: "Méta du moment",
    url: "/meta",
    desc: "Tier list et analyse compétitive",
  },
  { title: "Notre équipe", url: "/notre-equipe", desc: "Le staff de la RPB" },
  { title: "RPB TV", url: "/tv", desc: "Live et streams de la communauté" },
  {
    title: "Règlement",
    url: "/reglement",
    desc: "Règles des tournois et de la communauté",
  },
];

const BLADE_TIERS: Record<string, string> = {
  "wizard rod": "S",
  "phoenix wing": "S",
  "cobalt dragoon": "S",
  "shark edge": "A",
  "shark scale": "A",
  "dran buster": "A",
  "tyranno beat": "A",
  "hells chain": "A",
  "hells scythe": "B",
  "unicorn sting": "B",
  "weiss tiger": "B",
  "knight shield": "B",
  "dran sword": "B",
  "knight lance": "B",
  "leon claw": "B",
  "viper tail": "B",
};

export async function buildGlobalSearchIndex(): Promise<GlobalSearchItem[]> {
  const items: GlobalSearchItem[] = [];

  // 1. Produits du catalogue (groupés).
  const catalog = await loadCatalog();
  if (catalog) {
    for (const group of computeGroups(catalog)) {
      const slug = groupSlug(group);
      items.push({
        id: `group-${group.key}`,
        title: group.name,
        subtitle: group.code ? `${group.code}` : "Produit",
        category: "product",
        url: `/comparateur/${slug}`,
        details: group.cheapestEur
          ? `Meilleur prix: ${group.cheapestEur.toFixed(2)}€`
          : "Prix non dispo",
        badge: group.code || undefined,
        price: group.cheapestEur,
      });
    }
  }

  // 2. Pièces (DB).
  const dbParts = await listParts();
  for (const part of dbParts) {
    const nameLower = part.name.toLowerCase();
    let tier = "C";
    for (const [key, value] of Object.entries(BLADE_TIERS)) {
      if (nameLower.includes(key) || key.includes(nameLower)) {
        tier = value;
        break;
      }
    }
    items.push({
      id: `part-${part.id}`,
      title: part.name,
      subtitle: `${part.type} | Tier ${tier}`,
      category: "part",
      url: `/parts`,
      details: `Type: ${part.type} | Poids: ${part.weight ? part.weight + "g" : "non dispo"}`,
      badge: `Tier ${tier}`,
    });
  }

  // 3. Tournois (DB).
  const dbTournaments = await listTournaments();
  for (const t of dbTournaments) {
    const dateStr = t.date ? new Date(t.date).toLocaleDateString("fr-FR") : "";
    items.push({
      id: `tournament-${t.id}`,
      title: t.name,
      subtitle: `${t.location || "Online"} - ${dateStr}`,
      category: "tournament",
      url: `/tournaments/${t.id}`,
      details: `Statut: ${t.status} | Format: ${t.format}`,
      badge: t.status,
    });
  }

  // 4. Bladers (rankings SATR / Stardust / WB).
  const { satr, stardust, wb } = await listRankings();
  const bladersMap = new Map<
    string,
    {
      satrRank?: number;
      stardustRank?: number;
      wbRank?: number;
      score?: number;
    }
  >();
  for (const row of satr) {
    const entry = bladersMap.get(row.playerName) ?? {};
    entry.satrRank = row.rank;
    entry.score = row.score;
    bladersMap.set(row.playerName, entry);
  }
  for (const row of stardust) {
    const entry = bladersMap.get(row.playerName) ?? {};
    entry.stardustRank = row.rank;
    bladersMap.set(row.playerName, entry);
  }
  for (const row of wb) {
    const entry = bladersMap.get(row.playerName) ?? {};
    entry.wbRank = row.rank;
    bladersMap.set(row.playerName, entry);
  }
  for (const [name, info] of bladersMap.entries()) {
    const rankDetails = [
      info.satrRank ? `SATR: #${info.satrRank}` : null,
      info.stardustRank ? `Stardust: #${info.stardustRank}` : null,
      info.wbRank ? `WB: #${info.wbRank}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    items.push({
      id: `blader-${name}`,
      title: name,
      subtitle: rankDetails || "Blader Enregistré",
      category: "blader",
      url: `/rankings`,
      details: info.score ? `Score de saison: ${info.score} pts` : "Blader compétitif",
      badge: "Blader",
    });
  }

  // 5. Lexique Beyblade X (généré par scrape-reddit.ts).
  const lexique = await loadJsonSafe<{
    terms?: Array<{
      term: string;
      definition: string;
      category: string;
      popularityTier?: string;
    }>;
  }>("data/beyblade-lexique.json");
  for (const term of lexique?.terms ?? []) {
    items.push({
      id: `lexicon-${term.term}`,
      title: term.term,
      subtitle: term.category,
      category: "lexicon",
      url: "",
      details: term.definition,
      badge: term.popularityTier && term.popularityTier !== "Low" ? term.popularityTier : "Lexique",
    });
  }

  // 6. Anime (séries publiées).
  const series = await listAnimeSeries();
  for (const s of series) {
    if (s.isPublished === false) continue;
    const titleFr = s.titleFr && s.titleFr !== s.title ? ` (${s.titleFr})` : "";
    items.push({
      id: `anime-${s.id}`,
      title: s.title,
      subtitle: `Anime${s.year ? ` · ${s.year}` : ""}${s.generation ? ` · ${s.generation}` : ""}${titleFr}`,
      category: "anime",
      url: `/anime/${s.slug}`,
      details:
        s.synopsis ?? `Série Beyblade${s.episodeCount ? ` · ${s.episodeCount} épisodes` : ""}`,
      badge: "Anime",
    });
  }

  // 7. Sites Beyblade du monde (catalogue curé, JSON).
  const sitesData = await loadJsonSafe<{
    sites?: Array<{
      name: string;
      url: string;
      domain: string;
      category: string;
      region?: string;
      lang?: string;
    }>;
  }>("data/beyblade-sites.json");
  for (const site of sitesData?.sites ?? []) {
    items.push({
      id: `site-${site.domain}`,
      title: site.name,
      subtitle: `${site.category}${site.region ? ` · ${site.region}` : ""}`,
      category: "site",
      url: site.url,
      details: site.domain,
      badge: "Site",
    });
  }

  // 8. Pages / sections du site.
  for (const page of SITE_PAGES) {
    items.push({
      id: `page-${page.url}`,
      title: page.title,
      subtitle: "Page rpbey.fr",
      category: "page",
      url: page.url,
      details: page.desc,
      badge: "Page",
    });
  }

  // 9. Combos gagnants (WBO — agrégés par fréquence + meilleur placement).
  const combosData = await loadJsonSafe<{
    events?: Array<{
      name?: string;
      placements?: Array<{
        placement?: number;
        player?: string;
        combos?: Array<{ blade?: string; ratchet?: string; bit?: string }>;
      }>;
    }>;
  }>("data/wbo-combos.json");
  const comboMap = new Map<
    string,
    {
      label: string;
      blade: string;
      count: number;
      best: number;
      player: string;
      event: string;
    }
  >();
  // Le dump Wayback contient ~15-20 % de name/player bruités (URLs challonge,
  // "Final Stage - Deck Format", "Tournament Page: …") issus du parse best-effort.
  // On les écarte de l'affichage (ligne "Top: …") sans jeter le combo lui-même.
  const cleanMeta = (s: string | undefined): string => {
    const v = (s ?? "").trim();
    if (!v || v.length > 80) return "";
    if (/https?:|challonge|\bwrote:|tournament page|^final stage\b|format$|^round\b/i.test(v)) {
      return "";
    }
    return v;
  };
  for (const ev of combosData?.events ?? []) {
    const evName = cleanMeta(ev.name);
    for (const pl of ev.placements ?? []) {
      const player = cleanMeta(pl.player);
      for (const c of pl.combos ?? []) {
        const blade = (c.blade ?? "").trim();
        if (!blade) continue;
        const label = [blade, (c.ratchet ?? "").trim(), (c.bit ?? "").trim()]
          .filter(Boolean)
          .join(" ");
        const key = label.toLowerCase();
        const placement = typeof pl.placement === "number" ? pl.placement : 99;
        const ex = comboMap.get(key);
        if (ex) {
          ex.count++;
          if (placement < ex.best) {
            ex.best = placement;
            ex.player = player || ex.player;
            ex.event = evName || ex.event;
          }
        } else {
          comboMap.set(key, {
            label,
            blade,
            count: 1,
            best: placement,
            player,
            event: evName,
          });
        }
      }
    }
  }
  for (const [key, c] of comboMap) {
    items.push({
      id: `combo-${key}`,
      title: c.label,
      subtitle: `Combo méta · vu ${c.count}×${c.best === 1 ? " · gagnant" : ""}`,
      category: "combo",
      url: `/search?q=${encodeURIComponent(c.blade)}`,
      details: c.player
        ? `Top: ${c.player}${c.event ? ` (${c.event})` : ""}`
        : "Combinaison vue en tournoi WBO",
      badge: c.best === 1 ? "Combo gagnant" : "Combo",
    });
  }

  // Titres déjà indexés (dédup des beys encyclopédiques vs catalogue/pièces).
  const seenTitles = new Set(items.map((i) => i.title.toLowerCase().trim()));

  // 10. Beys encyclopédiques — TOUTES générations (Bakuten, Metal, Burst, X).
  const universeBeys = await loadJsonSafe<
    Array<{
      title?: string;
      url?: string;
      summary?: string;
      metadata?: { JPName?: string };
    }>
  >("data/universe_beys.json");
  for (const bey of universeBeys ?? []) {
    const title = (bey.title ?? "").trim();
    if (!title || seenTitles.has(title.toLowerCase())) continue;
    seenTitles.add(title.toLowerCase());
    const jp = bey.metadata?.JPName
      ? ` · ${bey.metadata.JPName.replace(/\{\{[^}]*\}\}/g, "")}`
      : "";
    items.push({
      id: `bey-${title}`,
      title,
      subtitle: `Beyblade${jp}`,
      category: "product",
      url: bey.url || `/search?q=${encodeURIComponent(title)}`,
      details: bey.summary?.trim() || "Toupie Beyblade (encyclopédie, toutes générations)",
      badge: "Bey",
    });
  }

  // 11. Personnages d'anime/manga Beyblade (toutes séries).
  const universeChars = await loadJsonSafe<
    Array<{
      title?: string;
      url?: string;
      summary?: string;
      metadata?: { JPName?: string; Occupation?: string };
    }>
  >("data/universe_characters.json");
  for (const ch of universeChars ?? []) {
    const title = (ch.title ?? "").trim();
    if (!title) continue;
    items.push({
      id: `char-${title}`,
      title,
      subtitle: `Personnage${ch.metadata?.Occupation ? ` · ${ch.metadata.Occupation}` : ""}`,
      category: "anime",
      url: ch.url || `/search?q=${encodeURIComponent(title)}`,
      details: ch.summary?.trim() || "Personnage de l'univers Beyblade",
      badge: "Personnage",
    });
  }

  return items;
}
