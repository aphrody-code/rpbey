// Scraper Amazon.fr -> produits Beyblade pour bx-catalog.json.
// Session authentifiee via jar Netscape (SECRET, hors repo). Recette validee:
//   1. GET /s?k=<q> avec jar. Si la reponse est un challenge Akamai
//      (meta refresh bm-verify et peu de data-asin), extraire l'URL bm-verify,
//      sleep 5s, re-GET dessus (le -c met a jour bm_sv dans le jar).
//   2. La 2e reponse (ou la 1ere si le jar est deja chaud) = vrais resultats.
// Si la session a expire (bm-verify SANS >=50 data-asin), skip Amazon proprement.
// 100% Bun natif (HTMLRewriter / curlGet / Bun.file).
// Validation Zod a l'ingestion (CatalogProductSchema) + dedup par fingerprint de
// contenu, en plus de la dedup par ASIN. Rate-limiting par domaine.

import os from "node:os";
import path from "node:path";
import { CatalogProductSchema, type CatalogProduct } from "@rpbey/api-contract";
import { contentFingerprint, curlGet, RateLimiter } from "./lib/scrape-utils";

const JAR =
  process.env.AMAZON_COOKIE_JAR || path.join(os.homedir(), ".aphrody", "amazon-fr-cookies.txt");

type RawItem = { asin: string; title?: string; price?: string; img?: string };

const QUERIES = ["beyblade x", "beyblade x toupie", "beyblade x stadium", "beyblade x lanceur"];

// Crawl de contenu : ~4 s entre requetes amazon.fr (token bucket par domaine).
const limiter = new RateLimiter({ "www.amazon.fr": 4000 }, 4000);

async function amazonGet(url: string): Promise<{ html: string; status: number }> {
  await limiter.wait(RateLimiter.hostOf(url));
  return curlGet(url, {
    jar: JAR,
    headers: [
      "Accept-Language: fr-FR,fr;q=0.9",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ],
  });
}

function countAsins(html: string): number {
  return new Set(html.match(/data-asin="[A-Z0-9]{10}"/g) ?? []).size;
}

