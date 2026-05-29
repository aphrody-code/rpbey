#!/usr/bin/env bun
/**
 * Comparateur Beyblade X — scraper multi-stratégie des catalogues boutiques.
 *
 * Fusionne `data/bx-sources/*.json`, déduplique par domaine, puis scrape chaque
 * boutique avec une CHAÎNE de stratégies (première non-vide gagne), pour une
 * précision par site maximale :
 *
 *   1. Shopify  : `/collections/<h>/products.json` (JSON structuré)
 *   2. WooComm. : `/wp-json/wc/store/v1/products?search=beyblade x` (JSON officiel)
 *   3. JSON-LD  : `<script type=ld+json>` Product/Offer/ItemList parsé via
 *                 **Bun.HTMLRewriter** (natif, streaming) — précis sur Presta/custom
 *   4. bxc      : `bxc scrape <url> --markdown --profile http` (curl-impersonate,
 *                 contourne Cloudflare/TLS) — dernier recours pour sites protégés
 *
 * 100 % Bun natif (Bun.Glob / Bun.file / Bun.write / HTMLRewriter / Bun.spawn).
 *   cd apps/web && bun scripts/scrape-bx-shops.ts
 */
const SRC_DIR = `${import.meta.dir}/../data/bx-sources`;
const OUT = `${import.meta.dir}/../data/bx-catalog.json`;

interface Shop {
  name: string;
  domain: string;
  url: string;
  region: string;
  type: string;
  sources?: string[];
}
interface Product {
  shop: string;
  domain: string;
  region: string;
  type: string;
  currency: string;
  title: string;
  price: number | null;
  priceMax: number | null;
  available: boolean;
  url: string;
  image: string | null;
}

const CURRENCY_BY_REGION: Record<string, string> = {
  FR: "EUR",
  BE: "EUR",
  EU: "EUR",
  CH: "CHF",
  UK: "GBP",
  US: "USD",
  JP: "JPY",
  INT: "USD",
};
const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.86,
  GBP: 1.15,
  CHF: 1.09,
  JPY: 0.0054,
};
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const BXC_BIN = "/home/ubuntu/.local/bin/bxc";
const BX_RE = /beyblade ?x|\bbx-?\d|\bux-?\d|\bcx-?\d|\d-\d{2}[a-z]{1,3}\b/i;

const normDomain = (d: string) => d.toLowerCase().replace(/^www\./, "");
const isCollectionUrl = (u: string) =>
  /collections|beyblade-x|cBeyX|category|categorie-produit/i.test(u);

// ── fusion sources ────────────────────────────────────────────────
async function mergeSources(): Promise<{ shops: Shop[]; sourceCount: number }> {
  const glob = new Bun.Glob("*.json");
  const byDomain = new Map<string, Shop>();
  let sourceCount = 0;
  for await (const file of glob.scan({ cwd: SRC_DIR })) {
    sourceCount += 1;
    const data = (await Bun.file(`${SRC_DIR}/${file}`).json()) as { source: string; shops: Shop[] };
    for (const s of data.shops ?? []) {
      const dom = normDomain(s.domain);
      let url = s.url;
      if (dom === "takaratomymall.jp") {
        url = "https://takaratomymall.jp/shop/c/cBeyX/";
      }
      const cur = byDomain.get(dom);
      if (cur) {
        cur.sources = [...new Set([...(cur.sources ?? []), data.source])];
        if (isCollectionUrl(url) && !isCollectionUrl(cur.url)) cur.url = url;
      } else byDomain.set(dom, { ...s, domain: dom, url, sources: [data.source] });
    }
  }
  return { shops: [...byDomain.values()], sourceCount };
}

