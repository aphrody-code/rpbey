#!/usr/bin/env bun
/**
 * Scrape la BeybladeX library depuis beyblade.fandom.com → data/beyblade-library-scraped.json.
 *
 * Les PAGES wiki (https://beyblade.fandom.com/wiki/…) sont derrière un challenge
 * Cloudflare "Just a moment…" infranchissable one-shot depuis l'IP datacenter du VPS.
 * MAIS l'API MediaWiki (`/api.php`) répond en 200 JSON via le profil `http`
 * (curl-impersonate, TLS-fingerprint Chrome) SANS challenge — on passe donc par l'API.
 *
 * Pipeline :
 *   1. categorymembers de "Category:Beyblade X Parts" → toutes les pièces (titre préfixé
 *      par le type : "Blade - …", "Bit - …", "Ratchet - …", "Lock Chip - …",
 *      "Assist Blade - …", "Main Blade - …").
 *   2. revisions (wikitext) batché par 50 → parse du `{{Part Infobox}}`
 *      (Name, JPName, Classification, Type, SpinDirection, Weight, System,
 *       AttackStat/DefenseStat/StaminaStat, Image, ProductCode).
 *   3. imageinfo batché → URL absolue des fichiers d'image.
 *   4. validation Zod (PartImportSchema) + écriture non-destructive.
 *
 * NE TOUCHE PAS master-parts.json ni bey-library/ (sortie dédiée).
 *
 *   cd apps/web && bun scripts/scrape-beyblade-library.ts
 */
import { join } from "node:path";
import { PartImportSchema, type PartImport } from "@rpbey/api-contract";
import {
  closeBrowser,
  fetchSource,
  validateRecords,
  writeIfNonEmpty,
} from "./lib/ghost-scraper.ts";

const API = "https://beyblade.fandom.com/api.php";
const ROOT_CATEGORY = "Category:Beyblade X Parts";
const OUT = join(process.cwd(), "data", "beyblade-library-scraped.json");

/** Préfixe de titre fandom → enum de type du contrat (table `parts`). */
const TYPE_PREFIX: { prefix: string; type: PartImport["type"] }[] = [
  { prefix: "Assist Blade - ", type: "ASSIST_BLADE" },
  { prefix: "Lock Chip - ", type: "LOCK_CHIP" },
  { prefix: "Over Blade - ", type: "OVER_BLADE" },
  { prefix: "Main Blade - ", type: "BLADE" }, // Main Blade (système CX) = corps blade
  { prefix: "Blade - ", type: "BLADE" },
  { prefix: "Ratchet - ", type: "RATCHET" },
  { prefix: "Bit - ", type: "BIT" },
];

const BEY_TYPE: Record<string, PartImport["beyType"]> = {
  attack: "ATTACK",
  defense: "DEFENSE",
  stamina: "STAMINA",
  balance: "BALANCE",
};

async function apiJson(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  const r = await fetchSource(`${API}?${qs}`, {
    profile: "http",
    retries: 3,
    minHtmlLength: 10,
  });
  if (!r) throw new Error(`API MediaWiki injoignable (${qs.slice(0, 80)})`);
  // Le profil http renvoie du JSON brut ; certains proxys l'enrobent dans <pre> → on dénude.
  const body = r.html.includes("<pre>")
    ? (r.html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? r.html)
    : r.html;
  return JSON.parse(body);
}

/** Tous les membres (pages) d'une catégorie, avec pagination cmcontinue. */
async function categoryPages(cat: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const j = await apiJson({
      action: "query",
      list: "categorymembers",
      cmtitle: cat,
      cmtype: "page",
      cmlimit: "500",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const m of j.query?.categorymembers ?? []) titles.push(m.title);
    cont = j.continue?.cmcontinue;
  } while (cont);
  return titles;
}

/** wikitext de chaque page, batché par 50 titres (limite MediaWiki). */
async function wikitexts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await apiJson({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: batch.join("|"),
    });
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const rev = p.revisions?.[0];
      const content = rev?.slots?.main?.["*"] ?? rev?.["*"];
      if (p.title && content) out.set(p.title, content);
    }
  }
  return out;
}

