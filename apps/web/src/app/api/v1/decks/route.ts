import { DeckQuerySchema, DeckResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getDeckById } from "@/server/dal/decks";

// Lecture publique d'un deck partageable : `GET /api/v1/decks?id=<deckId>`.
// Read-only, sans session — les mutations restent sur `/api/decks` (auth better-auth).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = getRoute({
  query: DeckQuerySchema,
  response: DeckResponseSchema,
  async handle({ query }) {
    const deck = await getDeckById(query.id);
    return { deck: deck as never };
  },
});