function collectionBase(url: string): string | null {
  return url.match(/^(https?:\/\/[^/]+\/collections\/[^/?#]+)/i)?.[1] ?? null;
}
const CURL_IMPERSONATE_BIN = "/home/ubuntu/.local/bin/curl-impersonate";
const IMP_ARGS = [
  "--ciphers",
  "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA",
  "--curves",
  "X25519MLKEM768:X25519:P-256:P-384",
  "-H",
  'sec-ch-ua: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "-H",
  "sec-ch-ua-mobile: ?0",
  "-H",
  'sec-ch-ua-platform: "macOS"',
  "-H",
  "Upgrade-Insecure-Requests: 1",
  "-H",
  "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "-H",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "-H",
  "Sec-Fetch-Site: none",
  "-H",
  "Sec-Fetch-Mode: navigate",
  "-H",
  "Sec-Fetch-User: ?1",
  "-H",
  "Sec-Fetch-Dest: document",
  "-H",
  "Accept-Encoding: gzip, deflate, br, zstd",
  "-H",
  "Accept-Language: en-US,en;q=0.9",
  "-H",
  "Priority: u=0, i",
  "--split-cookies",
  "--http2",
  "--http2-settings",
  "1:65536;2:0;4:6291456;6:262144",
  "--http2-window-update",
  "15663105",
  "--http2-stream-weight",
  "256",
  "--http2-stream-exclusive",
  "1",
  "--compressed",
  "--ech",
  "true",
  "--tlsv1.2",
  "--alps",
  "--tls-permute-extensions",
  "--cert-compression",
  "brotli",
  "--tls-grease",
  "--tls-signed-cert-timestamps",
];

function getDomainConfig(domain: string) {
  const isBigW = domain.includes("bigw.com.au");
  return {
    timeout: isBigW ? 5000 : 12000,
    forceHttp1: isBigW,
  };
}

// Fetch TLS-impersonate (Chrome 131) — contourne Cloudflare / blocages JA3/JA4.
async function impFetch(u: string, timeoutMs = 15000, forceHttp1 = false): Promise<string | null> {
  try {
    const args = [...IMP_ARGS];
    if (forceHttp1) {
      const idx = args.indexOf("--http2");
      if (idx !== -1) {
        args[idx] = "--http1.1";
      }
    }
    const proc = Bun.spawn(
      [
        CURL_IMPERSONATE_BIN,
        ...args,
        "-s",
        "-L",
        "--max-time",
        String(Math.round(timeoutMs / 1000)),
        u,
      ],
      { stdout: "pipe", stderr: "ignore" },
    );
    const timer = setTimeout(() => {
      try {
        proc.kill(9);
      } catch {}
    }, timeoutMs + 2000);
    const txt = await new Response(proc.stdout).text();
    await proc.exited;
    clearTimeout(timer);
    return txt && txt.length > 20 ? txt : null;
  } catch {
    return null;
  }
}

// fetch rapide (plain) puis fallback impersonate si bloqué/échoué.
async function fetchText(u: string, timeoutMs = 8000): Promise<string | null> {
  const domain = new URL(u).hostname.replace(/^www\./, "");
  const cfg = getDomainConfig(domain);
  try {
    const r = await fetch(u, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(cfg.timeout),
    });
    if (r.ok) {
      const t = await r.text();
      if (t && !/just a moment|checkpoint|cf-browser-verification/i.test(t.slice(0, 600))) return t;
    }
  } catch {
    /* fallthrough */
  }
  return impFetch(u, Math.max(cfg.timeout, 12000), cfg.forceHttp1);
}
async function fetchJson(u: string, timeoutMs = 8000): Promise<unknown> {
  const domain = new URL(u).hostname.replace(/^www\./, "");
  const cfg = getDomainConfig(domain);
  try {
    const r = await fetch(u, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(cfg.timeout),
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return await r.json();
  } catch {
    /* fallthrough */
  }
  // fallback TLS-impersonate (raw body → JSON.parse)
  const raw = await impFetch(u, Math.max(cfg.timeout, 12000), cfg.forceHttp1);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// fetch JSON plain uniquement (rapide) — pour le multi-probe Shopify.
async function fetchJsonFast(u: string, timeoutMs = 6000): Promise<unknown> {
  const domain = new URL(u).hostname.replace(/^www\./, "");
  const cfg = getDomainConfig(domain);
  try {
    const r = await fetch(u, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(cfg.timeout),
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return await r.json();
  } catch {
    /* ignore */
  }
  return null;
}

function mkProduct(shop: Shop, currency: string, o: Partial<Product>): Product {
  return {
    shop: shop.name,
    domain: shop.domain,
    region: shop.region,
    type: shop.type,
    currency,
    title: o.title ?? "",
    price: o.price ?? null,
    priceMax: o.priceMax ?? null,
    available: o.available ?? true,
    url: o.url ?? `https://${shop.domain}`,
    image: o.image ?? null,
  };
}
function dedup(list: Product[]): Product[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const k = `${p.title}|${p.price}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── 1. Shopify ────────────────────────────────────────────────────
interface ShopifyRaw {
  title: string;
  handle: string;
  product_type?: string;
  tags?: string[] | string;
  variants?: { price: string; available?: boolean }[];
  images?: { src: string }[];
  featured_image?: string;
}
async function scrapeShopify(shop: Shop, currency: string): Promise<Product[] | null> {
  const root = `https://${shop.domain}`;
  const cands: { url: string; whole: boolean }[] = [];
  const base = collectionBase(shop.url);
  if (base) cands.push({ url: `${base}/products.json?limit=250`, whole: false });
  for (const h of [
    "beyblade-x",
    "toupie-beyblade-x",
    "beyblade-x-2023",
    "beyblade-x-4th-generation",
  ])
    cands.push({ url: `${root}/collections/${h}/products.json?limit=250`, whole: false });
  cands.push({ url: `${root}/products.json?limit=250`, whole: true });
  for (let ci = 0; ci < cands.length; ci++) {
    const { url, whole } = cands[ci]!;
    // probe plain (rapide) ; si tout échoue, 1 retry impersonate sur la base.
    let j = (await fetchJsonFast(url)) as { products?: ShopifyRaw[] } | null;
    if ((!j?.products || j.products.length === 0) && ci === 0)
      j = (await fetchJson(url)) as { products?: ShopifyRaw[] } | null;
    const prods = j?.products;
    if (!Array.isArray(prods) || prods.length === 0) continue;
    const list = whole
      ? prods.filter((p) => BX_RE.test(`${p.title} ${p.product_type} ${p.tags}`))
      : prods;
    if (list.length === 0) continue;
    return list.map((p) => {
      const prices = (p.variants ?? []).map((v) => parseFloat(v.price)).filter((n) => n > 0);
      return mkProduct(shop, currency, {
        title: p.title,
        price: prices.length ? Math.min(...prices) : null,
        priceMax: prices.length ? Math.max(...prices) : null,
        available: (p.variants ?? []).some((v) => v.available),
        url: `${root}/products/${p.handle}`,
        image: p.images?.[0]?.src ?? p.featured_image ?? null,
      });
    });
  }
  return null;
}

// ── 2. WooCommerce Store API ──────────────────────────────────────
interface WooRaw {
  name: string;
  permalink: string;
  is_in_stock?: boolean;
  prices?: { price: string; currency_code?: string; currency_minor_unit?: number };
  images?: { src: string }[];
}
async function scrapeWoo(shop: Shop, currency: string): Promise<Product[] | null> {
  const root = `https://${shop.domain}`;
  const j = (await fetchJson(
    `${root}/wp-json/wc/store/v1/products?per_page=100&search=beyblade%20x`,
    10000,
  )) as WooRaw[] | null;
  if (!Array.isArray(j) || j.length === 0) return null;
  const list = j.filter((p) => BX_RE.test(p.name));
  if (list.length === 0) return null;
  return list.map((p) => {
    const minor = p.prices?.currency_minor_unit ?? 2;
    const raw = p.prices?.price ? parseInt(p.prices.price, 10) : NaN;
    const price = Number.isFinite(raw) ? raw / 10 ** minor : null;
    return mkProduct(shop, p.prices?.currency_code ?? currency, {
      title: p.name,
      price,
      priceMax: price,
      available: p.is_in_stock ?? true,
      url: p.permalink,
      image: p.images?.[0]?.src ?? null,
    });
  });
}

// ── 3. JSON-LD via Bun.HTMLRewriter ───────────────────────────────
async function scrapeJsonLd(shop: Shop, currency: string): Promise<Product[] | null> {
  const html = await fetchText(shop.url, 10000);
  if (!html) return null;
  const blocks: string[] = [];
  let buf = "";
  let capturing = false;
  const rewriter = new HTMLRewriter().on('script[type="application/ld+json"]', {
    element() {
      capturing = true;
      buf = "";
    },
    text(t) {
      if (capturing) {
        buf += t.text;
        if (t.lastInTextNode) {
          /* keep */
        }
      }
    },
  });
  // HTMLRewriter.transform consomme le HTML ; on récupère le texte des scripts
  // en re-parsant manuellement (HTMLRewriter ne donne pas la fin d'élément ici).
  rewriter.transform(new Response(html));
  // Fallback robuste : extraction directe des blocs ld+json par regex (le
  // streaming text de HTMLRewriter ne délimite pas proprement chaque script).
  void buf;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))
    if (m[1]) blocks.push(m[1].trim());
  if (blocks.length === 0) return null;

  const out: Product[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    const type = n["@type"];
    const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (isProduct && typeof n.name === "string" && BX_RE.test(n.name)) {
      const offers = (Array.isArray(n.offers) ? n.offers : n.offers ? [n.offers] : []) as Record<
        string,
        unknown
      >[];
      const prices = offers
        .map((o) =>
          parseFloat(
            String(o.price ?? (o.priceSpecification as Record<string, unknown>)?.price ?? ""),
          ),
        )
        .filter((x) => Number.isFinite(x) && x > 0);
      const cur = String(offers[0]?.priceCurrency ?? currency);
      out.push(
        mkProduct(shop, cur || currency, {
          title: n.name,
          price: prices.length ? Math.min(...prices) : null,
          priceMax: prices.length ? Math.max(...prices) : null,
          available: true,
          url: typeof n.url === "string" ? n.url : shop.url,
          image:
            typeof n.image === "string"
              ? n.image
              : Array.isArray(n.image)
                ? String(n.image[0])
                : null,
        }),
      );
    }
    // ItemList → itemListElement[].item
    const items = n.itemListElement;
    if (Array.isArray(items))
      for (const it of items) visit((it as Record<string, unknown>).item ?? it);
    if (Array.isArray(n["@graph"])) for (const g of n["@graph"]) visit(g);
  };
  for (const b of blocks) {
    try {
      visit(JSON.parse(b));
    } catch {
      /* skip malformed */
    }
  }
  return out.length ? out : null;
}

function parsePrice(raw: string, currency: string): number | null {
  let clean = raw.replace(/[^\d.,']/g, "").trim();
  if (!clean) return null;

  if (currency === "EUR") {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/[,']/g, "");
  }
  const v = parseFloat(clean);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ── 4. bxc (curl-impersonate, contourne Cloudflare) ───────────────
async function scrapeBxc(shop: Shop, currency: string): Promise<Product[] | null> {
  const cfg = getDomainConfig(shop.domain);
  try {
    const proc = Bun.spawn(
      [
        BXC_BIN,
        "--timeout",
        String(cfg.timeout),
        "scrape",
        shop.url,
        "--markdown",
        "--profile",
        "http",
      ],
      { stdout: "pipe", stderr: "ignore" },
    );
    const timer = setTimeout(() => {
      console.warn(`[timeout] bxc scraping ${shop.domain} hung, killing process...`);
      try {
        proc.kill(9);
      } catch {}
    }, cfg.timeout + 4000);
    const md = await new Response(proc.stdout).text();
    await proc.exited;
    clearTimeout(timer);
    if (!md || /checkpoint|verifying|just a moment/i.test(md.slice(0, 500))) return null;

    const out: Product[] = [];
    const linkRe = /\[(?:!\[[^\]]*\]\([^)]+\)\s*)?([^\]]{4,150})\]\(((?:https?:\/\/|\/)[^)]+)\)/g;
    const priceRe =
      /(?:€|£|\$|EUR|USD|GBP|CHF|¥|JPY)\s?(\d[\d.,]+)|(\d[\d.,]+)\s?[\uFFFD]?\s?(?:€|£|\$|円|¥|~|￥)/;
    const lines = md.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      linkRe.lastIndex = 0;

      let match;
      while ((match = linkRe.exec(line)) !== null) {
        const title = match[1] ?? "";
        const prodUrl = match[2] ?? "";

        if (!BX_RE.test(title)) continue;

        let price: number | null = null;
        // 1. Try to find price inside the link title itself
        const titlePm = title.match(priceRe);
        if (titlePm) {
          price = parsePrice(titlePm[1] ?? titlePm[2] ?? titlePm[0], currency);
        }

        // 2. Try to find price in lines after the link
        if (price === null) {
          for (let j = i; j < Math.min(i + 3, lines.length); j++) {
            const pm = (lines[j] ?? "").match(priceRe);
            if (pm) {
              price = parsePrice(pm[1] ?? pm[2] ?? pm[0], currency);
              if (price !== null) break;
            }
          }
        }

        let absoluteUrl = prodUrl;
        if (absoluteUrl.startsWith("/")) {
          absoluteUrl = `https://${shop.domain}${absoluteUrl}`;
        }

        out.push(
          mkProduct(shop, currency, {
            title: title.trim(),
            price,
            priceMax: price,
            url: absoluteUrl,
          }),
        );
      }
    }
    return out.length ? dedup(out) : null;
  } catch {
    return null;
  }
}

const SHOP_CURRENCY_OVERRIDES: Record<string, string> = {
  "beyblade-kingdom.com": "USD",
  "itsukijapan.com": "USD",
  "toysonejapan.com": "USD",
  "toysstorejapan.com": "USD",
};

const MARKETPLACES = [
  "amazon.fr",
  "amazon.com",
  "amazon.co.uk",
  "amazon.ca",
  "amazon.com.au",
  "amazon.it",
  "amazon.nl",
  "amazon.com.be",
  "ebay.com",
  "ebay.co.uk",
  "ebay.de",
  "aliexpress.com",
  "fr.aliexpress.com",
  "walmart.com",
  "walmart.ca",
  "target.com",
  "cdiscount.com",
  "miravia.es",
  "etsy.com",
  "fr.shopping.rakuten.com",
  "kaufland.de",
];

// ── orchestration ─────────────────────────────────────────────────
async function scrapeShop(shop: Shop): Promise<{ products: Product[]; platform: string }> {
  if (MARKETPLACES.includes(shop.domain)) {
    return { products: [], platform: "link-only" };
  }
  const currency = SHOP_CURRENCY_OVERRIDES[shop.domain] ?? CURRENCY_BY_REGION[shop.region] ?? "?";

  const isIndependent = ["specialist", "import"].includes(shop.type);
  const deepShop = ["specialist", "import", "official", "retailer"].includes(shop.type);

  const chain: [string, (s: Shop, c: string) => Promise<Product[] | null>][] = [
    ...(isIndependent
      ? ([
          ["shopify", scrapeShopify],
          ["woocommerce", scrapeWoo],
        ] as [string, typeof scrapeShopify][])
      : []),
    ["jsonld", scrapeJsonLd],
    // bxc (process spawn, plus lent) réservé aux boutiques à vrai catalogue BX
    ...(deepShop ? ([["bxc", scrapeBxc]] as [string, typeof scrapeBxc][]) : []),
  ];
  for (const [platform, fn] of chain) {
    const r = await fn(shop, currency);
    if (r && r.length) return { products: dedup(r), platform };
  }
  return { products: [], platform: "link-only" };
}

const { shops, sourceCount } = await mergeSources();
console.log(`[merge] ${shops.length} boutiques uniques · ${sourceCount} sources`);

const allProducts: Product[] = [];
const shopRows: (Shop & { currency: string; platform: string; productCount: number })[] = [];
const CONCURRENCY = 8;
for (let i = 0; i < shops.length; i += CONCURRENCY) {
  const batch = shops.slice(i, i + CONCURRENCY);
  const results = await Promise.all(
    batch.map(async (shop) => ({ shop, ...(await scrapeShop(shop)) })),
  );
  for (const { shop, products, platform } of results) {
    const shopCurrency =
      SHOP_CURRENCY_OVERRIDES[shop.domain] ?? CURRENCY_BY_REGION[shop.region] ?? "?";
    const validProducts = products.filter((p) => {
      const rate = FX_TO_EUR[p.currency];
      const priceEur = p.price != null && rate ? p.price * rate : null;
      return priceEur === null || priceEur >= 1.5;
    });
    allProducts.push(...validProducts);
    shopRows.push({
      ...shop,
      currency: shopCurrency,
      platform,
      productCount: validProducts.length,
    });
    console.log(
      `[${platform.padEnd(11)}] ${shop.domain.padEnd(26)} ${String(validProducts.length).padStart(3)}`,
    );
  }
}

shopRows.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
allProducts.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));

