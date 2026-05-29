import { TournamentDetailResponseSchema } from "@rpbey/api-contract";
import { getRoute } from "@/server/api/handler";
import { getTournamentDetail } from "@/server/dal/tournaments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Détail d'un tournoi par id, challongeId ou slug d'URL Challonge.
 * L'id de chemin est extrait de l'URL (le wrapper `getRoute` ne porte que la query).
 */
export const GET = getRoute({
  response: TournamentDetailResponseSchema,
  async handle({ request }) {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const id = decodeURIComponent(segments.at(-1) ?? "");
    return getTournamentDetail(id);
  },
});
