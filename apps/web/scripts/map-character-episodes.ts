#!/usr/bin/env bun
/**
 * Mappe, par SAISON Beyblade, les PERSONNAGES → leurs ÉPISODES MARQUANTS depuis
 * beyblade.fandom.com (MediaWiki API) → data/anime-frames/character-episodes.json.
 *
 * Recon (2026-05-29) :
 *   - API MediaWiki (`/api.php`) répond en 200 JSON via le profil `static`
 *     (DOM zigquery). ⚠ Le profil `http` (curl-impersonate) renvoie désormais
 *     null sur fandom depuis l'IP datacenter du VPS (blocage TLS-fingerprint
 *     mouvant) — `static` est le transport fiable ici (≠ scrape-beyblade-library
 *     qui utilisait `http` à l'époque).
 *   - Personnages : `Category:Beyblade X Characters` (categorymembers, ~85 pages).
 *     Chaque fiche perso a un infobox `|AppearAnime=[[Beyblade X - Episode NN|…]]`
 *     → épisode de DÉBUT (signal fiable). Le comptage brut `Episode NN` dans la
 *     prose est trop bruité (navbox + bio épisode-par-épisode) → écarté.
 *   - Épisodes : pages `Beyblade X - Episode NN` (allpages, 127 pages). Chaque
 *     page a une section `== Characters ==` (wikilinks des persos présents) et
 *     `== Featured Battles ==` (persos qui COMBATTENT — signal "marquant" fort).
 *
 * notableEpisodes(perso) = { épisode de début } ∪ { épisodes où il combat
 * (Featured Battles) }, restreint aux noms canoniques de la catégorie perso.
 * role = heuristique sur le nb d'épisodes de combat (protagoniste/principal/
 * récurrent/secondaire).
 *
 *   cd apps/web && bun scripts/map-character-episodes.ts [--max-eps N]
 */
import { join } from "node:path";
import { CharacterEpisodeMapSchema, type CharacterEpisodeMap } from "@rpbey/api-contract";
import {
  closeBrowser,
  fetchSource,
  validateRecords,
  writeIfNonEmpty,
} from "./lib/ghost-scraper.ts";

const API = "https://beyblade.fandom.com/api.php";
const OUT = join(process.cwd(), "data", "anime-frames", "character-episodes.json");
const SERIES_KEY = "beyblade-x";
const CHAR_CATEGORY = "Category:Beyblade X Characters";

const THROTTLE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiJson(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  const r = await fetchSource(`${API}?${qs}`, {
    profile: "static",
    retries: 4,
    minHtmlLength: 5,
  });
  if (!r) throw new Error(`API MediaWiki injoignable (${qs.slice(0, 70)})`);
  const body = r.html.includes("<pre>")
    ? (r.html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? r.html)
    : r.html;
  return JSON.parse(body);
}

/** Tous les membres-pages d'une catégorie (pagination cmcontinue). */
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

/** wikitext de chaque page, batché par 50 titres. */
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
      const content = p.revisions?.[0]?.slots?.main?.["*"];
      if (p.title && content) out.set(p.title, content);
    }
    await sleep(THROTTLE_MS);
  }
  return out;
}

/** Titres `Beyblade X - Episode NN` existants (allpages préfixé). */
async function episodePages(): Promise<{ title: string; number: number }[]> {
  const out: { title: string; number: number }[] = [];
  let cont: string | undefined;
  do {
    const j = await apiJson({
      action: "query",
      list: "allpages",
      apprefix: "Beyblade X - Episode",
      aplimit: "500",
      ...(cont ? { apcontinue: cont } : {}),
    });
    for (const p of j.query?.allpages ?? []) {
      const n = Number((p.title as string).match(/Episode\s+(\d+)/)?.[1]);
      if (Number.isFinite(n)) out.push({ title: p.title, number: n });
    }
    cont = j.continue?.apcontinue;
  } while (cont);
  return out.sort((a, b) => a.number - b.number);
}

/** Extrait le corps d'une section `== Nom ==` du wikitext. */
function section(wt: string, name: string): string {
  const re = new RegExp(`==+\\s*${name}\\s*==+([\\s\\S]*?)(?:\\n==[^=]|$)`, "i");
  return wt.match(re)?.[1] ?? "";
}

/** Cibles de wikilinks (hors File:/Category:). */
function wikilinks(s: string): string[] {
  return [
    ...new Set(
      [...s.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)]
        .map((m) => m[1].trim())
        .filter((x) => !/^(File:|Category:)/i.test(x)),
    ),
  ];
}

