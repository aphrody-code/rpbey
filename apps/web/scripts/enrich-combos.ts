#!/usr/bin/env bun
/**
 * enrich-combos.ts — joint les combos gagnants WBO à la méta + au buzz communauté.
 *
 * Le dump `data/wbo-combos.json` (1040 events, 3002 placements) n'est qu'une liste
 * plate de `{blade, ratchet, bit}` par placement : aucun lien vers les scores méta
 * (`bbx-weekly.json`), ni vers le buzz communautaire (`meta-enrichment.json`). Cette
 * fragmentation empêche d'afficher un combo « en contexte » (tier, taux de victoire,
 * popularité sociale). Ce script agrège les combos par libellé, calcule des stats de
 * placement (victoires, top-3, placement moyen), puis **joint** chaque combo à :
 *   - le score méta de chacun de ses composants (Blade/Ratchet/Bit, période 4 semaines),
 *   - un score méta combiné (cf. `combinedComboScore`),
 *   - le score de buzz communautaire de sa blade.
 *
 * Sortie : `data/wbo-combos-enriched.json` (top N par qualité), validée par
 * `EnrichedComboSchema` (@rpbey/api-contract). La jointure CATALOGUE (prix / lien
 * d'achat) se fait côté serveur (entity-graph / global-search) où `bx-catalog` est
 * disponible — ce fichier reste volontairement catalog-agnostic (pas de slug figé).
 *
 *   bun apps/web/scripts/enrich-combos.ts
 */
import {
  canonicalKey,
  combinedComboScore,
  lookupTier,
  type Tier,
} from "../src/lib/beyblade-entity";
import { EnrichedComboSchema, type EnrichedCombo } from "@rpbey/api-contract";

const MAX_OUT = 600;

interface RawCombo {
  blade?: string;
  ratchet?: string;
  bit?: string;
}
interface RawPlacement {
  placement?: number;
  player?: string;
  combos?: RawCombo[];
}
interface RawEvent {
  name?: string;
  placements?: RawPlacement[];
}

/** Écarte les libellés bruités (URLs, fragments de parse) des champs name/player. */
function cleanMeta(s: string | undefined): string {
  const v = (s ?? "").trim();
  if (!v || v.length > 80) return "";
  if (/https?:|challonge|\bwrote:|tournament page|^final stage\b|format$|^round\b/i.test(v))
    return "";
  return v;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return (await Bun.file(path).json()) as T;
  } catch {
    return null;
  }
}

/** Map clé canonique → score méta (0-100) pour une catégorie de composant. */
function scoreMap(
  period:
    | {
        categories?: Array<{
          category?: string;
          components?: Array<{ name?: string; score?: number }>;
        }>;
      }
    | undefined,
  cat: string,
): Map<string, number> {
  const m = new Map<string, number>();
  const c = (period?.categories ?? []).find((x) => (x.category ?? "").toLowerCase() === cat);
  for (const comp of c?.components ?? []) {
    const k = canonicalKey(comp.name);
    if (k && typeof comp.score === "number") m.set(k, comp.score);
  }
  return m;
}

interface Agg {
  label: string;
  blade: string;
  ratchet: string | null;
  bit: string | null;
  count: number;
  winCount: number; // placements === 1
  top3Count: number; // placements 1..3
  placementSum: number;
  bestPlacement: number;
  topPlayer: string;
  topEvent: string;
}

