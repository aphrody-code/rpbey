import { ContentBlockListResponseSchema, ContentQuerySchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getContentBlock, listContentBlocks } from "@/server/dal/cms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lecture publique des blocs de contenu éditorial. `?slug=` filtre sur un bloc
// précis (renvoie un tableau de 0 ou 1 élément), sans slug renvoie tout.
export const GET = getRoute({
  query: ContentQuerySchema,
  response: ContentBlockListResponseSchema,
  async handle({ query }) {
    if (query.slug) {
      const block = await getContentBlock(query.slug);
      return { blocks: block ? [block] : [] };
    }
    return { blocks: await listContentBlocks() };
  },
});