/** URL absolue de chaque fichier image, batché par 50. */
async function imageUrls(files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(files.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50).map((f) => `File:${f}`);
    const j = await apiJson({
      action: "query",
      prop: "imageinfo",
      iiprop: "url",
      titles: batch.join("|"),
    });
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const url = p.imageinfo?.[0]?.url;
      const file = (p.title ?? "").replace(/^File:/, "");
      if (file && url) out.set(file, url);
    }
  }
  return out;
}

/** Parse les paires |Key=Value du template {{Part Infobox}}. */
function parseInfobox(wikitext: string): Record<string, string> | null {
  const m = wikitext.match(/\{\{Part Infobox([\s\S]*?)\n\}\}/);
  if (!m) return null;
  const fields: Record<string, string> = {};
  // Découpe sur les "|Key=" en début de ligne (les valeurs peuvent contenir <br>).
  const re = /\n\|([A-Za-z0-9]+)=([^\n]*)/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(m[1])) !== null) fields[mm[1].trim()] = mm[2].trim();
  return fields;
}

/** "34.6 grams (first mold)<br>35.1 grams …" → 34.6 (premier poids cité). */
function parseWeight(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*gram/i) ?? raw.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function typeFromTitle(title: string): PartImport["type"] | null {
  for (const { prefix, type } of TYPE_PREFIX) if (title.startsWith(prefix)) return type;
  return null;
}

async function main() {
  console.log(`Recon: API MediaWiki fandom (profil http) — categorymembers ${ROOT_CATEGORY}`);
  const titles = await categoryPages(ROOT_CATEGORY);
  console.log(`  ${titles.length} pages de pièces listées.`);
  if (titles.length === 0) throw new Error("0 page — catégorie vide ou API bloquée.");

  const texts = await wikitexts(titles);
  console.log(`  ${texts.size} wikitexts récupérés.`);

  // 1ʳᵉ passe : parse les infobox, collecte les noms de fichiers image.
  const staged: {
    title: string;
    type: PartImport["type"];
    ib: Record<string, string>;
  }[] = [];
  for (const title of titles) {
    const type = typeFromTitle(title);
    if (!type) continue;
    const wt = texts.get(title);
    if (!wt) continue;
    const ib = parseInfobox(wt);
    if (!ib) continue;
    staged.push({ title, type, ib });
  }

  const imgs = await imageUrls(staged.map((s) => s.ib.Image));
  console.log(`  ${imgs.size} URLs d'image résolues.`);

  const raw = staged.map(({ title, type, ib }) => {
    const name = (ib.Name || title.split(" - ").slice(1).join(" - ")).trim();
    const typeRaw = (ib.Type || "").toLowerCase();
    const product = (ib.ProductCode || "")
      .split("<br>")[0]
      .replace(/\s*\(.*?\)/, "")
      .trim();
    const rec: PartImport = {
      externalId: title.replace(/\s+/g, "_"), // identifiant stable = titre wiki normalisé
      name,
      type,
      nameJp: ib.JPName || undefined,
      beyType: BEY_TYPE[typeRaw] ?? undefined,
      weight: parseWeight(ib.Weight),
      attack: ib.AttackStat || undefined,
      defense: ib.DefenseStat || undefined,
      stamina: ib.StaminaStat || undefined,
      // burst/dash absents de fandom (métriques BBX-weekly) → non renseignés.
      height: ib.HeightStat ? Number(ib.HeightStat) : undefined,
      imageUrl: imgs.get(ib.Image) || undefined,
      spinDirection: ib.SpinDirection || undefined,
      system: ib.System || undefined,
      rarity: product || undefined, // code produit (BX-01…) faute de rareté chez fandom
    };
    return rec;
  });

  const report = validateRecords(raw, PartImportSchema);
  console.log(`\nValides: ${report.valid.length} | rejetés: ${report.invalid}`);
  if (report.invalid > 0) console.warn(`  rejets: ${report.errors.join(" · ")}`);

  const byType: Record<string, number> = {};
  for (const p of report.valid) byType[p.type] = (byType[p.type] ?? 0) + 1;
  console.log("  par type:", byType);
  console.log("  exemple:", JSON.stringify(report.valid[0]));

  await writeIfNonEmpty(
    OUT,
    {
      scrapedAt: new Date().toISOString(),
      source: "beyblade.fandom.com (MediaWiki API)",
      count: report.valid.length,
      parts: report.valid,
    },
    report.valid.length,
  );
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  await closeBrowser();
  process.exit(1);
});
