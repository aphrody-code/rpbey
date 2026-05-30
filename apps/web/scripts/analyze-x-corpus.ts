#!/usr/bin/env bun
/**
 * analyze-x-corpus.ts — analyse + classification du corpus X.com (Twitter) du
 * store RAG partagé `~/.aphrody/x-store.sqlite` (LECTURE SEULE).
 *
 * Calcule par tweet : langue, score de pertinence Beyblade [0..1], topic, flags
 * RT brut / near-duplicate. Produit le rapport `apps/web/data/x-corpus-report.md`.
 *
 * Le classifieur (scoring + topic + langue + dédup) est défini ici et dupliqué
 * tel quel dans `export-x-discussions.ts` (scripts autonomes, hors module partagé
 * pour rester dans le périmètre de fichiers autorisé).
 *
 * Lancer : `bun apps/web/scripts/analyze-x-corpus.ts`
 */
import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";

const STORE = process.env.X_STORE_PATH ?? join(homedir(), ".aphrody", "x-store.sqlite");
const REPORT = join(import.meta.dir, "..", "data", "x-corpus-report.md");
const RELEVANCE_THRESHOLD = 0.5;
const MIN_LEN = 24;

// ---------------------------------------------------------------------------
// Classifieur Beyblade (dupliqué dans export-x-discussions.ts)
// ---------------------------------------------------------------------------

interface TweetRow {
  id: string;
  author_username: string;
  author_name: string;
  text: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  created_at: string | null;
  lang: string | null;
}

// Comptes Beyblade établis (seeds + créateurs observés). Un tweet d'un de ces
// comptes reçoit un fort bonus de pertinence (contexte du compte établi).
const BEY_ACCOUNTS = new Set(
  [
    "rpb_ey",
    "sunafterthebey",
    "x_beyblade",
    "beyblade_espace",
    "zankye",
    "chillaccinoo",
    "kio_moe",
    "deltythe73rd",
    "ultragalaxy4",
    "bbx_kamen_z",
    "azayakaph",
    "haruren364",
    "beyblade",
    "beyblade_group",
    "takaratomy_bey",
    "beyblade_bar",
    "periperibeys",
    "beybladex_game",
    "zodiac_z0ne",
    "beybrad",
    "warihammer",
    "tbh_pr",
    "origakashdas",
    "bladersnetwork",
    "beyblade_galaxy",
    "bey_cats",
    "takaratomytoys",
    "datadeturner",
  ].map((s) => s.toLowerCase()),
);

// Signaux FORTS, non-ambigus : suffisent à eux seuls à franchir le seuil.
const STRONG = [
  /beyblade/i,
  /ベイブレード/,
  /ベイブレ/,
  /#ベイ/,
  /beyblade\s?x|beybladex|ベイブレードx/i,
  /\bbey\s?x\b/i,
  /\b[bcu]x-\d{1,3}\b/i,
  /toupie/i,
  /blader/i,
];

// Noms de blades / bits / ratchets compétitifs (Beyblade X, Burst, Metal).
const PARTS = [
  /wizard\s?rod|ウィザードロッド/i,
  /dran\s?(sword|buster|dagger|strike|brave)|ドランソード|ドランバスター/i,
  /hells\s?(chain|scythe|hammer)|ヘルズ/i,
  /cobalt\s?(drake|dragoon)|コバルトドレイク|コバルトドラグーン/i,
  /shark\s?(edge|scale)|シャークエッジ/i,
  /weiss\s?tiger|ヴァイスタイガー/i,
  /knight\s?(shield|lance|mail)|ナイトシールド/i,
  /leon\s?(claw|crest)|レオンクレスト/i,
  /unicorn\s?sting|ユニコーンスティング/i,
  /viper\s?tail|phoenix\s?wing|aero\s?pegasus|crest\s?leon/i,
  /clamp\s?crab|bullet\s?(gryphon|griffon)|バレットグリフォン/i,
  /tyranno\s?beat|black\s?shell|ブラックシェル/i,
  /brachio\s?whip|brachiowhip|ブラキオウィップ/i,
  /silver\s?wolf|wyvern\s?gale|tusk\s?mammoth|rhino\s?horn/i,
  /dranzer|dragoon|draciel|driger/i,
  /xtreme\s?(bit|finish)?|エクストリーム/i,
  /\bratchet\b/i,
  /\b[1-9]-[5-9]0\b/,
  /ball\s?bit|hexa\s?bit|flat\s?bit|point\s?bit|gear\s?(flat|point|ball)/i,
  /ランダムブースター|ランブー|スターター|ブースターパック/i,
  /takara\s?tomy|タカラトミー/i,
];