const validPrices = allProducts
  .map((p) => {
    const rate = FX_TO_EUR[p.currency];
    return p.price != null && rate ? p.price * rate : null;
  })
  .filter((v): v is number => v !== null);

const averagePriceEur = validPrices.length
  ? Math.round((validPrices.reduce((sum, v) => sum + v, 0) / validPrices.length) * 100) / 100
  : 0;

const scrapedShops = shopRows.filter((s) => s.productCount > 0);
const successRate = shops.length
  ? Math.round((scrapedShops.length / shops.length) * 10000) / 100
  : 0;

// Region statistics: product count and average price
const regionsList = [...new Set(allProducts.map((p) => p.region))].sort();
const regionStats = regionsList.map((reg) => {
  const regProducts = allProducts.filter((p) => p.region === reg);
  const regPrices = regProducts
    .map((p) => {
      const rate = FX_TO_EUR[p.currency];
      return p.price != null && rate ? p.price * rate : null;
    })
    .filter((v): v is number => v !== null);
  const avgPrice = regPrices.length
    ? Math.round((regPrices.reduce((sum, v) => sum + v, 0) / regPrices.length) * 100) / 100
    : null;
  return {
    region: reg,
    productCount: regProducts.length,
    averagePriceEur: avgPrice,
  };
});

