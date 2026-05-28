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
	shop: string; domain: string; region: string; type: string; currency: string;
	title: string; price: number | null; priceMax: number | null;
	available: boolean; url: string; image: string | null;
}

const CURRENCY_BY_REGION: Record<string, string> = {
	FR: "EUR", BE: "EUR", EU: "EUR", CH: "CHF", UK: "GBP", US: "USD", JP: "JPY", INT: "USD",
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
			const cur = byDomain.get(dom);
			if (cur) {
				cur.sources = [...new Set([...(cur.sources ?? []), data.source])];
				if (isCollectionUrl(s.url) && !isCollectionUrl(cur.url)) cur.url = s.url;
			} else byDomain.set(dom, { ...s, domain: dom, sources: [data.source] });
		}
	}
	return { shops: [...byDomain.values()], sourceCount };
}

function collectionBase(url: string): string | null {
	return url.match(/^(https?:\/\/[^/]+\/collections\/[^/?#]+)/i)?.[1] ?? null;
}
const CURL_IMP = "/home/ubuntu/.local/bin/curl_chrome131";

// Fetch TLS-impersonate (Chrome 131) — contourne Cloudflare / blocages JA3/JA4.
async function impFetch(u: string, timeoutMs = 15000): Promise<string | null> {
	try {
		const proc = Bun.spawn(
			[CURL_IMP, "-s", "-L", "--compressed", "--max-time", String(Math.round(timeoutMs / 1000)), u],
			{ stdout: "pipe", stderr: "ignore" },
		);
		const txt = await new Response(proc.stdout).text();
		await proc.exited;
		return txt && txt.length > 20 ? txt : null;
	} catch { return null; }
}

// fetch rapide (plain) puis fallback impersonate si bloqué/échoué.
async function fetchText(u: string, timeoutMs = 8000): Promise<string | null> {
	try {
		const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
		if (r.ok) {
			const t = await r.text();
			if (t && !/just a moment|checkpoint|cf-browser-verification/i.test(t.slice(0, 600))) return t;
		}
	} catch { /* fallthrough */ }
	return impFetch(u, Math.max(timeoutMs, 15000));
}
async function fetchJson(u: string, timeoutMs = 8000): Promise<unknown> {
	try {
		const r = await fetch(u, {
			headers: { "user-agent": UA, accept: "application/json" },
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return await r.json();
	} catch { /* fallthrough */ }
	// fallback TLS-impersonate (raw body → JSON.parse)
	const raw = await impFetch(u, Math.max(timeoutMs, 15000));
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

// fetch JSON plain uniquement (rapide) — pour le multi-probe Shopify.
async function fetchJsonFast(u: string, timeoutMs = 6000): Promise<unknown> {
	try {
		const r = await fetch(u, {
			headers: { "user-agent": UA, accept: "application/json" },
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return await r.json();
	} catch { /* ignore */ }
	return null;
}

function mkProduct(shop: Shop, currency: string, o: Partial<Product>): Product {
	return {
		shop: shop.name, domain: shop.domain, region: shop.region, type: shop.type, currency,
		title: o.title ?? "", price: o.price ?? null, priceMax: o.priceMax ?? null,
		available: o.available ?? true, url: o.url ?? `https://${shop.domain}`, image: o.image ?? null,
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
	title: string; handle: string; product_type?: string; tags?: string[] | string;
	variants?: { price: string; available?: boolean }[];
	images?: { src: string }[]; featured_image?: string;
}
async function scrapeShopify(shop: Shop, currency: string): Promise<Product[] | null> {
	const root = `https://${shop.domain}`;
	const cands: { url: string; whole: boolean }[] = [];
	const base = collectionBase(shop.url);
	if (base) cands.push({ url: `${base}/products.json?limit=250`, whole: false });
	for (const h of ["beyblade-x", "toupie-beyblade-x", "beyblade-x-2023", "beyblade-x-4th-generation"])
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
		const list = whole ? prods.filter((p) => BX_RE.test(`${p.title} ${p.product_type} ${p.tags}`)) : prods;
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
	name: string; permalink: string; is_in_stock?: boolean;
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
			title: p.name, price, priceMax: price,
			available: p.is_in_stock ?? true,
			url: p.permalink, image: p.images?.[0]?.src ?? null,
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
		element() { capturing = true; buf = ""; },
		text(t) { if (capturing) { buf += t.text; if (t.lastInTextNode) { /* keep */ } } },
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
			const offers = (Array.isArray(n.offers) ? n.offers : n.offers ? [n.offers] : []) as Record<string, unknown>[];
			const prices = offers
				.map((o) => parseFloat(String(o.price ?? (o.priceSpecification as Record<string, unknown>)?.price ?? "")))
				.filter((x) => Number.isFinite(x) && x > 0);
			const cur = String(offers[0]?.priceCurrency ?? currency);
			out.push(mkProduct(shop, cur || currency, {
				title: n.name,
				price: prices.length ? Math.min(...prices) : null,
				priceMax: prices.length ? Math.max(...prices) : null,
				available: true,
				url: typeof n.url === "string" ? n.url : shop.url,
				image: typeof n.image === "string" ? n.image : Array.isArray(n.image) ? String(n.image[0]) : null,
			}));
		}
		// ItemList → itemListElement[].item
		const items = n.itemListElement;
		if (Array.isArray(items)) for (const it of items) visit((it as Record<string, unknown>).item ?? it);
		if (Array.isArray(n["@graph"])) for (const g of n["@graph"]) visit(g);
	};
	for (const b of blocks) {
		try { visit(JSON.parse(b)); } catch { /* skip malformed */ }
	}
	return out.length ? out : null;
}

// ── 4. bxc (curl-impersonate, contourne Cloudflare) ───────────────
async function scrapeBxc(shop: Shop, currency: string): Promise<Product[] | null> {
	try {
		const proc = Bun.spawn(
			[BXC_BIN, "scrape", shop.url, "--markdown", "--profile", "static", "--timeout", "15000"],
			{ stdout: "pipe", stderr: "ignore" },
		);
		const md = await new Response(proc.stdout).text();
		await proc.exited;
		if (!md || /checkpoint|verifying|just a moment/i.test(md.slice(0, 500))) return null;
		// Associe chaque lien produit au 1er prix qui suit sur la même portion.
		const out: Product[] = [];
		const linkRe = /\[([^\]]{4,90})\]\((https?:\/\/[^)]+)\)/g;
		const priceRe = /(?:€|£|\$|EUR|USD|GBP|CHF|¥|JPY)\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(?:€|£|\$)/;
		const lines = md.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			linkRe.lastIndex = 0;
			const lm = linkRe.exec(line);
			if (!lm || !BX_RE.test(lm[1] ?? "")) continue;
			let price: number | null = null;
			for (let j = i; j < Math.min(i + 3, lines.length); j++) {
				const pm = (lines[j] ?? "").match(priceRe);
				if (pm) {
					const raw = (pm[1] ?? pm[2] ?? "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
					const v = parseFloat(raw);
					if (Number.isFinite(v) && v > 0) { price = v; break; }
				}
			}
			out.push(mkProduct(shop, currency, { title: lm[1]!.trim(), price, priceMax: price, url: lm[2]! }));
		}
		return out.length ? dedup(out) : null;
	} catch { return null; }
}

// ── orchestration ─────────────────────────────────────────────────
async function scrapeShop(shop: Shop): Promise<{ products: Product[]; platform: string }> {
	const currency = CURRENCY_BY_REGION[shop.region] ?? "?";
	const deepShop = ["specialist", "import", "official", "retailer"].includes(shop.type);
	const chain: [string, (s: Shop, c: string) => Promise<Product[] | null>][] = [
		["shopify", scrapeShopify],
		["woocommerce", scrapeWoo],
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
	const results = await Promise.all(batch.map(async (shop) => ({ shop, ...(await scrapeShop(shop)) })));
	for (const { shop, products, platform } of results) {
		allProducts.push(...products);
		shopRows.push({ ...shop, currency: CURRENCY_BY_REGION[shop.region] ?? "?", platform, productCount: products.length });
		console.log(`[${platform.padEnd(11)}] ${shop.domain.padEnd(26)} ${String(products.length).padStart(3)}`);
	}
}

shopRows.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
allProducts.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));

const out = {
	generatedAt: new Date().toISOString(),
	shopCount: shops.length,
	scrapedShopCount: shopRows.filter((s) => s.productCount > 0).length,
	productCount: allProducts.length,
	platforms: shopRows.reduce<Record<string, number>>((a, s) => { if (s.productCount) a[s.platform] = (a[s.platform] ?? 0) + 1; return a; }, {}),
	shops: shopRows,
	products: allProducts,
};
await Bun.write(OUT, JSON.stringify(out, null, 2));
console.log(`\n[done] ${out.shopCount} boutiques · ${out.scrapedShopCount} scrapées · ${out.productCount} produits`);
console.log("[platforms]", JSON.stringify(out.platforms));
