import { SearchQuerySchema, SearchResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getSearchCorpus } from "@/server/services/search-corpus";
import { facetCounts, rankSearch } from "@/lib/search-rank";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: SearchQuerySchema,
  response: SearchResponseSchema,
  async handle({ query }) {
    const index = await getSearchCorpus();

    // Sans requête : renvoie l'index complet (l'autocomplétion/SSR filtre côté client).
    if (!query.q || !query.q.trim()) {
      return { count: index.length, data: index };
    }

    const facets = facetCounts(index, query.q);
    const ranked = rankSearch(index, query.q, {
      category: query.category,
      limit: query.limit ?? 50,
    });

    return {
      count: ranked.length,
      data: ranked,
      query: query.q,
      facets,
    };
  },
});
