/**
 * bey-library.vercel.app API
 * Serves pre-scraped data from data/bey-library/bey-library-complete.json
 * with in-memory cache and search capabilities.
 */

import { join } from 'node:path';

export const CATEGORIES = [
  'blade',
  'over-blade',
  'assist-blade',
  'ratchet',
  'bit',
  'other',
  'x-over',
] as const;

export type BeyLibraryCategory = (typeof CATEGORIES)[number];

export interface BeyLibraryVariant {
  name: string;
  imageUrl: string;
}

export interface BeyLibraryPart {
  id: string;
  category: BeyLibraryCategory;
  name: string;
  code: string;
  type: string | null;
  spin: string | null;
  weight: number | null;
  specs: Record<string, string | number | string[]>;
  imageUrl: string;
  variantCount: number;
  variants: BeyLibraryVariant[];
  features?: string[];
  sourceUrl: string;
}

export type BeyLibraryPartSummary = Omit<
  BeyLibraryPart,
  'variants' | 'features'
>;

// Singleton data store
let _data: BeyLibraryPart[] | null = null;

async function loadData(): Promise<BeyLibraryPart[]> {
  if (_data) return _data;

  const filePath = join(
    process.cwd(),
    'data/bey-library/bey-library-complete.json',
  );
  const raw = await Bun.file(filePath).text();
  _data = JSON.parse(raw) as BeyLibraryPart[];
  return _data;
}

/**
 * Get all categories with part counts and type breakdowns
 */
export async function getCategorySummary() {
  const data = await loadData();
  return CATEGORIES.map((cat) => {
    const parts = data.filter((p) => p.category === cat);
    const types: Record<string, number> = {};
    for (const p of parts) {
      const t = p.type || 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
    }
    return { category: cat, count: parts.length, types };
  });
}

/**
 * Get all parts for a category with optional filters
 */
export async function getCategoryParts(
  category: BeyLibraryCategory,
  options?: {
    type?: string;
    spin?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ data: BeyLibraryPartSummary[]; total: number }> {
  const data = await loadData();
  let parts = data.filter((p) => p.category === category);

  if (options?.type) {
    const t = options.type.toLowerCase();
    parts = parts.filter((p) => p.type?.toLowerCase() === t);
  }
  if (options?.spin) {
    const s = options.spin.toLowerCase();
    parts = parts.filter((p) => p.spin?.toLowerCase() === s);
  }
  if (options?.search) {
    const q = options.search.toLowerCase();
    parts = parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }

  const total = parts.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 500;
  const sliced = parts.slice(offset, offset + limit);

  // Strip variants from summary
  const summaries: BeyLibraryPartSummary[] = sliced.map(
    ({ variants: _v, features: _f, ...rest }) => rest,
  );

  return { data: summaries, total };
}

/**
 * Get detailed part data
 */
export async function getPartDetail(
  category: BeyLibraryCategory,
  id: string,
): Promise<BeyLibraryPart | null> {
  const data = await loadData();
  return data.find((p) => p.category === category && p.id === id) ?? null;
}

/**
 * Search across all or specific categories
 */
export async function searchParts(
  query: string,
  options?: {
    category?: BeyLibraryCategory;
    type?: string;
    limit?: number;
  },
): Promise<{ data: BeyLibraryPartSummary[]; total: number }> {
  const data = await loadData();
  const q = query.toLowerCase();
  const limit = options?.limit ?? 50;

  let results = data.filter((p) => {
    if (options?.category && p.category !== options.category) return false;
    if (options?.type && p.type?.toLowerCase() !== options.type.toLowerCase())
      return false;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const total = results.length;
  results = results.slice(0, limit);

  const summaries: BeyLibraryPartSummary[] = results.map(
    ({ variants: _v, features: _f, ...rest }) => rest,
  );

  return { data: summaries, total };
}

/**
 * Get all unique types across the database
 */
export async function getTypes(): Promise<{ type: string; count: number }[]> {
  const data = await loadData();
  const counts: Record<string, number> = {};
  for (const p of data) {
    const t = p.type || 'Unknown';
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get a random part, optionally filtered
 */
export async function getRandomPart(options?: {
  category?: BeyLibraryCategory;
  type?: string;
}): Promise<BeyLibraryPart | null> {
  const data = await loadData();
  let pool = data;
  if (options?.category)
    pool = pool.filter((p) => p.category === options.category);
  if (options?.type)
    pool = pool.filter(
      (p) => p.type?.toLowerCase() === options.type?.toLowerCase(),
    );
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? null;
}

/**
 * Get stats summary
 */
export async function getStats() {
  const data = await loadData();
  return {
    total: data.length,
    withType: data.filter((p) => p.type).length,
    withWeight: data.filter((p) => p.weight).length,
    withSpecs: data.filter((p) => Object.keys(p.specs).length > 0).length,
    totalVariants: data.reduce((sum, p) => sum + p.variantCount, 0),
    categories: await getCategorySummary(),
    types: await getTypes(),
  };
}
