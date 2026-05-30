// Scraper ZenMarket (proxy JP) -> produits Beyblade pour bx-catalog.json.
// HTTP 200 direct (pas d'auth). ZenMarket fournit deja un prix EUR converti
// dans `span.amount[data-eur]` (ex "€11,21"). Fallback frankfurter JPY->EUR
// uniquement si data-eur absent. 100% Bun natif (HTMLRewriter / Bun.spawn curl).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type CatalogProduct = {
  shop: string;
  domain: string;
  region: string;
  type: string;
  currency: string;
  title: string;
  price: number;
  priceMax?: number;
  available: boolean;
  url: string;
  image: string;
};

type RawItem = { href?: string; img?: string; title?: string; eur?: string; jpy?: string };

const STORES = [
  { key: "yahoo", page: "yahoo.aspx", productPath: null as string | null },
  { key: "mercari", page: "mercari.aspx", productPath: null },
  { key: "rakuten", page: "rakuten.aspx", productPath: null },
];

const QUERIES = ["beyblade x", "ベイブレードX", "beyblade burst"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string): Promise<{ html: string; status: number }> {
  const proc = Bun.spawn(
    [
      "curl",
      "-s",
      "-A",
      UA,
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "-w",
      "\n__HTTP_STATUS__%{http_code}",
      url,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const marker = out.lastIndexOf("\n__HTTP_STATUS__");
  if (marker === -1) return { html: out, status: 0 };
  const status = Number(out.slice(marker + "\n__HTTP_STATUS__".length).trim());
  return { html: out.slice(0, marker), status };
}

// EUR string "€364,54" / "€11,21" -> 364.54
function parseEur(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.replace(/[^0-9.,]/g, "");
  if (!m) return null;
  // ZenMarket EUR format uses comma decimal, dot thousands ("€1.234,56")
  const normalized = m.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseJpy(raw?: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getJpyToEur(): Promise<number> {
  try {
    const { html, status } = await fetchHtml("https://api.frankfurter.app/latest?from=JPY&to=EUR");
    if (status === 200) {
      const data = JSON.parse(html) as { rates?: { EUR?: number } };
      const rate = data.rates?.EUR;
      if (rate && rate > 0) return rate;
    }
  } catch {
    // fall through
  }
  return 0.006;
}

// --- Parsers (selecteurs valides en live) ---

async function parseMercariLike(html: string, store: string): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cur: RawItem | null = null;
  let titleActive = false;
  await new Response(
    new HTMLRewriter()
      .on("a.product-item.product-link", {
        element(el) {
          cur = { href: el.getAttribute("href") ?? undefined };
          items.push(cur);
        },
      })
      .on("a.product-item.product-link img", {
        element(el) {
          if (cur && !cur.img) cur.img = el.getAttribute("src") ?? undefined;
        },
      })
      .on("h3.item-title", {
        element() {
          titleActive = true;
        },
        text(t) {
          if (cur && titleActive && t.text.trim()) cur.title = (cur.title ?? "") + t.text;
          if (t.lastInTextNode) titleActive = false;
        },
      })
      .on("span.current-price span.amount", {
        element(el) {
          if (cur) {
            if (!cur.eur) cur.eur = el.getAttribute("data-eur") ?? undefined;
            if (!cur.jpy) cur.jpy = el.getAttribute("data-jpy") ?? undefined;
          }
        },
      })
      .transform(new Response(html)),
  ).text();
  return items;
}

async function parseYahoo(html: string): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cur: RawItem | null = null;
  let titleActive = false;
  await new Response(
    new HTMLRewriter()
      .on("div.yahoo-search-result", {
        element() {
          cur = {};
          items.push(cur);
        },
      })
      .on("div.yahoo-search-result .img-wrap img", {
        element(el) {
          if (cur && !cur.img) cur.img = el.getAttribute("src") ?? undefined;
        },
      })
      .on("div.yahoo-search-result .translate a.auction-url", {
        element(el) {
          if (cur && !cur.href) {
            cur.href = el.getAttribute("href") ?? undefined;
            titleActive = true;
          }
        },
        text(t) {
          if (cur && titleActive && t.text.trim()) cur.title = (cur.title ?? "") + t.text;
          if (t.lastInTextNode) titleActive = false;
        },
      })
      .on("div.auction-blitzprice span.amount, div.auction-price span.amount", {
        element(el) {
          if (cur) {
            if (!cur.eur) cur.eur = el.getAttribute("data-eur") ?? undefined;
            if (!cur.jpy) cur.jpy = el.getAttribute("data-jpy") ?? undefined;
          }
        },
      })
      .transform(new Response(html)),
  ).text();
  return items;
}

function absUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `https://zenmarket.jp/en/${href.replace(/^\/+/, "")}`;
}

async function main() {
  const jpyToEur = await getJpyToEur();
  console.log(`[zenmarket] JPY->EUR rate = ${jpyToEur}`);

  const products: CatalogProduct[] = [];
  const seen = new Set<string>();
  let fallbackConverts = 0;

  for (const store of STORES) {
    for (const q of QUERIES) {
      const url = `https://zenmarket.jp/en/${store.page}?q=${encodeURIComponent(q)}`;
      const { html, status } = await fetchHtml(url);
      if (status !== 200) {
        console.log(`[zenmarket] ${store.key} "${q}" -> HTTP ${status}, skip`);
        await sleep(1500);
        continue;
      }
      const raw =
        store.key === "yahoo" ? await parseYahoo(html) : await parseMercariLike(html, store.key);

      let added = 0;
      for (const it of raw) {
        if (!it.href || !it.title) continue;
        const url = absUrl(it.href);
        if (seen.has(url)) continue;

        let price = parseEur(it.eur);
        if (price == null) {
          const jpy = parseJpy(it.jpy);
          if (jpy != null) {
            price = Math.round(jpy * jpyToEur * 100) / 100;
            fallbackConverts++;
          }
        }
        if (price == null) continue;
        // Yahoo auctions a "1 yen" affichent un prix de depart derisoire (<0.5 EUR)
        // qui n'est pas un vrai prix de vente -> on ecarte.
        if (price < 0.5) continue;

        seen.add(url);
        products.push({
          shop: "ZenMarket (JP)",
          domain: "zenmarket.jp",
          region: "JP",
          type: "proxy",
          currency: "EUR",
          title: it.title.trim().replace(/\s+/g, " "),
          price,
          available: true,
          url,
          image: it.img?.startsWith("//") ? `https:${it.img}` : (it.img ?? ""),
        });
        added++;
      }
      console.log(`[zenmarket] ${store.key} "${q}" -> ${raw.length} cards, +${added} nouveaux`);
      await sleep(2000);
    }
  }

  console.log(
    `\n[zenmarket] TOTAL ${products.length} produits uniques (fallback JPY x${fallbackConverts})`,
  );
  if (products.length) {
    const prices = products.map((p) => p.price).sort((a, b) => a - b);
    console.log(
      `[zenmarket] prix EUR min=${prices[0]} max=${prices[prices.length - 1]} median=${
        prices[Math.floor(prices.length / 2)]
      }`,
    );
    console.log("[zenmarket] exemples:");
    for (const p of products.slice(0, 4)) console.log(`  ${p.price}EUR  ${p.title.slice(0, 60)}`);
  }

  if (products.length === 0) {
    console.log("[zenmarket] 0 produit -> aucune ecriture (non destructif)");
    return;
  }

  await Bun.write("/tmp/zenmarket-products.json", JSON.stringify(products, null, 2));
  console.log(`[zenmarket] ecrit /tmp/zenmarket-products.json (${products.length})`);
}

await main();