// Termes communautaires/compétitifs Beyblade (renforts faibles).
const COMMUNITY = [
  /\bdeck\b|デッキ/i,
  /over\s?finish|spin\s?finish|burst\s?finish|extreme\s?finish|オーバーフィニッシュ/i,
  /\bg[1-3]\b|\bs1\b/i,
  /random\s?booster/i,
  /\bcombo\b/i,
  /spin\s?steal|left\s?spin|right\s?spin/i,
];

const T_TOURNOI =
  /tournament|tournoi|大会|トーナメント|championship|選手権|nationals?|\bcup\b|bracket|swiss|podium|表彰台|wild\s?breakers|sun\s?after|reign|première édition|saison|single\s?elimination|\b1v1\b|finals?\b|\bg[1-3]\b|\bs1\b|優勝|準優勝|交流会/i;
const T_SORTIE =
  /\b[bcu]x-\d|release|reveal|leak|corocoro|コロコロ|予約|発売|新作|amazon|takara\s?tomy|タカラトミー|random\s?booster|ランダムブースター|スターター|booster|restock|in\s?stock|preorder|pre-order/i;
const T_ANIME = /\banime\b|アニメ|episode|エピソード|manga|漫画|opening|主題歌|season\s?\d|声優/i;
const T_PLAINTE =
  /shatter|cracked?|broke[n]?|wear|teeth\s?wear|paint\s?(chip|peel)|defective|fragile|壊れ|破損|割れ|折れ|摩耗|すり減|塗装剥げ|初期不良|曲がっ|cassé|brisé|usure|abîmé|défaut|fissure|quality\s?control/i;
const T_META =
  /\bmeta\b|メタ|wizard\s?rod|stamina|スタミナ|attack(er)?|アタック|defense|defence|combo|deck|tier\s?list|matchup|counter|\bban\b|best\s?(bey|combo|deck)|optimal/i;

const JP_RX = /[぀-ヿ㐀-鿿]/;
const FR_DIACRITICS = /[àâçéèêëîïôûùüÿœæ]/i;
const FR_WORDS =
  /\b(le|la|les|un|une|des|du|de|et|est|pour|avec|dans|sur|qui|que|pas|plus|mais|ça|sont|été|très|jeu|toupie|nouvelle|gagné|victoire|tournoi)\b/i;

function detectLang(text: string, raw: string | null): string {
  const t = text.trim();
  if (!t) return raw ?? "und";
  const jpMatches = (t.match(/[぀-ヿ]/g) ?? []).length;
  if (jpMatches >= 2 || (jpMatches >= 1 && JP_RX.test(t) && t.length < 60)) {
    return "ja";
  }
  if (raw === "ja") return "ja";
  if (raw === "fr") return "fr";
  if (
    (raw === "en" || raw === "und" || raw == null || raw === "in") &&
    FR_DIACRITICS.test(t) &&
    FR_WORDS.test(t)
  ) {
    return "fr";
  }
  if (raw && raw !== "und" && raw !== "qme" && raw !== "zxx" && raw !== "qst") {
    return raw;
  }
  if (JP_RX.test(t)) return "ja";
  if (FR_WORDS.test(t)) return "fr";
  return raw ?? "en";
}

