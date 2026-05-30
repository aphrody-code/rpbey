#!/usr/bin/env bun
/**
 * export-x-discussions.ts — extrait les discussions X.com (Twitter) pertinentes
 * Beyblade depuis le store RAG partagé `~/.aphrody/x-store.sqlite` et les écrit
 * dans `apps/web/data/x-discussions.json` pour alimenter l'index de recherche
 * global (catégorie "discussion").
 *
 * Le store contient ~8400 tweets aspirés via le graphe social de comptes Beyblade,
 * mais la majorité est hors-sujet (bruit du graphe : viral non-Beyblade). Ce script
 * isole le sous-ensemble réellement Beyblade via un classifieur de pertinence :
 *   - score de pertinence [0..1] bâti sur un lexique Beyblade NON-ambigu
 *     (beyblade/ベイブレード/#ベイ, codes produit CX-/UX-/BX-, blades & bits,
 *     ratchet, xtreme, Takara Tomy, blader/toupie) + bonus compte allowliste,
 *   - hors retweets bruts (`RT @…`), texte assez long, dédoublonné (near-dup),
 *   - trié par (pertinence, engagement), plafonné.
 *
 * Chaque discussion porte un `topic` et une `relevance` (utiles au futur corpus
 * unifié). Le classifieur est dupliqué tel quel depuis `analyze-x-corpus.ts`
 * (scripts autonomes, hors module partagé).
 *
 * Lecture seule (`mode: "readonly"`) — ne modifie jamais le store partagé.
 * Lancer : `bun apps/web/scripts/export-x-discussions.ts`
 */
import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { XDiscussionSchema } from "@rpbey/api-contract";
import { contentFingerprint } from "./lib/scrape-utils";

const STORE = process.env.X_STORE_PATH ?? join(homedir(), ".aphrody", "x-store.sqlite");
const OUT = join(import.meta.dir, "..", "data", "x-discussions.json");
const CAP = 800;
const MIN_LEN = 24;
const RELEVANCE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Classifieur Beyblade (dupliqué depuis analyze-x-corpus.ts — garder en phase)
// ---------------------------------------------------------------------------

interface TweetRow {
  id: string;
  author_username: string;
  author_name: string;
  text: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  created_at: string | null;
  lang: string | null;
}

// Comptes Beyblade établis (seeds + créateurs observés). Bonus de pertinence fort.
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

// ---------------------------------------------------------------------------

interface Discussion {
  id: string;
  author: string;
  authorName: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
  lang: string | null;
  createdAt: string | null;
  topic: string;
  relevance: number;
}

function main() {
  // Store RAG partagé (aphrody) : ouverture STRICTEMENT en lecture seule —
  // ce script n'écrit jamais dans x-store.sqlite.
  const db = new Database(STORE, { readonly: true });
  const rows = db
    .query<TweetRow, []>(
      `SELECT id, author_username, author_name, text, like_count, retweet_count,
              reply_count, created_at, lang
         FROM tweets
        WHERE text NOT LIKE 'RT @%'`,
    )
    .all();
  db.close();

  // Tri par engagement d'abord : la dédup garde la version la plus engageante.
  rows.sort((a, b) => b.like_count + b.retweet_count - (a.like_count + a.retweet_count));

  const seenFp = new Set<string>(); // dédup par fingerprint de contenu normalisé
  const discussions: Discussion[] = [];
  let rejected = 0;
  let dupContent = 0;

  for (const r of rows) {
    const text = cleanText(r.text);
    if (text.length < MIN_LEN) continue;
    const relevance = relevanceScore(r, text);
    if (relevance < RELEVANCE_THRESHOLD) continue;

    // Dédup par empreinte de contenu (le texte porte un dédoublonnage plus robuste
    // que l'URL : retweets / quasi-doublons sur des ids de tweet distincts).
    const fp = contentFingerprint(text);
    if (seenFp.has(fp)) {
      dupContent++;
      continue;
    }

    const candidate = {
      id: r.id,
      author: r.author_username,
      authorName: r.author_name || r.author_username,
      text,
      likes: r.like_count,
      retweets: r.retweet_count,
      replies: r.reply_count,
      url: `https://x.com/${r.author_username}/status/${r.id}`,
      lang: detectLang(text, r.lang),
      createdAt: r.created_at,
      topic: classifyTopic(text),
      relevance: Math.round(relevance * 100) / 100,
    };

    // Validation Zod à l'ingestion : on n'écrit que les enregistrements conformes
    // au contrat consommé par global-search (loadXDiscussions).
    const parsed = XDiscussionSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected++;
      continue;
    }
    seenFp.add(fp);
    discussions.push(parsed.data);
  }

  // Tri final : pertinence décroissante, puis engagement décroissant.
  discussions.sort(
    (a, b) => b.relevance - a.relevance || b.likes + b.retweets - (a.likes + a.retweets),
  );

  const capped = discussions.slice(0, CAP);

  if (rejected > 0) console.log(`[x] ${rejected} rejetés au schéma`);
  if (dupContent > 0) console.log(`[x] ${dupContent} doublons de contenu écartés`);

  if (capped.length === 0) {
    console.error("[x] 0 discussion valide — fichier préservé (non destructif).");
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "x.com via ~/.aphrody/x-store.sqlite (RAG Beyblade)",
    count: capped.length,
    discussions: capped,
  };
  Bun.write(OUT, JSON.stringify(payload, null, 2));
  console.log(`x-discussions.json : ${capped.length} discussions Beyblade exportées → ${OUT}`);

  const byTopic = new Map<string, number>();
  for (const d of capped) byTopic.set(d.topic, (byTopic.get(d.topic) ?? 0) + 1);
  console.log("Topics :", [...byTopic.entries()].map(([t, n]) => `${t}(${n})`).join(", "));

  const byAuthor = new Map<string, number>();
  for (const d of capped) byAuthor.set(d.author, (byAuthor.get(d.author) ?? 0) + 1);
  const top = [...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log("Top auteurs :", top.map(([a, n]) => `${a}(${n})`).join(", "));
}

main();
