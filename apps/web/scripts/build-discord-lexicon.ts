#!/usr/bin/env bun
/**
 * build-discord-lexicon.ts — extrait un LEXIQUE communautaire du dump du salon
 * Discord « Beyblade X » (`data/discord-discussions.json`) pour rendre la
 * recherche & le chat RAG plus intelligents, SANS jamais exposer le contenu Discord.
 *
 * ⚠️ Invariant de confidentialité (demande explicite) : les messages Discord ne
 * doivent apparaître NI dans la page de recherche NI dans les réponses de l'IA.
 * Ils ne servent qu'à informer le VOCABULAIRE. Donc l'artefact produit ne contient
 * QUE des *tokens d'alias* (initialismes / contractions) reliés à un nom d'entité
 * CANONIQUE déjà public — aucun texte de message, aucun pseudo, aucune URL, aucun id.
 *
 * Méthode (100 % déterministe, zéro LLM) :
 *   1. Graine de noms canoniques multi-mots = synonymes Beyblade curés + noms
 *      d'entités de `data/universe_beys.json` (titre sans le code ratchet/bit).
 *   2. Pour chaque nom canonique ≥2 mots : génère des candidats d'alias
 *      (initialisme « dran sword → ds », forme collée « dransword »).
 *   3. Tokenise le corpus Discord (accent-fold) et compte les fréquences.
 *   4. CONFIRME un alias seulement si (a) le nom canonique complet est réellement
 *      mentionné dans le salon, (b) l'alias y apparaît ≥ SEUIL fois, (c) l'alias
 *      n'est pas ambigu (1 seul canonique), (d) hors blocklist de mots courants.
 *
 * Sorties :
 *   - `src/lib/discord-lexicon.generated.ts` — consommé par le ranker (bundlé,
 *     client + serveur). Étend la table de synonymes (expansion à la requête).
 *   - `data/discord-lexicon.json` — rapport d'audit (humain), non servi.
 *
 * Lancer : cd apps/web && bun scripts/build-discord-lexicon.ts
 */

const DUMP = "data/discord-discussions.json";
const BEYS = "data/universe_beys.json";
const OUT_TS = "src/lib/discord-lexicon.generated.ts";
const OUT_JSON = "data/discord-lexicon.json";

// Un alias est confirmé s'il apparaît au moins ce nombre de fois dans le salon.
const MIN_ALIAS_FREQ = 4;

// ── Normalisation alignée sur le ranker (NFD accent-fold, minuscules) ───────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Mots courants FR/EN à ne JAMAIS confirmer comme alias (collisions d'initialismes).
const BLOCKLIST = new Set([
  "de",
  "le",
  "la",
  "et",
  "ou",
  "un",
  "on",
  "se",
  "ce",
  "ne",
  "je",
  "tu",
  "il",
  "as",
  "es",
  "is",
  "it",
  "in",
  "to",
  "of",
  "or",
  "an",
  "at",
  "be",
  "do",
  "go",
  "so",
  "no",
  "my",
  "me",
  "we",
  "up",
  "us",
  "ok",
  "yo",
  "gg",
  "lol",
  "mdr",
  "ptn",
  "wtf",
  "tg",
  "ng",
  "rt",
  "dm",
  "pv",
  "mp",
  "ms",
  // tokens 2-char génériques (hors Beyblade) — sources de faux positifs d'initialisme
  "id",
  "ai",
  "ia",
  "tv",
  "ko",
  "fr",
  "en",
  "ja",
  "ui",
  "ux",
  "pc",
  "ig",
  "yt",
  "nb",
  "vs",
  "ed",
  "ep",
  "td",
]);

