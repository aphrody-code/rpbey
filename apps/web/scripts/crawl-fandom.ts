#!/usr/bin/env bun
/**
 * crawl-fandom.ts — crawler MediaWiki EXHAUSTIF du Beyblade Wiki (Fandom).
 *
 * Accumule TOUTE la connaissance Beyblade, toutes générations confondues (Original/
 * Plastic, HMS, Metal Saga, Burst, Beyblade X) : toupies, pièces, personnages, anime
 * (séries + épisodes), jeux vidéo, accessoires, lore. Source : `beyblade.fandom.com`
 * (MediaWiki 1.43, ~8 500 articles) — l'API `api.php` est joignable depuis le VPS
 * (contrairement aux pages HTML Cloudflare), donc on tape l'API JSON directement
 * (UA Chrome), la voie la + robuste et complète pour un wiki.
 *
 * Méthode (« le meilleur crawler possible ») :
 *   1. Énumère TOUTES les pages de l'espace principal (`list=allpages`, non-redirects).
 *   2. Récupère en LOT (50/req) catégories + image pleine résolution + wikitext.
 *   3. Parse l'infobox (1er template `{{… | k = v …}}`, accolades équilibrées).
 *   4. Classe chaque page : TYPE (bey/character/part/anime/episode/game/accessory/lore)
 *      + GÉNÉRATION + système + sens de rotation + type de combat + nom JP, depuis
 *      les catégories et l'infobox.
 *   5. Dérive un résumé en texte clair du wikitext (TextExtracts absent sur Fandom).
 *
 * Robuste & poli : requêtes sérielles + `maxlag`, retry/backoff sur 429/5xx/maxlag,
 * checkpoint résumable (`data/.fandom-crawl-state.json`), écriture NON-destructive
 * (jamais d'écrasement par du vide), validation Zod (`WikiEntitySchema`).
 *
 *   bun apps/web/scripts/crawl-fandom.ts            # crawl complet
 *   FANDOM_LIMIT=300 bun apps/web/scripts/crawl-fandom.ts   # échantillon (test)
 *   FANDOM_RESET=1 bun apps/web/scripts/crawl-fandom.ts     # ignore le checkpoint
 */
import { WikiEntitySchema, type WikiEntity } from "@rpbey/api-contract";

const WIKI = "beyblade.fandom.com";
const API = `https://${WIKI}/api.php`;
const WIKI_BASE = `https://${WIKI}/wiki/`;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const OUT = "data/beyblade-knowledge.json";
const STATE = "data/.fandom-crawl-state.json";
const BATCH = 50; // max pageids/requête pour un client anonyme
const LIMIT = process.env.FANDOM_LIMIT ? Number(process.env.FANDOM_LIMIT) : Infinity;
const DELAY_MS = 150; // politesse entre requêtes

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET API JSON avec maxlag + retry/backoff (429/503/maxlag/réseau). */
async function api(params: Record<string, string | number>, attempt = 0): Promise<any> {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", maxlag: 5, ...params }))
    u.searchParams.set(k, String(v));
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (r.status === 429 || r.status === 503 || r.status >= 500)
      throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j?.error?.code === "maxlag") throw new Error("maxlag");
    return j;
  } catch (e) {
    if (attempt >= 5) throw e;
    const wait = Math.min(30000, 800 * 2 ** attempt);
    await sleep(wait);
    return api(params, attempt + 1);
  }
}

// ── Parsing wikitext ────────────────────────────────────────────────────────

/** Extrait le 1er template `{{…}}` (accolades équilibrées) = l'infobox candidate. */
function firstTemplate(wt: string): { name: string; body: string } | null {
  const start = wt.indexOf("{{");
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  for (; i < wt.length - 1; i++) {
    if (wt[i] === "{" && wt[i + 1] === "{") {
      depth++;
      i++;
    } else if (wt[i] === "}" && wt[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) break;
    }
  }
  const inner = wt.slice(start + 2, i - 1);
  const nl = inner.indexOf("\n");
  const firstLine = (nl >= 0 ? inner.slice(0, nl) : inner).trim();
  const name = firstLine.split("|")[0]?.trim() ?? "";
  return { name, body: inner };
}

