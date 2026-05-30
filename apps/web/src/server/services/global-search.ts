import "server-only";
import { globalSearch } from "@rpbey/api-client";
import type {
  EnrichedCombo,
  GlobalSearchItem,
  SearchCategory,
  WikiEntity,
} from "@rpbey/api-contract";
import { loadCatalog, computeGroups, groupSlug } from "@/lib/bx-catalog";
import { canonicalKey, lookupTier, type PartType } from "@/lib/beyblade-entity";
import { loadJsonSafe } from "@/lib/data-cache";
import { isRemote, unwrap } from "@/server/data-source";
import { listAnimeSeries, listParts, listRankings, listTournaments } from "@/server/dal/search";
import { listAnimeFramesForIndex } from "@/server/dal/anime";
import { listActiveStaffMembers } from "@/server/dal/cms";

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
    title: "Classement SAtR — Sun After The Reign",
    url: "/tournaments/satr",
    desc: "Classement officiel des Beyblade Battle Tournaments de Sun After the Reign",
  },
  {
    title: "Stardust Séries — Classement RPB Nord",
    url: "/tournaments/stardust",
    desc: "Classement officiel des Stardust Séries, compétition régionale RPB Nord",
  },
  {
    title: "Ultim Bataille — Wild Breakers",
    url: "/tournaments/wb",
    desc: "Classement officiel des Ultim Batailles de Wild Breakers",
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
  {
    title: "Politique de confidentialité",
    url: "/privacy",
    desc: "Confidentialité et conditions d'utilisation de la RPB",
  },
];

// Les tables de tier (blade/ratchet/bit) vivent désormais dans le module canonique
// `@/lib/beyblade-entity` (source unique, ex-dupliquée ici et dans recommendation-engine).