// Graine curée (miroir des synonymes du ranker) — entités que la communauté abrège.
const SEED_CANONICAL = [
  "wizard rod",
  "wizard arrow",
  "phoenix wing",
  "phoenix feather",
  "cobalt dragoon",
  "cobalt drake",
  "shark edge",
  "dran sword",
  "dran buster",
  "dran dagger",
  "hells scythe",
  "hells chain",
  "hells hammer",
  "leon claw",
  "leon crest",
  "weiss tiger",
  "unicorn sting",
  "knight shield",
  "knight lance",
  "tyranno beat",
  "black shell",
  "viper tail",
  "sphinx cowl",
  "rhino horn",
  "talon ptera",
  "savage bear",
  "wolf howl",
  "bite croc",
  "croc claw",
  "yell kong",
  "perseus dark",
  "samurai saber",
  "aero pegasus",
  "antler stag",
  "scorpio spear",
  "ghost circle",
  "silver wolf",
  "golem rock",
  "impact drake",
  "whale wave",
  "shelter drake",
];

interface BeyEntry {
  title?: string;
  metadata?: { MainBlade?: string; AssistBlade?: string; AKA?: string };
}

/** Retire le code ratchet/bit final d'un titre (« Dran Sword 3-60F » → « dran sword »). */
function canonicalFromTitle(title: string): string | null {
  const t = title
    .replace(/\b\d+-\d+[A-Za-z]*\b.*$/, "") // code X (3-60F…) et tout ce qui suit
    .replace(/\([^)]*\)/g, " ")
    .trim();
  const norm = normalize(t);
  const words = norm.split(" ").filter(Boolean);
  return words.length >= 2 && words.length <= 4 ? words.join(" ") : null;
}

/** Candidats d'alias pour un nom canonique multi-mots. */
function aliasCandidates(canonical: string): string[] {
  const words = canonical.split(" ").filter((w) => w.length > 0);
  if (words.length < 2) return [];
  const initials = words.map((w) => w[0]).join(""); // dran sword → ds
  const collapsed = words.join(""); // dransword
  const firstTwo = words.slice(0, 2).join(""); // pour noms 3+ mots
  const out = new Set<string>();
  if (initials.length >= 2 && initials.length <= 4) out.add(initials);
  if (collapsed.length >= 4 && collapsed.length <= 16) out.add(collapsed);
  if (words.length >= 3 && firstTwo.length >= 4 && firstTwo.length <= 16) out.add(firstTwo);
  return [...out].filter((a) => !BLOCKLIST.has(a));
}