/** Épisode de début depuis l'infobox `|AppearAnime=`. */
function debutEpisode(wt: string): number | null {
  const raw = wt.match(/\|\s*AppearAnime\s*=\s*([^\n]*)/i)?.[1] ?? "";
  const n = Number(raw.match(/Episode[ _]?0*(\d{1,3})/i)?.[1]);
  return Number.isFinite(n) ? n : null;
}

/** role heuristique sur le nb d'épisodes de combat. */
function roleFor(battleCount: number, isDebutEarly: boolean): string {
  if (battleCount >= 20 && isDebutEarly) return "protagoniste";
  if (battleCount >= 12) return "principal";
  if (battleCount >= 4) return "récurrent";
  return "secondaire";
}

async function main() {
  const argv = process.argv.slice(2);
  const mi = argv.indexOf("--max-eps");
  const maxEps = mi >= 0 && argv[mi + 1] ? Number(argv[mi + 1]) : Infinity;

  console.log(`Recon API fandom (profil static) — ${CHAR_CATEGORY}`);
  const charTitles = await categoryPages(CHAR_CATEGORY);
  console.log(`  ${charTitles.length} personnages canoniques.`);
  const canon = new Set(charTitles);

  const charWt = await wikitexts(charTitles);
  const debut = new Map<string, number>();
  for (const [title, wt] of charWt) {
    const d = debutEpisode(wt);
    if (d) debut.set(title, d);
  }
  console.log(`  ${debut.size} épisodes de début (AppearAnime) extraits.`);

  let eps = await episodePages();
  console.log(`  ${eps.length} pages d'épisode listées.`);
  if (Number.isFinite(maxEps)) eps = eps.filter((e) => e.number <= maxEps);

  const epWt = await wikitexts(eps.map((e) => e.title));

  // accumulateurs par perso
  const battles = new Map<string, Set<number>>(); // épisodes où le perso COMBAT
  const appears = new Map<string, Set<number>>(); // épisodes où le perso apparaît
  const add = (m: Map<string, Set<number>>, name: string, n: number) => {
    if (!canon.has(name)) return; // filtre : uniquement les vrais persos
    (m.get(name) ?? m.set(name, new Set()).get(name)!).add(n);
  };

  for (const ep of eps) {
    const wt = epWt.get(ep.title);
    if (!wt) continue;
    for (const name of wikilinks(section(wt, "Characters"))) add(appears, name, ep.number);
    for (const name of wikilinks(section(wt, "Featured Battles"))) add(battles, name, ep.number);
  }

  // construit le mapping perso → notableEpisodes
  const map: Record<string, CharacterEpisodeMap> = {};
  const names = new Set([...debut.keys(), ...battles.keys(), ...appears.keys()]);
  const raw: CharacterEpisodeMap[] = [];
  const rawNames: string[] = [];
  for (const name of names) {
    if (!canon.has(name)) continue;
    const notable = new Set<number>();
    const d = debut.get(name);
    if (d) notable.add(d);
    for (const n of battles.get(name) ?? []) notable.add(n);
    if (notable.size === 0) continue; // ni début ni combat → pas marquant
    const sorted = [...notable].sort((a, b) => a - b);
    const rec: CharacterEpisodeMap = {
      notableEpisodes: sorted,
      battleEpisodes: [...(battles.get(name) ?? [])].sort((a, b) => a - b),
      debutEpisode: d ?? null,
      role: roleFor(battles.get(name)?.size ?? 0, !!d && d <= 5),
    };
    raw.push(rec);
    rawNames.push(name);
  }

  const report = validateRecords(raw, CharacterEpisodeMapSchema);
  report.valid.forEach((rec, i) => {
    map[rawNames[i]] = rec;
  });
  console.log(
    `\nPersos mappés (≥1 épisode marquant) : ${Object.keys(map).length} | rejets schéma: ${report.invalid}`,
  );
  if (report.invalid > 0) console.warn(`  rejets: ${report.errors.join(" · ")}`);

  // fusionne sans écraser d'autres saisons déjà présentes dans le fichier.
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await Bun.file(OUT).text());
  } catch {}
  existing[SERIES_KEY] = map;

  await writeIfNonEmpty(OUT, existing, Object.keys(map).length);
  const sample = Object.entries(map)
    .sort((a, b) => b[1].notableEpisodes.length - a[1].notableEpisodes.length)
    .slice(0, 5);
  console.log("  top persos:", JSON.stringify(Object.fromEntries(sample)));
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("ÉCHEC:", e?.message ?? e);
  await closeBrowser();
  process.exit(1);
});
