import "server-only";
import type { GlobalSearchItem } from "@rpbey/api-contract";
import { loadCatalog, computeGroups, groupSlug } from "@/lib/bx-catalog";
import { loadJsonSafe } from "@/lib/data-cache";
import { listParts, listRankings, listTournaments } from "@/server/dal/search";

/**
 * Service de recherche globale — assemble l'index `GlobalSearchItem[]`
 * (produits catalogue, pièces DB, tournois, bladers, lexique).
 * UI-agnostic : aucune dépendance React/MUI. Consommé par `/api/search/global`
 * (legacy) et `/api/v1/search`.
 */

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

  return items;
}
