import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { loadCatalog, computeGroups, groupSlug } from "@/lib/bx-catalog";
import { loadJsonSafe } from "@/lib/data-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface GlobalSearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: "product" | "part" | "tournament" | "blader" | "lexicon";
  url: string;
  details?: string;
  badge?: string;
  price?: number | null;
}

// Simple helper to match part tiers
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

export async function GET() {
  try {
    const items: GlobalSearchItem[] = [];

    // 1. Fetch Catalog Products (Groups)
    const catalog = await loadCatalog();
    if (catalog) {
      const groups = computeGroups(catalog);
      for (const group of groups) {
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

    // 2. Fetch Parts from DB
    const dbParts = await db.select().from(schema.parts);
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
        url: `/parts`, // general parts page
        details: `Type: ${part.type} | Poids: ${part.weight ? part.weight + "g" : "non dispo"}`,
        badge: `Tier ${tier}`,
      });
    }

    // 3. Fetch Tournaments from DB
    const dbTournaments = await db.select().from(schema.tournaments);
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

    // 4. Fetch Bladers from rankings (SATR, Stardust, WB)
    const bladersMap = new Map<
      string,
      {
        satrRank?: number;
        stardustRank?: number;
        wbRank?: number;
        score?: number;
      }
    >();

    const [satr, stardust, wb] = await Promise.all([
      db.select().from(schema.satrRankings),
      db.select().from(schema.stardustRankings),
      db.select().from(schema.wbRankings),
    ]);

    for (const row of satr) {
      if (!bladersMap.has(row.playerName)) bladersMap.set(row.playerName, {});
      const entry = bladersMap.get(row.playerName)!;
      entry.satrRank = row.rank;
      entry.score = row.score;
    }

    for (const row of stardust) {
      if (!bladersMap.has(row.playerName)) bladersMap.set(row.playerName, {});
      const entry = bladersMap.get(row.playerName)!;
      entry.stardustRank = row.rank;
    }

    for (const row of wb) {
      if (!bladersMap.has(row.playerName)) bladersMap.set(row.playerName, {});
      const entry = bladersMap.get(row.playerName)!;
      entry.wbRank = row.rank;
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

    // 5. Lexique Beyblade X (termes/glossaire — généré par scrape-reddit.ts)
    const lexique = await loadJsonSafe<{
      terms?: Array<{
        term: string;
        definition: string;
        category: string;
        popularityTier?: string;
      }>;
    }>("data/beyblade-lexique.json");
    for (const t of lexique?.terms ?? []) {
      items.push({
        id: `lexicon-${t.term}`,
        title: t.term,
        subtitle: t.category,
        category: "lexicon",
        url: "",
        details: t.definition,
        badge: t.popularityTier && t.popularityTier !== "Low" ? t.popularityTier : "Lexique",
      });
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error: any) {
    console.error("Global search API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