async function main() {
  const combos = await readJson<{ events?: RawEvent[] }>("data/wbo-combos.json");
  if (!combos?.events?.length) {
    console.error("[enrich-combos] data/wbo-combos.json introuvable ou vide");
    process.exit(1);
  }
  const weekly = await readJson<{
    periods?: Record<
      string,
      {
        metadata?: { weekId?: string };
        categories?: Array<{
          category?: string;
          components?: Array<{ name?: string; score?: number }>;
        }>;
      }
    >;
  }>("data/bbx-weekly.json");
  const period = weekly?.periods?.["4weeks"] ?? weekly?.periods?.["2weeks"];
  const weekId = period?.metadata?.weekId ?? "";
  const bladeScores = scoreMap(period, "blade");
  const ratchetScores = scoreMap(period, "ratchet");
  const bitScores = scoreMap(period, "bit");

  const community = await readJson<{ blades?: Array<{ name?: string; communityScore?: number }> }>(
    "data/meta-enrichment.json",
  );
  const communityScores = new Map<string, number>();
  for (const b of community?.blades ?? []) {
    const k = canonicalKey(b.name);
    if (k && typeof b.communityScore === "number") communityScores.set(k, b.communityScore);
  }

  // 1. Agrégation par libellé de combo.
  const agg = new Map<string, Agg>();
  for (const ev of combos.events) {
    const evName = cleanMeta(ev.name);
    for (const pl of ev.placements ?? []) {
      const player = cleanMeta(pl.player);
      const placement = typeof pl.placement === "number" ? pl.placement : 99;
      for (const c of pl.combos ?? []) {
        const blade = (c.blade ?? "").trim();
        if (!blade) continue;
        const ratchet = (c.ratchet ?? "").trim() || null;
        const bit = (c.bit ?? "").trim() || null;
        const label = [blade, ratchet, bit].filter(Boolean).join(" ");
        const key = label.toLowerCase();
        const ex = agg.get(key);
        if (ex) {
          ex.count++;
          ex.placementSum += placement;
          if (placement === 1) ex.winCount++;
          if (placement <= 3) ex.top3Count++;
          if (placement < ex.bestPlacement) {
            ex.bestPlacement = placement;
            ex.topPlayer = player || ex.topPlayer;
            ex.topEvent = evName || ex.topEvent;
          }
        } else {
          agg.set(key, {
            label,
            blade,
            ratchet,
            bit,
            count: 1,
            winCount: placement === 1 ? 1 : 0,
            top3Count: placement <= 3 ? 1 : 0,
            placementSum: placement,
            bestPlacement: placement,
            topPlayer: player,
            topEvent: evName,
          });
        }
      }
    }
  }

  // 2. Enrichissement méta + communauté + score qualité.
  const enriched: EnrichedCombo[] = [];
  for (const a of agg.values()) {
    const bladeKey = canonicalKey(a.blade);
    const bladeMetaScore = bladeScores.get(bladeKey) ?? null;
    const ratchetMetaScore = a.ratchet
      ? (ratchetScores.get(canonicalKey(a.ratchet)) ?? null)
      : null;
    const bitMetaScore = a.bit ? (bitScores.get(canonicalKey(a.bit)) ?? null) : null;
    const combinedMetaScore = combinedComboScore(bladeMetaScore, ratchetMetaScore, bitMetaScore);
    const bladeCommunityScore = communityScores.get(bladeKey) ?? null;
    const winRate = a.count > 0 ? a.winCount / a.count : 0;
    // Tier du combo : depuis le score méta combiné si dispo, sinon le tier de la blade.
    // Seuils resserrés (S ≥ 92) — un libellé « S-tier » doit rester rare et signifiant
    // même parmi les meilleurs combos (le tri fin reste porté par qualityScore).
    let tier: Tier | null = null;
    if (combinedMetaScore >= 92) tier = "S";
    else if (combinedMetaScore >= 80) tier = "A";
    else if (combinedMetaScore >= 60) tier = "B";
    else if (combinedMetaScore > 0) tier = "C";
    else tier = lookupTier(a.blade, "BLADE");

    // Score qualité : méta combinée (0-50) + fréquence log (0-25) + taux de victoire (0-25).
    const qualityScore = Math.round(
      0.5 * combinedMetaScore +
        25 * Math.min(1, Math.log10(1 + a.count) / Math.log10(21)) +
        25 * winRate,
    );

    enriched.push({
      label: a.label,
      blade: a.blade,
      ratchet: a.ratchet,
      bit: a.bit,
      bladeKey,
      count: a.count,
      winCount: a.winCount,
      top3Count: a.top3Count,
      bestPlacement: a.bestPlacement === 99 ? null : a.bestPlacement,
      avgPlacement: Math.round((a.placementSum / a.count) * 10) / 10,
      topPlayer: a.topPlayer || null,
      topEvent: a.topEvent || null,
      bladeMetaScore,
      ratchetMetaScore,
      bitMetaScore,
      combinedMetaScore,
      bladeCommunityScore,
      tier,
      qualityScore,
    });
  }

  // 3. Tri par qualité décroissante, top N.
  enriched.sort((x, y) => y.qualityScore - x.qualityScore || y.count - x.count);
  const top = enriched.slice(0, MAX_OUT);

  // Validation contrat (échoue tôt si une ligne dérive).
  for (const c of top) EnrichedComboSchema.parse(c);

  const out = {
    generatedAt: new Date().toISOString(),
    source: "wbo-combos + bbx-weekly + meta-enrichment",
    weekId,
    totalCombos: agg.size,
    count: top.length,
    combos: top,
  };
  await Bun.write("data/wbo-combos-enriched.json", JSON.stringify(out, null, 2));

  const withMeta = top.filter((c) => c.combinedMetaScore > 0).length;
  const sTier = top.filter((c) => c.tier === "S").length;
  console.log(
    `[enrich-combos] ${agg.size} combos uniques → top ${top.length} écrits.\n` +
      `  avec score méta : ${withMeta}/${top.length} · S-tier : ${sTier} · weekId : ${weekId || "?"}`,
  );
  console.log("  top 5 :");
  for (const c of top.slice(0, 5)) {
    console.log(
      `    ${c.label.padEnd(34)} q=${c.qualityScore} méta=${c.combinedMetaScore} tier=${c.tier} vu ${c.count}× (${c.winCount} W)`,
    );
  }
}

await main();