export async function buildGlobalSearchIndex(): Promise<GlobalSearchItem[]> {
  // Standalone (Vercel) : l'index complet est servi par l'API distante (q absent).
  if (isRemote) return unwrap(await globalSearch()).data;

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
        thumbnail: group.cheapest?.image ?? undefined,
        source: "catalog",
      });
    }
  }

  // 2. Pièces (DB).
  const dbParts = await listParts();
  for (const part of dbParts) {
    // Tier via la table canonique partagée (blade/ratchet/bit selon le type).
    const partType =
      part.type === "BLADE" || part.type === "RATCHET" || part.type === "BIT"
        ? (part.type as PartType)
        : undefined;
    const tier = lookupTier(part.name, partType) ?? "C";
    items.push({
      id: `part-${part.id}`,
      title: part.name,
      subtitle: `${part.type} | Tier ${tier}`,
      category: "part",
      url: `/parts`,
      details: `Type: ${part.type} | Poids: ${part.weight ? part.weight + "g" : "non dispo"}`,
      badge: `Tier ${tier}`,
      thumbnail: part.imageUrl ?? undefined,
      source: "db",
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
      source: "db",
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
      source: "db",
      popularity: info.score ?? undefined,
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
      source: "lexicon",
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
      source: "db",
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
      source: "site",
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
      source: "site",
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
  // Décoration méta : `wbo-combos-enriched.json` (produit par enrich-combos.ts) joint
  // les combos aux scores méta WBO + au buzz communauté. On indexe TOUS les combos
  // agrégés (couverture maximale) mais on enrichit le top par qualité (tier, score
  // méta, taux de victoire, buzz) — la couverture ne régresse pas, seul le contexte
  // s'ajoute. Fichier optionnel : sans lui, fallback sur l'agrégat brut (Map vide).
  const enrichedCombos = await loadJsonSafe<{ combos?: EnrichedCombo[] }>(
    "data/wbo-combos-enriched.json",
  );
  const enrichedByLabel = new Map<string, EnrichedCombo>();
  for (const e of enrichedCombos?.combos ?? []) enrichedByLabel.set(e.label.toLowerCase(), e);

  for (const [key, c] of comboMap) {
    const e = enrichedByLabel.get(key);
    if (e) {
      // Combo enrichi : tier + score méta + stats de victoire + buzz dans le rendu,
      // popularité pondérée (fréquence + victoires + score méta) plutôt que fréquence seule.
      const tierTxt = e.tier ? `tier ${e.tier} · ` : "";
      const winTxt = e.winCount > 0 ? ` · ${e.winCount} victoire${e.winCount > 1 ? "s" : ""}` : "";
      const buzzTxt =
        typeof e.bladeCommunityScore === "number" && e.bladeCommunityScore > 0
          ? ` · buzz ${Math.round(e.bladeCommunityScore)}/100`
          : "";
      const metaParts = [
        typeof e.bladeMetaScore === "number" ? `Blade ${e.bladeMetaScore}` : null,
        typeof e.ratchetMetaScore === "number" ? `Ratchet ${e.ratchetMetaScore}` : null,
        typeof e.bitMetaScore === "number" ? `Bit ${e.bitMetaScore}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
      items.push({
        id: `combo-${key}`,
        title: e.label,
        subtitle: `Combo ${tierTxt}score ${e.combinedMetaScore}/100 · vu ${e.count}×${winTxt}`,
        category: "combo",
        url: `/search?q=${encodeURIComponent(e.blade)}`,
        details:
          [
            metaParts ? `Méta ${metaParts}` : "",
            e.topPlayer ? `Top: ${e.topPlayer}${e.topEvent ? ` (${e.topEvent})` : ""}` : "",
            buzzTxt ? `Buzz communauté ${Math.round(e.bladeCommunityScore ?? 0)}/100` : "",
          ]
            .filter(Boolean)
            .join(" — ") || "Combinaison vue en tournoi WBO",
        // "tier S" en badge → bonus de tier capté par le ranker (TIER_BONUS).
        badge: e.tier ? `Combo tier ${e.tier}` : c.best === 1 ? "Combo gagnant" : "Combo",
        source: "wbo",
        popularity: e.count + e.winCount * 4 + Math.round(e.combinedMetaScore / 10),
      });
    } else {
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
        source: "wbo",
        popularity: c.count,
      });
    }
  }

  // Titres déjà indexés (dédup des beys encyclopédiques vs catalogue/pièces).
  const seenTitles = new Set(items.map((i) => i.title.toLowerCase().trim()));
  // Clés canoniques déjà indexées : permet de fusionner un bey encyclopédique avec
  // une pièce DB du même nom écrit différemment (« Dran Sword » ⇔ « dran-sword »).
  // Les titres produits bruités (« Beyblade X BX-34 … ») ont une clé longue qui ne
  // collisionne pas avec un nom de blade propre → dédup conservatrice, sans faux positif.
  const seenKeys = new Set(items.map((i) => canonicalKey(i.title)).filter(Boolean));

  // 10+11. Connaissance wiki (Beyblade Fandom, `crawl-fandom.ts`) — TOUTES générations
  // (Original/Plastic, HMS, Metal, Burst, X) : toupies, pièces, personnages, anime,
  // épisodes, jeux vidéo, accessoires, lore. Ce corpus (~8500 entités classées,
  // image + résumé) SUBSUME les ex-streams universe_beys/characters. Dédup canonique
  // des beys/pièces vs catalogue/DB ; le reste par titre exact.
  for (const it of await loadWikiKnowledge(seenTitles, seenKeys)) items.push(it);

  // 12. Frames d'anime (galerie « Google Images ») — moments marquants taggés perso/épisode/saison.
  const frames = await listAnimeFramesForIndex(3000);
  for (const f of frames) {
    const chars = f.characterNames.join(", ");
    const epLabel = f.episodeNumber ? ` · Ép. ${f.episodeNumber}` : "";
    items.push({
      id: `frame-${f.id}`,
      // Titre propre (série + épisode) — le cast complet (`characterNames` = tag de
      // l'épisode, pas du plan) va dans `details` pour rester cherchable sans polluer
      // le titre de 10 noms identiques sur toutes les frames de l'épisode.
      title: `${f.seriesTitle}${epLabel}`,
      subtitle: `Frame anime${f.generation ? ` · ${f.generation}` : ""}`,
      category: "frame",
      // Lien vers la galerie on-site de la série (recherche par perso/épisode)
      // plutôt que l'URL CDN brute de l'image — garde l'utilisateur sur le site.
      url: f.seriesSlug ? `/anime/${f.seriesSlug}/galerie` : f.imageUrl,
      thumbnail: f.thumbUrl ?? f.imageUrl,
      details: [f.caption?.trim(), chars].filter(Boolean).join(" · ") || undefined,
      badge: "Frame",
      source: "wiki",
    });
  }

  // 12b. Staff RPB (page « Notre équipe ») — membres actifs, cherchables par nom/rôle.
  const staff = await listActiveStaffMembers();
  for (const m of staff) {
    items.push({
      id: `staff-${m.id}`,
      title: m.name,
      subtitle: `Staff RPB${m.role ? ` · ${m.role}` : ""}`,
      category: "blader",
      url: "/notre-equipe",
      details: m.role ? `Membre du staff RPB — ${m.role}` : "Membre du staff RPB",
      badge: "Staff",
      source: "db",
      thumbnail: m.imageUrl ?? undefined,
    });
  }

  // 13. Discussions communautaires (RAG) — X.com (tweets Beyblade triés/nettoyés)
  // + Reddit (r/Beyblade, r/BeybladeX). Corpus exploité par la recherche : le contenu
  // est cherchable plein-texte (texte complet dans `details`, poids BM25F 1).
  for (const d of await loadXDiscussions()) {
    items.push(d);
  }
  for (const d of await loadRedditDiscussions()) {
    items.push(d);
  }
  // Discord : dump exhaustif du salon Beyblade X (+ fils) via scrape-discord-channel.ts.
  for (const d of await loadDiscordDiscussions()) {
    items.push(d);
  }

  // 14. Métagame WBO (tier-list par pièce, fraîche) — `bbx-weekly.json` produit par
  // l'analyse des events organisés. Chaque composant (Blade/Ratchet/Bit/Lock Chip…)
  // porte un score méta 0-100 + ses synergies. Rend la méta du moment cherchable.
  for (const m of await loadMetaTierList()) {
    items.push(m);
  }

  return items;
}

/** Normalise un nom de pièce/blade pour la clé de fusion méta (lowercase,
 * non-alphanum → tiret, trim) — aligné sur le schéma d'id `meta-…`. */
function metaNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Signaux communautaires d'une blade (X + Reddit + web), agrégés hors-DB. */
type CommunitySignal = {
  name: string;
  communityScore: number;
  xEngagement: number;
  redditScore: number;
  xMentions: number;
  redditPosts: number;
};

/** Charge `meta-enrichment.json` (signaux X+Reddit+web par blade) indexé par
 * nom normalisé. Fichier optionnel : aucune erreur s'il manque (Map vide). */
async function loadCommunitySignals(): Promise<Map<string, CommunitySignal>> {
  const data = await loadJsonSafe<{
    blades?: Array<{
      name?: string;
      xMentions?: number;
      xEngagement?: number;
      redditPosts?: number;
      redditScore?: number;
      webHits?: number;
      communityScore?: number;
    }>;
  }>("data/meta-enrichment.json");
  const map = new Map<string, CommunitySignal>();
  for (const b of data?.blades ?? []) {
    const name = (b.name ?? "").trim();
    if (!name) continue;
    map.set(metaNameKey(name), {
      name,
      communityScore: typeof b.communityScore === "number" ? b.communityScore : 0,
      xEngagement: b.xEngagement ?? 0,
      redditScore: b.redditScore ?? 0,
      xMentions: b.xMentions ?? 0,
      redditPosts: b.redditPosts ?? 0,
    });
  }
  return map;
}

/** Phrase lisible de buzz communautaire injectée dans `details` / `subtitle`. */
function communityBlurb(sig: CommunitySignal): string {
  const parts = [`Buzz communauté ${Math.round(sig.communityScore)}/100`];
  if (sig.xEngagement) parts.push(`${sig.xEngagement} likes X`);
  if (sig.redditScore) parts.push(`${sig.redditScore} score Reddit`);
  return parts.join(" · ");
}

/**
 * Tier-list métagame WBO (bbx-weekly, période la plus large dispo) → items uniformes,
 * enrichie des signaux communautaires X+Reddit+web (`meta-enrichment.json`).
 *
 * Fusion du score : la `popularity` méta combine le score compétitif WBO (0-100,
 * placements en tournoi) et le `communityScore` (0-100, buzz X/Reddit/web) en
 * `max(scoreWBO, communityScore)` — on garde le signal le plus fort des deux axes
 * (une blade peut être méta sans buzz, ou virale sans podium) plutôt qu'une moyenne
 * qui diluerait les deux. Le buzz brut reste lisible dans `subtitle`/`details`.
 * Une blade enrichie sans composant WBO « Blade » correspondant devient un item meta
 * communautaire (popularity = communityScore). Dédup par nom normalisé : une blade
 * présente dans les deux sources n'apparaît que sur un seul item meta.
 */
async function loadMetaTierList(): Promise<GlobalSearchItem[]> {
  const [data, community] = await Promise.all([
    loadJsonSafe<{
      periods?: Record<
        string,
        {
          metadata?: { weekId?: string; eventsScanned?: number };
          categories?: Array<{
            category?: string;
            components?: Array<{
              name?: string;
              score?: number;
              synergy?: Array<{ name?: string; score?: number }>;
            }>;
          }>;
        }
      >;
    }>("data/bbx-weekly.json"),
    loadCommunitySignals(),
  ]);
  const periods = data?.periods ?? {};
  // Période la plus large (4weeks > 2weeks) pour un échantillon plus stable.
  const period = periods["4weeks"] ?? periods["2weeks"] ?? Object.values(periods)[0];
  const weekId = period?.metadata?.weekId ?? "";
  const events = period?.metadata?.eventsScanned;
  const out: GlobalSearchItem[] = [];
  // Signaux communautaires consommés lors de la fusion (les restants → items meta dédiés).
  const usedCommunity = new Set<string>();
  for (const cat of period?.categories ?? []) {
    const category = (cat.category ?? "").trim();
    const isBlade = category.toLowerCase() === "blade";
    for (const comp of cat.components ?? []) {
      const name = (comp.name ?? "").trim();
      if (!name) continue;
      const scoreWbo = typeof comp.score === "number" ? comp.score : 0;
      // Fusion : on ne rapproche le buzz communautaire que des composants « Blade »
      // (les signaux enrichis sont par blade, pas par ratchet/bit).
      const key = metaNameKey(name);
      const sig = isBlade ? community.get(key) : undefined;
      if (sig) usedCommunity.add(key);
      const score = sig ? Math.max(scoreWbo, Math.round(sig.communityScore)) : scoreWbo;
      const synergies = (comp.synergy ?? [])
        .filter((s) => s.name)
        .slice(0, 4)
        .map((s) => `${s.name}${typeof s.score === "number" ? ` (${s.score})` : ""}`)
        .join(", ");
      out.push({
        id: `meta-${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: name,
        subtitle: `Méta ${category || "pièce"} · score ${score}/100${
          sig ? ` · ${communityBlurb(sig)}` : ""
        }`,
        category: "meta",
        url: "/meta",
        details:
          [
            `Tier méta${weekId ? ` ${weekId}` : ""}${events ? ` · ${events} events analysés` : ""}`,
            sig ? communityBlurb(sig) : "",
            synergies ? `Synergies : ${synergies}` : "",
          ]
            .filter(Boolean)
            .join(" — ") || undefined,
        badge: "Méta",
        source: sig ? "wbo+community" : "wbo",
        popularity: score,
      });
    }
  }
  // Blades enrichies sans composant WBO « Blade » correspondant : item meta
  // purement communautaire (popularity = communityScore), dédupé par nom normalisé.
  for (const [key, sig] of community) {
    if (usedCommunity.has(key)) continue;
    const score = Math.round(sig.communityScore);
    out.push({
      id: `meta-community-${key}`,
      title: sig.name,
      subtitle: `Méta blade · ${communityBlurb(sig)}`,
      category: "meta",
      url: "/meta",
      details: `Buzz communautaire (X ${sig.xMentions} posts / Reddit ${sig.redditPosts} posts) — ${communityBlurb(
        sig,
      )}`,
      badge: "Méta",
      source: "community",
      popularity: score,
    });
  }
  return out;
}

/** Tronque un texte au mot, pour un titre de résultat lisible. */
function lead(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

const WIKI_GEN_LABEL: Record<string, string> = {
  ORIGINAL: "Original",
  HMS: "HMS",
  METAL: "Metal",
  BURST: "Burst",
  X: "Beyblade X",
};

/**
 * Connaissance wiki (Beyblade Fandom) → items de recherche uniformes, classés par
 * type. Beys/pièces dédupliqués par clé canonique vs catalogue/DB (mute les doublons) ;
 * le reste par titre exact. Mappe le type wiki vers les catégories EXISTANTES du
 * contrat (aucune nouvelle catégorie → onglets de recherche inchangés) : bey/jeu/
 * accessoire → product, personnage/anime/épisode → anime, pièce → part, lore → lexicon.
 */
async function loadWikiKnowledge(
  seenTitles: Set<string>,
  seenKeys: Set<string>,
): Promise<GlobalSearchItem[]> {
  const data = await loadJsonSafe<{ entities?: WikiEntity[] }>("data/beyblade-knowledge.json");
  const out: GlobalSearchItem[] = [];
  for (const e of data?.entities ?? []) {
    const title = e.title.trim();
    if (!title) continue;
    const titleLower = title.toLowerCase();
    if (seenTitles.has(titleLower)) continue;
    const ck = canonicalKey(title);
    // Beys & pièces : fusion canonique avec catalogue/DB (mute le doublon).
    if ((e.type === "bey" || e.type === "part") && ck && seenKeys.has(ck)) continue;

    let category: SearchCategory;
    let badge: string;
    const gen = e.generation ? (WIKI_GEN_LABEL[e.generation] ?? "") : "";
    switch (e.type) {
      case "bey":
        category = "product";
        badge = gen ? `Bey · ${gen}` : "Bey";
        break;
      case "part":
        category = "part";
        badge = gen ? `Pièce · ${gen}` : "Pièce";
        break;
      case "character":
        category = "anime";
        badge = "Personnage";
        break;
      case "anime":
        category = "anime";
        badge = "Anime";
        break;
      case "episode":
        category = "anime";
        badge = "Épisode";
        break;
      case "game":
        category = "product";
        badge = "Jeu vidéo";
        break;
      case "accessory":
        category = "product";
        badge = "Accessoire";
        break;
      default:
        category = "lexicon";
        badge = "Lore";
        break;
    }

    const sub: string[] = [];
    if (e.type === "bey" || e.type === "part") {
      sub.push(gen || "Beyblade");
      if (e.beyType) sub.push(e.beyType);
      else if (e.system) sub.push(e.system);
    } else {
      sub.push(badge);
    }
    if (e.jpName) sub.push(e.jpName);

    seenTitles.add(titleLower);
    if (ck) seenKeys.add(ck);
    out.push({
      id: `wiki-${e.id}`,
      title,
      subtitle: sub.join(" · "),
      category,
      url: e.url,
      // Résumé tronqué (au mot) : l'index complet est fetché côté client par /search —
      // ~8400 entités wiki, donc on borne la charge utile. Le résumé intégral reste
      // dans `beyblade-knowledge.json` (consommé par le graphe d'entités / pages détail).
      details: (e.summary ? lead(e.summary, 220) : "") || `${badge} Beyblade (wiki)`,
      badge,
      thumbnail: e.imageUrl ?? undefined,
      source: "wiki",
    });
  }
  return out;
}

/** Discussions X.com (tweets Beyblade nettoyés/classés) → items uniformes. */
async function loadXDiscussions(): Promise<GlobalSearchItem[]> {
  const data = await loadJsonSafe<{
    discussions?: Array<{
      id: string;
      author: string;
      authorName?: string;
      text: string;
      likes?: number;
      retweets?: number;
      url: string;
      topic?: string;
    }>;
  }>("data/x-discussions.json");
  const out: GlobalSearchItem[] = [];
  for (const d of data?.discussions ?? []) {
    const text = (d.text ?? "").trim();
    if (!text) continue;
    out.push({
      id: `tweet-${d.id}`,
      title: lead(text),
      subtitle: `@${d.author}${d.likes ? ` · ${d.likes} ❤` : ""}`,
      category: "discussion",
      url: d.url,
      details: text,
      badge: "Discussion",
      source: "x",
      popularity: (d.likes ?? 0) + (d.retweets ?? 0) * 2,
    });
  }
  return out;
}

/** Discussions Reddit (r/Beyblade, r/BeybladeX) → items uniformes. Absent tant que
 * le crawler n'a pas tourné (le fichier est optionnel ; aucune erreur si manquant). */
async function loadRedditDiscussions(): Promise<GlobalSearchItem[]> {
  const data = await loadJsonSafe<{
    discussions?: Array<{
      id: string;
      subreddit?: string;
      author?: string;
      title?: string;
      text?: string;
      score?: number;
      comments?: number;
      url: string;
    }>;
  }>("data/reddit-discussions.json");
  const out: GlobalSearchItem[] = [];
  for (const d of data?.discussions ?? []) {
    const title = (d.title ?? "").trim();
    const body = (d.text ?? "").trim();
    if (!title && !body) continue;
    const sub = d.subreddit ? `r/${d.subreddit.replace(/^r\//, "")}` : "Reddit";
    out.push({
      id: `reddit-${d.id}`,
      title: title || lead(body),
      subtitle: `${sub}${d.author ? ` · ${d.author.replace(/^u\//, "u/")}` : ""}`,
      category: "discussion",
      url: d.url,
      details: body || title,
      badge: "Reddit",
      source: "reddit",
      popularity: (d.score ?? 0) + (d.comments ?? 0),
    });
  }
  return out;
}

/** Discussions Discord (dump du salon Beyblade X + fils, `scrape-discord-channel.ts`)
 * → items uniformes. Plafonné pour borner la charge utile de l'index client ; le dump
 * INTÉGRAL reste dans `discord-discussions.json` (consommé tel quel par le RAG). On
 * curate par signal communautaire (réactions) puis récence. */
async function loadDiscordDiscussions(): Promise<GlobalSearchItem[]> {
  const data = await loadJsonSafe<{
    channelName?: string;
    discussions?: Array<{
      id: string;
      author: string;
      authorName?: string;
      text: string;
      url: string;
      channel?: string;
      reactions?: number;
      topic?: string;
      ts?: string;
    }>;
  }>("data/discord-discussions.json");
  const ranked = [...(data?.discussions ?? [])].sort(
    (a, b) => (b.reactions ?? 0) - (a.reactions ?? 0) || (b.ts ?? "").localeCompare(a.ts ?? ""),
  );
  const CAP = 3000;
  const out: GlobalSearchItem[] = [];
  for (const d of ranked.slice(0, CAP)) {
    const text = (d.text ?? "").trim();
    if (!text) continue;
    // Messages image-only (placeholder « [N pièce(s) jointe(s)] ») : aucun texte
    // cherchable → exclus de l'index live (restent dans le dump pour le RAG).
    if (/^\[\d+ pièce/.test(text)) continue;
    const chan = d.channel ?? data?.channelName ?? "beyblade-x";
    out.push({
      id: `discord-${d.id}`,
      title: lead(text),
      subtitle: `#${chan} · ${d.authorName ?? d.author}${d.reactions ? ` · ${d.reactions} ★` : ""}`,
      category: "discussion",
      url: d.url,
      details: text,
      badge: "Discord",
      source: "discord",
      popularity: d.reactions ?? 0,
    });
  }
  return out;
}