// Platform distribution
const platformCounts = shopRows.reduce<Record<string, { total: number; active: number }>>(
  (acc, s) => {
    if (!acc[s.platform]) {
      acc[s.platform] = { total: 0, active: 0 };
    }
    acc[s.platform].total += 1;
    if (s.productCount > 0) {
      acc[s.platform].active += 1;
    }
    return acc;
  },
  {},
);

const platformStats = Object.entries(platformCounts)
  .map(([platform, counts]) => ({
    platform,
    total: counts.total,
    active: counts.active,
  }))
  .sort((a, b) => b.active - a.active);

const out = {
  generatedAt: new Date().toISOString(),
  shopCount: shops.length,
  scrapedShopCount: scrapedShops.length,
  productCount: allProducts.length,
  platforms: shopRows.reduce<Record<string, number>>((a, s) => {
    if (s.productCount) a[s.platform] = (a[s.platform] ?? 0) + 1;
    return a;
  }, {}),
  stats: {
    averagePriceEur,
    successRate,
    regionStats,
    platformStats,
  },
  shops: shopRows,
  products: allProducts,
};
await Bun.write(OUT, JSON.stringify(out, null, 2));
console.log(
  `\n[done] ${out.shopCount} boutiques · ${out.scrapedShopCount} scrapées · ${out.productCount} produits`,
);
console.log("[platforms]", JSON.stringify(out.platforms));
