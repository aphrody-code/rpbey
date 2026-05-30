import { SearchQuerySchema, SearchResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { searchVectorIds } from "@/server/services/embeddings";
import { getSearchCorpus } from "@/server/services/search-corpus";
import { facetCounts, fuseHybrid, rankSearch } from "@/lib/search-rank";

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
    // Recherche hybride : BM25F (rangs lexicaux complets) ⊕ voisins denses (VSIM),
    // fusionnés en RRF. `searchVectorIds` renvoie [] si le sidecar/Redis est absent
    // → la fusion préserve alors l'ordre BM25F (dégradation gracieuse, zéro panne).
    const lex = rankSearch(index, query.q, {});
    const vec = await searchVectorIds(query.q, 120);
    const data = fuseHybrid(index, lex, vec, {
      category: query.category,
      limit: query.limit ?? 50,
    });

    return {
      count: data.length,
      data,
      query: query.q,
      facets,
    };
  },
});