function cleanText(t: string): string {
  return (t ?? "")
    .replace(/https:\/\/t\.co\/\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDedup(t: string): string {
  return t
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[@#]\w+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n++;
  return n;
}

function relevanceScore(r: TweetRow, text: string): number {
  if (!text) return 0;
  let score = 0;
  const fromBey = BEY_ACCOUNTS.has((r.author_username ?? "").toLowerCase());
  if (fromBey) score += 0.45;

  const strong = countMatches(text, STRONG);
  if (strong > 0) score += 0.55 + Math.min(strong - 1, 2) * 0.1;

  const parts = countMatches(text, PARTS);
  score += Math.min(parts, 3) * 0.22;

  const community = countMatches(text, COMMUNITY);
  score += Math.min(community, 2) * 0.1;

  if (fromBey && strong === 0 && (parts > 0 || community > 0)) score += 0.15;

  return Math.min(score, 1);
}

function classifyTopic(text: string): string {
  if (T_PLAINTE.test(text)) return "plainte_pieces";
  if (T_SORTIE.test(text)) return "sortie_produit";
  if (T_TOURNOI.test(text)) return "tournoi";
  if (T_META.test(text)) return "meta_combo";
  if (T_ANIME.test(text)) return "anime";
  return "communaute";
}

function classify(r: TweetRow): {
  text: string;
  lang: string;
  relevance: number;
  topic: string;
  isRt: boolean;
} {
  const isRt = (r.text ?? "").startsWith("RT @");
  const text = cleanText(r.text);
  const relevance = relevanceScore(r, text);
  return {
    text,
    lang: detectLang(text, r.lang),
    relevance,
    topic: relevance >= RELEVANCE_THRESHOLD ? classifyTopic(text) : "hors_sujet",
    isRt,
  };
}

// ---------------------------------------------------------------------------

function pct(n: number, total: number): string {
  return total === 0 ? "0" : ((n / total) * 100).toFixed(1);
}

function main() {
  const db = new Database(STORE, { readonly: true });
  const rows = db
    .query<TweetRow, []>(
      `SELECT id, author_username, author_name, text, like_count, retweet_count,
              reply_count, quote_count, created_at, lang
         FROM tweets`,
    )
    .all();
  db.close();

  const total = rows.length;
  let rtRaw = 0;
  let relevant = 0;
  let nearDup = 0;
  const topicCounts = new Map<string, number>();
  const langCounts = new Map<string, number>();
  const langCountsRelevant = new Map<string, number>();
  const authorRelevant = new Map<string, { n: number; eng: number }>();
  const falsePositivesAvoided: Array<{ author: string; text: string; reason: string }> = [];
  const seen = new Set<string>();

  // Tri par engagement pour que la dédup garde le plus engageant.
  rows.sort((a, b) => b.like_count + b.retweet_count - (a.like_count + a.retweet_count));

  for (const r of rows) {
    const c = classify(r);
    langCounts.set(c.lang, (langCounts.get(c.lang) ?? 0) + 1);
    if (c.isRt) rtRaw++;

    if (c.relevance >= RELEVANCE_THRESHOLD && !c.isRt && c.text.length >= MIN_LEN) {
      const key = normalizeForDedup(c.text);
      const isDup = seen.has(key);
      if (isDup) {
        nearDup++;
      } else {
        seen.add(key);
        relevant++;
        topicCounts.set(c.topic, (topicCounts.get(c.topic) ?? 0) + 1);
        langCountsRelevant.set(c.lang, (langCountsRelevant.get(c.lang) ?? 0) + 1);
        const a = authorRelevant.get(r.author_username) ?? { n: 0, eng: 0 };
        a.n++;
        a.eng += r.like_count + r.retweet_count;
        authorRelevant.set(r.author_username, a);
      }
    }
  }

  // Échantillon de faux positifs ÉCARTÉS : tweets contenant un terme ambigu
  // (combo/blade/burst/hasbro/launcher seul) mais score sous le seuil.
  const ambiguous = /\b(combo|blade|burst|hasbro|launcher|stadium|spin|battle|metal)\b/i;
  for (const r of rows) {
    if (falsePositivesAvoided.length >= 12) break;
    const c = classify(r);
    if (c.isRt) continue;
    if (c.relevance >= RELEVANCE_THRESHOLD) continue;
    const t = c.text;
    if (t.length < 30) continue;
    if (!ambiguous.test(t)) continue;
    if (BEY_ACCOUNTS.has(r.author_username.toLowerCase())) continue;
    falsePositivesAvoided.push({
      author: r.author_username,
      text: t.slice(0, 120),
      reason: `terme ambigu sans contexte Beyblade (score ${c.relevance.toFixed(2)})`,
    });
  }

  const topAuthors = [...authorRelevant.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].eng - a[1].eng)
    .slice(0, 20);

  const topicOrder = [
    "meta_combo",
    "tournoi",
    "sortie_produit",
    "anime",
    "plainte_pieces",
    "communaute",
    "hors_sujet",
  ];

  const lines: string[] = [];
  lines.push("# Corpus X.com Beyblade — rapport de classification");
  lines.push("");
  lines.push(`> Genere par \`scripts/analyze-x-corpus.ts\` le ${new Date().toISOString()}.`);
  lines.push("> Source : `~/.aphrody/x-store.sqlite` (store RAG partage, **lecture seule**).");
  lines.push("");
  lines.push("## Vue d'ensemble");
  lines.push("");
  lines.push(`- **Total tweets** : ${total}`);
  lines.push(`- **RT bruts** (\`RT @\`) : ${rtRaw} (${pct(rtRaw, total)}%)`);
  lines.push(
    `- **Pertinents Beyblade** (score >= ${RELEVANCE_THRESHOLD}, hors RT, dedoublonnes) : ${relevant} (${pct(relevant, total)}%)`,
  );
  lines.push(`- **Near-duplicates ecartes** (memes pertinents) : ${nearDup}`);
  lines.push(`- **Auteurs distincts pertinents** : ${authorRelevant.size}`);
  lines.push("");
  lines.push("## Distribution par topic (sur le corpus pertinent retenu)");
  lines.push("");
  lines.push("| Topic | Count | % du pertinent |");
  lines.push("| --- | --- | --- |");
  for (const t of topicOrder) {
    const n = topicCounts.get(t) ?? 0;
    if (n === 0 && t === "hors_sujet") continue;
    lines.push(`| ${t} | ${n} | ${pct(n, relevant)}% |`);
  }
  lines.push("");
  lines.push("## Distribution par langue");
  lines.push("");
  lines.push("| Langue | Tout le corpus | Corpus pertinent |");
  lines.push("| --- | --- | --- |");
  const allLangs = [...new Set([...langCounts.keys(), ...langCountsRelevant.keys()])].sort(
    (a, b) => (langCounts.get(b) ?? 0) - (langCounts.get(a) ?? 0),
  );
  for (const l of allLangs) {
    lines.push(`| ${l} | ${langCounts.get(l) ?? 0} | ${langCountsRelevant.get(l) ?? 0} |`);
  }
  lines.push("");
  lines.push("## Top 20 auteurs Beyblade (corpus pertinent)");
  lines.push("");
  lines.push("| # | Auteur | Tweets retenus | Engagement total (likes+RT) |");
  lines.push("| --- | --- | --- | --- |");
  topAuthors.forEach(([author, a], i) => {
    lines.push(`| ${i + 1} | @${author} | ${a.n} | ${a.eng} |`);
  });
  lines.push("");
  lines.push("## Exemples de faux positifs ecartes");
  lines.push("");
  lines.push(
    "Tweets contenant un terme **ambigu** (combo/blade/burst/hasbro/launcher/stadium seul)",
  );
  lines.push("mais sous le seuil de pertinence, donc exclus du corpus :");
  lines.push("");
  for (const fp of falsePositivesAvoided) {
    lines.push(`- **@${fp.author}** (${fp.reason})`);
    lines.push(`  > ${fp.text.replace(/\n/g, " ")}`);
  }
  lines.push("");
  lines.push("## Methodologie");
  lines.push("");
  lines.push(
    "Classifieur duplique dans `scripts/analyze-x-corpus.ts` et `scripts/export-x-discussions.ts`.",
  );
  lines.push("");
  lines.push(
    "1. **Langue** : `lang` du store, complete par heuristique (scripts JP hiragana/katakana/kanji, diacritiques + stop-words FR).",
  );
  lines.push(
    "2. **Score de pertinence [0..1]** : somme ponderee de signaux Beyblade NON-ambigus — `beyblade`/`ベイブレード`/`#ベイ`, codes produit (`CX-`/`UX-`/`BX-`), noms de blades & bits (Dran Sword, Wizard Rod, Cobalt Drake, Shark Edge, Bullet Griffon, ratchet, xtreme bit, 3-60...), termes communautaires (tournoi/大会/blader). Compte allowliste = bonus fort. Les termes ambigus seuls (combo, blade, burst, hasbro, launcher) **ne suffisent pas** a franchir le seuil.",
  );
  lines.push(
    `3. **Seuil** : un tweet est retenu si \`relevance >= ${RELEVANCE_THRESHOLD}\`, hors RT brut, longueur >= ${MIN_LEN}, non near-duplicate.`,
  );
  lines.push(
    "4. **Topic** : {meta_combo, tournoi, sortie_produit, anime, plainte_pieces, communaute, hors_sujet} par priorite (plainte > sortie > tournoi > meta > anime > communaute).",
  );
  lines.push(
    "5. **Dedup** : cle = texte normalise (minuscules, sans URL/mention/hashtag/ponctuation, espaces compactes), prefixe 90 chars. Le plus engageant gagne.",
  );
  lines.push("");

  Bun.write(REPORT, lines.join("\n") + "\n");
  console.log(`Rapport ecrit : ${REPORT}`);
  console.log(
    `total=${total} rtRaw=${rtRaw} pertinent=${relevant} (${pct(relevant, total)}%) nearDup=${nearDup}`,
  );
  console.log("topics:", topicOrder.map((t) => `${t}=${topicCounts.get(t) ?? 0}`).join(" "));
}

main();