/** Découpe le corps d'un template en champs top-level (respecte `{{}}` / `[[]]` imbriqués). */
function splitFields(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const c2 = body[i + 1];
    if ((c === "{" && c2 === "{") || (c === "[" && c2 === "[")) {
      depth++;
      cur += c + (c2 ?? "");
      i++;
    } else if ((c === "}" && c2 === "}") || (c === "]" && c2 === "]")) {
      depth--;
      cur += c + (c2 ?? "");
      i++;
    } else if (c === "|" && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Nettoie le markup wiki d'une valeur en texte lisible. */
function cleanWiki(s: string): string {
  return (
    s
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
      .replace(/<ref[^>]*\/>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // {{nihongo|<EN>|<JP>|…}} → garde le nom EN (1er arg) au lieu de supprimer le bloc
      // (sinon le nom de la page disparaît du résumé → « The is a … »).
      .replace(/\{\{\s*nihongo[^|{}]*\|\s*'*\s*([^|{}']+?)\s*'*\s*(?:\|[^{}]*)?\}\}/gi, "$1")
      .replace(/\{\{[^{}]*\}\}/g, "") // autres templates internes simples
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1") // [[lien|texte]] → texte
      .replace(/'''?/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Parse l'infobox en paires clé→valeur nettoyées (champs non vides). */
function parseInfobox(body: string): Record<string, string> {
  const fields = splitFields(body).slice(1); // [0] = nom du template
  const out: Record<string, string> = {};
  for (const f of fields) {
    const eq = f.indexOf("=");
    if (eq < 0) continue;
    const key = f.slice(0, eq).trim().toLowerCase().replace(/\s+/g, "_");
    const val = cleanWiki(f.slice(eq + 1));
    if (key && val && val.length < 600) out[key] = val;
  }
  return out;
}

/** Résumé en texte clair : 1er vrai paragraphe après l'infobox + templates de tête. */
function deriveSummary(wt: string): string {
  let s = wt;
  // Retire les templates de tête (infobox, cleanup, etc.) en équilibrant les accolades.
  while (s.trimStart().startsWith("{{")) {
    const st = s.indexOf("{{");
    let depth = 0;
    let i = st;
    for (; i < s.length - 1; i++) {
      if (s[i] === "{" && s[i + 1] === "{") {
        depth++;
        i++;
      } else if (s[i] === "}" && s[i + 1] === "}") {
        depth--;
        i++;
        if (depth === 0) break;
      }
    }
    s = s.slice(i + 1);
  }
  s = cleanWiki(s.split(/\n==/)[0] ?? s); // jusqu'à la 1ʳᵉ section ==…==
  const cut = s.slice(0, 600);
  const lastDot = cut.lastIndexOf(". ");
  return (lastDot > 200 ? cut.slice(0, lastDot + 1) : cut).trim();
}

// ── Classification (catégories + infobox) ────────────────────────────────────

/**
 * Sous-pages NON entités à écarter (elles héritent les catégories de la page
 * parente → faux positifs de classification, ex. « Aiger Akabane/Gallery » classé
 * personnage). Couvre : galeries/médias/sous-articles + sous-pages de TRADUCTION
 * (codes langue ISO, ex. `/it`, `/fr`, `/tr`) qui dupliquent l'article anglais.
 */
const SUBPAGE_SUBARTICLE =
  /\/(?:gallery|image\s*gallery|galleries|images?|videos?|quotes?|appearances?|relationships?|merchandise|history|trivia|sandbox|references?|\d{4}\s*archive)$/i;
const SUBPAGE_LANG =
  /\/(?:it|fr|tr|es|de|pt|pt-br|ru|pl|ja|zh|zh-tw|ko|nl|ar|id|vi|th|uk|cs|ro|hu|sv|fi|da|no|nb|he|fa|el|hi|ms|tl|ca|sr|hr|bg|sk|sl|lt|lv|et)$/i;

/** Titre de sous-page à ne pas indexer (galerie / média / traduction). */
function isJunkTitle(title: string): boolean {
  return SUBPAGE_SUBARTICLE.test(title) || SUBPAGE_LANG.test(title);
}

function classifyGeneration(cats: string[]): WikiEntity["generation"] {
  const c = cats.join(" | ").toLowerCase();
  if (/beyblade x\b|beyblade-x|\bx beyblades|x system/.test(c)) return "X";
  if (/burst/.test(c)) return "BURST";
  if (
    /metal (fusion|masters|fury|saga|fight)|hybrid wheel|metal system|4d system|metal beyblades/.test(
      c,
    )
  )
    return "METAL";
  if (/heavy metal system|\bhms\b/.test(c)) return "HMS";
  if (/original series|plastic|magnacore|engine gear|bakuten|first generation/.test(c))
    return "ORIGINAL";
  return null;
}

function classifyType(cats: string[], tplName: string): WikiEntity["type"] {
  const c = cats.join(" | ").toLowerCase();
  const t = tplName.toLowerCase();
  // Pièces (toutes générations) : layers/discs/drivers (Burst), blades/ratchets/bits (X), wheels…
  if (
    /\b(energy layers?|forge discs?|performance tips?|drivers?|blades?|ratchets?|bits?|disks?|chassis|lock chips?|assist blades?|over blades?|face bolts?|spin tracks?|clear wheels?|metal wheels?|fusion wheels?|tips|bottoms?)\b/.test(
      c,
    ) &&
    !/\bbeyblades\b/.test(c)
  )
    return "part";
  // Personnage : signal catégorie fiable (les infobox perso Fandom sont minimales :
  // color/quote/speaker). On EXCLUT les pages galerie qui héritent « Character Gallery »
  // / « Image Galleries » de la page parente (sinon ~120 galeries passent personnage).
  if (
    (/\bcharacters?\b|\bantagonists?\b|\bprotagonists?\b|\bbladers?\b/.test(c) ||
      t.includes("character")) &&
    !/\bgalleries\b|\bgallery\b/.test(c)
  )
    return "character";
  if (/\bepisodes?\b/.test(c) || t.includes("episode")) return "episode";
  if (/\b(anime|seasons?|series|manga)\b/.test(c) && !/beyblades\b/.test(c)) return "anime";
  if (/\b(video games?|games?)\b/.test(c) || t.includes("game")) return "game";
  if (/\b(stadiums?|launchers?|grips?|tools?|accessor)/.test(c)) return "accessory";
  if (/\bbeyblades?\b/.test(c) || t.includes("beyblade infobox")) return "bey";
  return "lore";
}

function classifySpin(cats: string[], info: Record<string, string>): WikiEntity["spin"] {
  const hay = `${cats.join(" ")} ${info.spin ?? ""} ${info.spin_direction ?? ""}`.toLowerCase();
  if (/dual[- ]spin|both directions/.test(hay)) return "DUAL";
  if (/left[- ]spin|left-spin/.test(hay)) return "LEFT";
  if (/right[- ]spin|right-spin/.test(hay)) return "RIGHT";
  return null;
}

const BEY_TYPE_RE = /\b(attack|defense|defence|stamina|balance)\b/i;
function classifyBeyType(cats: string[], info: Record<string, string>): string | null {
  const fromInfo = info.type ?? info.bey_type ?? "";
  const m = `${fromInfo} ${cats.join(" ")}`.match(BEY_TYPE_RE);
  if (!m) return null;
  const v = m[1]!.toLowerCase();
  return v === "defence" ? "Defense" : v.charAt(0).toUpperCase() + v.slice(1);
}

function extractJpName(info: Record<string, string>): string | null {
  for (const k of ["japanese", "jpname", "jp_name", "kana", "romaji", "japanese_name"]) {
    if (info[k]) return info[k];
  }
  return null;
}

function extractSystem(cats: string[], info: Record<string, string>): string | null {
  if (info.system) return info.system;
  const sys = cats.find((c) => /system$/i.test(c));
  return sys ?? null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// ── Crawl ─────────────────────────────────────────────────────────────────────

interface CrawlState {
  apcontinue: string | null;
  done: boolean;
  pageids: number[];
}

async function enumeratePageIds(state: CrawlState): Promise<void> {
  if (state.done) return;
  const seen = new Set(state.pageids);
  let cont = state.apcontinue ?? undefined;
  let rounds = 0;
  while (state.pageids.length < LIMIT) {
    const params: Record<string, string | number> = {
      action: "query",
      list: "allpages",
      apnamespace: 0,
      aplimit: 500,
      apfilterredir: "nonredirects",
    };
    if (cont) params.apcontinue = cont;
    const j = await api(params);
    for (const p of j?.query?.allpages ?? []) {
      if (seen.has(p.pageid)) continue;
      seen.add(p.pageid);
      // Sous-pages galerie/média/traduction : ni fetchées ni indexées (bruit + doublons).
      if (isJunkTitle(p.title ?? "")) continue;
      state.pageids.push(p.pageid);
    }
    cont = j?.continue?.apcontinue;
    state.apcontinue = cont ?? null;
    rounds++;
    if (rounds % 4 === 0) console.log(`[crawl] énumération… ${state.pageids.length} pages`);
    if (!cont) {
      state.done = true;
      break;
    }
    await sleep(DELAY_MS);
  }
  console.log(`[crawl] énumération terminée : ${state.pageids.length} pages (espace principal).`);
}

function buildEntity(p: any): WikiEntity | null {
  const title = (p.title ?? "").trim();
  if (!title) return null;
  // Sous-page galerie/média/traduction (défensif : checkpoint d'avant le filtre d'énum).
  if (isJunkTitle(title)) return null;
  const cats = (p.categories ?? []).map((c: any) => String(c.title).replace(/^Category:/, ""));
  // Ignore les pages de maintenance / désambiguïsation pures.
  const catL = cats.join(" | ").toLowerCase();
  if (/disambiguation|redirects|stubs?$|articles requiring/.test(catL) && cats.length <= 3)
    return null;
  const wt = p?.revisions?.[0]?.slots?.main?.["*"] ?? p?.revisions?.[0]?.["*"] ?? "";
  const tpl = firstTemplate(wt);
  const info = tpl ? parseInfobox(tpl.body) : {};
  // Les pages « List of … » sont des index de référence, pas une entité unique :
  // on les reclasse en `lore` pour ne pas polluer les facettes bey/personnage/pièce
  // (ex. « List of … Characters » ne doit pas compter comme un personnage).
  const type = /^list of /i.test(title) ? "lore" : classifyType(cats, tpl?.name ?? "");
  return WikiEntitySchema.parse({
    id: p.pageid,
    title,
    slug: slugify(title),
    url: `${WIKI_BASE}${encodeURIComponent(title.replace(/ /g, "_"))}`,
    type,
    generation: classifyGeneration(cats),
    system: extractSystem(cats, info),
    spin: classifySpin(cats, info),
    beyType: type === "bey" ? classifyBeyType(cats, info) : null,
    jpName: extractJpName(info),
    summary: deriveSummary(wt),
    imageUrl: p.original?.source ?? null,
    categories: cats.slice(0, 24),
    infobox: Object.fromEntries(Object.entries(info).slice(0, 30)),
  });
}

async function main() {
  const t0 = Date.now();
  // Checkpoint résumable.
  let state: CrawlState = { apcontinue: null, done: false, pageids: [] };
  let entities = new Map<number, WikiEntity>();
  if (!process.env.FANDOM_RESET) {
    try {
      const saved = await Bun.file(STATE).json();
      if (saved?.state) state = saved.state;
      for (const e of saved?.entities ?? []) entities.set(e.id, e);
      if (state.pageids.length)
        console.log(
          `[crawl] reprise : ${state.pageids.length} ids, ${entities.size} entités déjà traitées.`,
        );
    } catch {
      /* pas de checkpoint */
    }
  }

  // 1. Énumération.
  await enumeratePageIds(state);
  const ids = state.pageids.slice(0, LIMIT === Infinity ? undefined : LIMIT);

  // 2. Lots de props (catégories + image + wikitext).
  const todo = ids.filter((id) => !entities.has(id));
  console.log(`[crawl] ${todo.length} pages à enrichir (sur ${ids.length}).`);
  let processed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const j = await api({
      action: "query",
      pageids: slice.join("|"),
      prop: "categories|pageimages|revisions",
      cllimit: "max",
      clshow: "!hidden",
      rvprop: "content",
      rvslots: "main",
      piprop: "original",
    });
    for (const p of Object.values<any>(j?.query?.pages ?? {})) {
      if (p?.missing !== undefined) continue;
      try {
        const e = buildEntity(p);
        if (e) entities.set(e.id, e);
      } catch {
        /* page non conforme → ignorée */
      }
    }
    processed += slice.length;
    if (processed % 500 < BATCH) {
      console.log(`[crawl] ${processed}/${todo.length} traitées · ${entities.size} entités`);
      // checkpoint incrémental.
      await Bun.write(STATE, JSON.stringify({ state, entities: [...entities.values()] }));
    }
    await sleep(DELAY_MS);
  }

  // 3. Écriture finale (non-destructive : on n'écrase pas par du vide).
  const all = [...entities.values()];
  if (all.length === 0) {
    console.error("[crawl] aucune entité — abandon (pas d'écrasement).");
    process.exit(1);
  }
  const byType: Record<string, number> = {};
  const byGen: Record<string, number> = {};
  for (const e of all) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    if (e.generation) byGen[e.generation] = (byGen[e.generation] ?? 0) + 1;
  }
  const out = {
    generatedAt: new Date().toISOString(),
    source: WIKI,
    wiki: "Beyblade Wiki (Fandom)",
    count: all.length,
    byType,
    byGeneration: byGen,
    entities: all.sort((a, b) => a.title.localeCompare(b.title)),
  };
  await Bun.write(OUT, JSON.stringify(out, null, 2));
  await Bun.write(STATE, JSON.stringify({ state, entities: all }));

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n[crawl] OK — ${all.length} entités écrites dans ${OUT} en ${secs}s.`);
  console.log("  par type :", JSON.stringify(byType));
  console.log("  par génération :", JSON.stringify(byGen));
  const withImg = all.filter((e) => e.imageUrl).length;
  const withSum = all.filter((e) => e.summary.length > 40).length;
  console.log(`  images : ${withImg}/${all.length} · résumés : ${withSum}/${all.length}`);
}

await main();