// Extrait l'URL relative bm-verify d'un meta refresh challenge Akamai.
function extractBmVerify(html: string): string | null {
  const meta = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*URL=([^"']+)["']/i);
  if (meta?.[1]) return decodeHtml(meta[1]);
  // Variante: URL='...' avec quotes internes
  const alt = html.match(/content=["']\d+;\s*URL=['"]?([^'"]+)['"]?/i);
  if (alt?.[1]) return decodeHtml(alt[1]);
  return null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&#38;/g, "&")
    .trim();
}

// Sleep dedie au challenge Akamai (delai metier, pas du pacing par domaine).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSearch(query: string): Promise<string | null> {
  const base = `https://www.amazon.fr/s?k=${encodeURIComponent(query)}`;
  let { html, status } = await amazonGet(base);
  console.log(
    `[amazon] "${query}" step1 -> HTTP ${status}, ${html.length}o, ${countAsins(html)} asins`,
  );

  // Jar deja chaud: vrais resultats directement
  if (status === 200 && countAsins(html) >= 50) return html;

  // Challenge Akamai: meta refresh bm-verify
  const bm = extractBmVerify(html);
  if (bm) {
    const verifyUrl = bm.startsWith("http") ? bm : `https://www.amazon.fr${bm}`;
    console.log(`[amazon] "${query}" challenge bm-verify, sleep 5s puis retry`);
    await sleep(5000);
    ({ html, status } = await amazonGet(verifyUrl));
    console.log(
      `[amazon] "${query}" step2 -> HTTP ${status}, ${html.length}o, ${countAsins(html)} asins`,
    );
    if (status === 200 && countAsins(html) >= 50) return html;
  }

  // Encore peu de resultats apres challenge: session expiree
  if (countAsins(html) < 50) {
    console.log(`[amazon] "${query}" session probablement expiree (<50 asins)`);
    return countAsins(html) > 0 ? html : null;
  }
  return html;
}

async function parseProducts(html: string): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cur: RawItem | null = null;
  let titleActive = false;
  await new HTMLRewriter()
    .on('div[data-component-type="s-search-result"]', {
      element(el) {
        const asin = el.getAttribute("data-asin");
        if (asin) {
          cur = { asin };
          items.push(cur);
        }
      },
    })
    .on("img.s-image", {
      element(el) {
        if (cur && !cur.img) cur.img = el.getAttribute("src") ?? undefined;
      },
    })
    .on("h2 span", {
      element() {
        titleActive = true;
      },
      text(t) {
        if (cur && !cur.title && t.text.trim()) cur.title = (cur.title ?? "") + t.text;
        if (t.lastInTextNode) titleActive = false;
      },
    })
    .on("span.a-price > span.a-offscreen", {
      text(t) {
        if (cur && !cur.price && t.text.trim()) cur.price = t.text.trim();
      },
    })
    .transform(new Response(html))
    .text();
  return items;
}

// "20,86 €" / "1 234,56 €" -> 20.86
function parsePrice(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  // EUR FR: virgule decimale, espace/point milliers (deja vire les espaces)
  const normalized = cleaned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main() {
  const products: CatalogProduct[] = [];
  const seenAsin = new Set<string>();
  const seenFp = new Set<string>(); // dedup par fingerprint de titre normalise
  let rejected = 0;
  let dupContent = 0;
  let anyResults = false;

  for (const q of QUERIES) {
    const html = await fetchSearch(q);
    if (!html) continue;
    if (countAsins(html) >= 50) anyResults = true;

    const raw = await parseProducts(html);
    let added = 0;
    for (const it of raw) {
      if (seenAsin.has(it.asin)) continue;
      if (!it.title) continue;
      seenAsin.add(it.asin);

      const title = it.title.trim().replace(/\s+/g, " ");
      // Dedup par contenu : meme produit reliste sous un ASIN different.
      const fp = contentFingerprint(title);
      if (seenFp.has(fp)) {
        dupContent++;
        continue;
      }

      const price = parsePrice(it.price);
      const candidate = {
        shop: "Amazon.fr",
        domain: "amazon.fr",
        region: "FR",
        type: "marketplace",
        currency: "EUR",
        title,
        price,
        priceMax: null,
        available: price != null,
        url: `https://www.amazon.fr/dp/${it.asin}`,
        image: it.img ?? null,
      };

      // Validation Zod a l'ingestion : on n'ecrit que les enregistrements conformes.
      const parsed = CatalogProductSchema.safeParse(candidate);
      if (!parsed.success) {
        rejected++;
        continue;
      }
      seenFp.add(fp);
      products.push(parsed.data);
      added++;
    }
    console.log(
      `[amazon] "${q}" -> ${raw.length} cards, +${added} nouveaux (total ${products.length})`,
    );
  }

  if (rejected > 0) console.log(`[amazon] ${rejected} rejetes au schema`);
  if (dupContent > 0) console.log(`[amazon] ${dupContent} doublons de contenu ecartes`);

  if (!anyResults && products.length === 0) {
    console.log(
      "[amazon] aucune page de resultats valide -> session expiree, skip (non destructif)",
    );
    return;
  }

  // On ne garde que les produits avec un prix (un comparateur de prix sans prix = bruit)
  const priced = products.filter((p) => p.available && p.price != null && p.price > 0);
  console.log(
    `\n[amazon] TOTAL ${products.length} produits uniques, ${priced.length} avec prix EUR`,
  );
  if (priced.length) {
    const prices = priced.map((p) => p.price as number).sort((a, b) => a - b);
    console.log(
      `[amazon] prix EUR min=${prices[0]} max=${prices[prices.length - 1]} median=${
        prices[Math.floor(prices.length / 2)]
      }`,
    );
    console.log("[amazon] exemples:");
    for (const p of priced.slice(0, 5)) console.log(`  ${p.price}EUR  ${p.title.slice(0, 60)}`);
  }

  if (priced.length === 0) {
    console.log("[amazon] 0 produit avec prix -> aucune ecriture (non destructif)");
    return;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "amazon.fr",
    count: priced.length,
    products: priced,
  };
  await Bun.write("/tmp/amazon-fr-products.json", JSON.stringify(payload, null, 2));
  console.log(`[amazon] ecrit /tmp/amazon-fr-products.json (${priced.length})`);
}

await main();

export {};
