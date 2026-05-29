import { loadJsonSafe } from "@/lib/data-cache";
import type {
  BxCatalog,
  BxOffer,
  BxProduct,
  BxProductGroup,
} from "@/app/(marketing)/comparateur/_components/types";

export type { BxCatalog, BxOffer, BxProduct, BxProductGroup };

// Taux de change approximatifs → EUR (comparaison cross-devise).
export const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.86,
  GBP: 1.15,
  CHF: 1.09,
  JPY: 0.0054,
};

const PRODUCT_CODE_RE = /\b([BUC]X-\d{2,3}(?:-[A-Z0-9]+)?|[BUC]X-\d{2,3}[A-Z]?)\b/i;
const COMBO_CODE_RE = /\b(\d-\d{2}[A-Z]{1,3})\b/i;

export function normalizeName(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(beyblade|bey|toupie|takara|tomy|booster|starter|pack|x)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupKey(title: string): { key: string; code: string | null } {
  const prodCodeMatch = title.match(PRODUCT_CODE_RE);
  if (prodCodeMatch && prodCodeMatch[1]) {
    const code = prodCodeMatch[1].toUpperCase();
    return { key: code, code };
  }
  const comboCodeMatch = title.match(COMBO_CODE_RE);
  if (comboCodeMatch && comboCodeMatch[1]) {
    const code = comboCodeMatch[1].toUpperCase();
    return { key: code, code };
  }
  const n = normalizeName(title);
  return { key: n || title.toLowerCase().trim(), code: null };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Slug stable et lisible pour un groupe produit (SEO-friendly). */
export function groupSlug(g: BxProductGroup): string {
  const base = slugify(g.name);
  if (g.code) {
    const code = slugify(g.code);
    return base.includes(code) ? base : `${base}-${code}`;
  }
  return base || g.key.slice(0, 60);
}

// Mémoïsation niveau module : le catalogue (1+ Mo) n'est parsé/enrichi qu'UNE
// fois par process (build SSG = 218 pages + runtime force-dynamic). Cleared au
// restart/redeploy → toujours frais entre déploiements.
let _catalogPromise: Promise<BxCatalog | null> | null = null;

async function _loadCatalogUncached(): Promise<BxCatalog | null> {
  const catalog = await loadJsonSafe<BxCatalog>("data/bx-catalog.json");
  if (!catalog) return null;
  for (const p of catalog.products) {
    const rate = FX_TO_EUR[p.currency];
    p.priceEur = p.price != null && rate ? Math.round(p.price * rate * 100) / 100 : null;
  }
  return catalog;
}

export function loadCatalog(): Promise<BxCatalog | null> {
  if (!_catalogPromise) _catalogPromise = _loadCatalogUncached();
  return _catalogPromise;
}

// Cache des groupes : identité du catalogue (loadCatalog renvoie toujours la
// même instance mémoïsée) + minShops → calculé une seule fois.
let _groupsCache: { catalog: BxCatalog; minShops: number; groups: BxProductGroup[] } | null = null;

/** Regroupe les offres par produit (code combo, sinon nom normalisé). */
export function computeGroups(catalog: BxCatalog, minShops = 2): BxProductGroup[] {
  if (_groupsCache && _groupsCache.catalog === catalog && _groupsCache.minShops === minShops)
    return _groupsCache.groups;
  const map = new Map<string, BxProductGroup>();
  for (const p of catalog.products) {
    if (p.price == null) continue;
    const { key, code } = groupKey(p.title);
    let g = map.get(key);
    if (!g) {
      g = { key, code, name: p.title, offers: [], shopCount: 0, cheapest: null, cheapestEur: null };
      map.set(key, g);
    }
    g.offers.push({
      shop: p.shop,
      domain: p.domain,
      region: p.region,
      type: p.type,
      title: p.title,
      price: p.price,
      currency: p.currency,
      priceEur: p.priceEur ?? null,
      available: p.available,
      url: p.url,
      image: p.image,
    });
    if (p.title.length < g.name.length) g.name = p.title;
  }
  const groups = [...map.values()]
    .map((g) => {
      g.offers.sort((a, b) => (a.priceEur ?? 1e9) - (b.priceEur ?? 1e9));
      g.shopCount = new Set(g.offers.map((o) => o.domain)).size;
      g.cheapest = g.offers[0] ?? null;
      g.cheapestEur = g.cheapest?.priceEur ?? null;
      return g;
    })
    .filter((g) => g.shopCount >= minShops)
    .sort((a, b) => b.shopCount - a.shopCount || (a.cheapestEur ?? 1e9) - (b.cheapestEur ?? 1e9));
  _groupsCache = { catalog, minShops, groups };
  return groups;
}