async function main() {
  const dump = (await Bun.file(DUMP)
    .json()
    .catch(() => null)) as {
    discussions?: Array<{ text?: string }>;
    count?: number;
  } | null;
  if (!dump?.discussions?.length) {
    console.error(`[lexicon] ${DUMP} absent ou vide — abandon (artefact préservé).`);
    process.exit(0);
  }

  // Corpus Discord normalisé en UN bloc de tokens (zéro structure conservée → aucune
  // fuite de message individuel possible en aval).
  const tokenFreq = new Map<string, number>();
  let blob = "";
  for (const d of dump.discussions) {
    const norm = normalize(d.text ?? "");
    if (!norm) continue;
    blob += " " + norm;
    for (const tok of norm.split(/[^a-z0-9぀-ヿ一-鿿]+/)) {
      if (tok.length >= 2) tokenFreq.set(tok, (tokenFreq.get(tok) ?? 0) + 1);
    }
  }

  // Graine canonique = curés + dérivés de universe_beys.
  const canon = new Set(SEED_CANONICAL.map(normalize));
  const beys = (await Bun.file(BEYS)
    .json()
    .catch(() => [])) as BeyEntry[] | { beys?: BeyEntry[] };
  const beyArr = Array.isArray(beys) ? beys : (beys.beys ?? []);
  for (const b of beyArr) {
    if (b.title) {
      const c = canonicalFromTitle(b.title);
      if (c) canon.add(c);
    }
    // Combo LockChip/MainBlade fréquemment abrégé par la communauté.
    if (b.metadata?.MainBlade && b.metadata?.AssistBlade) {
      const c = normalize(`${b.metadata.MainBlade} ${b.metadata.AssistBlade}`);
      if (c.split(" ").length >= 2) canon.add(c);
    }
  }

  // Mention du canonique dans le salon : on n'abrège que les entités vraiment discutées.
  const canonMentioned = (name: string): boolean =>
    blob.includes(` ${name} `) || blob.includes(name);

  // Génération + confirmation, avec filtre d'ambiguïté (alias → 1 seul canonique).
  const aliasToCanon = new Map<string, Set<string>>();
  const freqOf = new Map<string, number>();
  for (const name of canon) {
    if (!canonMentioned(name)) continue;
    for (const alias of aliasCandidates(name)) {
      const freq = tokenFreq.get(alias) ?? 0;
      if (freq < MIN_ALIAS_FREQ) continue;
      let set = aliasToCanon.get(alias);
      if (!set) {
        set = new Set();
        aliasToCanon.set(alias, set);
      }
      set.add(name);
      freqOf.set(alias, freq);
    }
  }

  // Groupes finaux : [canonique, ...alias non ambigus].
  const byCanon = new Map<string, string[]>();
  const confirmed: Array<{ alias: string; canonical: string; freq: number }> = [];
  for (const [alias, set] of aliasToCanon) {
    if (set.size !== 1) continue; // ambigu → rejet
    const canonical = [...set][0]!;
    if (alias === canonical.replace(/\s+/g, "")) {
      // forme collée triviale : on l'ajoute quand même (utile), mais sans doublonner
    }
    const arr = byCanon.get(canonical) ?? [];
    arr.push(alias);
    byCanon.set(canonical, arr);
    confirmed.push({ alias, canonical, freq: freqOf.get(alias) ?? 0 });
  }

  const groups: string[][] = [...byCanon.entries()]
    .map(([canonical, aliases]) => [canonical, ...[...new Set(aliases)].sort()])
    .filter((g) => g.length >= 2)
    .sort((a, b) => a[0]!.localeCompare(b[0]!));

  // Top termes communautaires (audit uniquement — JAMAIS servi).
  const topTerms = [...tokenFreq.entries()]
    .filter(([t]) => t.length >= 3 && !BLOCKLIST.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([t, n]) => ({ term: t, freq: n }));

  const generatedAt = new Date().toISOString();
  const meta = {
    generatedAt,
    source: "discord:beyblade-x",
    messages: dump.count ?? dump.discussions.length,
    vocab: tokenFreq.size,
    confirmedAliases: confirmed.length,
    aliasGroups: groups.length,
  };

  // ── Artefact runtime (bundlé) : alias tokens uniquement ──
  const ts = `// AUTO-GÉNÉRÉ par scripts/build-discord-lexicon.ts — NE PAS ÉDITER À LA MAIN.
//
// Alias communautaires (initialismes / contractions) CONFIRMÉS par fréquence réelle
// dans le salon Discord « Beyblade X ». Chaque groupe = [nom canonique public,
// ...alias]. Contenu = TOKENS uniquement — aucun message, pseudo, URL ni id Discord
// (invariant de confidentialité : le contenu Discord n'apparaît jamais en recherche
// ni dans les réponses de l'IA, seul le vocabulaire informe l'expansion de requête).
//
// Régénérer après un nouveau scrape : cd apps/web && bun scripts/build-discord-lexicon.ts
// Stats : ${meta.messages} messages, ${meta.vocab} tokens, ${meta.aliasGroups} groupes.

export const COMMUNITY_ALIASES: string[][] = ${JSON.stringify(groups, null, 2)};

export const COMMUNITY_ALIASES_META = ${JSON.stringify(meta, null, 2)} as const;
`;
  await Bun.write(OUT_TS, ts);

  // ── Rapport d'audit (humain) ──
  await Bun.write(
    OUT_JSON,
    JSON.stringify({ ...meta, aliasGroups: groups, confirmed, topTerms }, null, 2),
  );

  console.log(
    `[lexicon] OK — ${groups.length} groupes d'alias (${confirmed.length} alias confirmés).`,
  );
  console.log(`  → ${OUT_TS}`);
  console.log(`  → ${OUT_JSON} (audit)`);
  if (groups.length) {
    console.log("  exemples :");
    for (const g of groups.slice(0, 12)) console.log(`    ${g[0]} ⇐ ${g.slice(1).join(", ")}`);
  }
}

await main();
