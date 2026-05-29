/**
 * Endpoint TikTok feed (W2B refacto Vercel).
 *
 * Réplique de `apps/rpb-dashboard/src/lib/tiktok.ts` (consommé par
 * `app/(marketing)/tv/page.tsx`). Le code scraper a déjà été déplacé en W2A
 * vers `apps/rpb-bot/src/services/tiktok.ts` (cache TTL en mémoire, plus de
 * `next/cache`).
 *
 * GET `/api/tiktok/feed?username=<handle>`
 * Auth Bearer obligatoire — appelé par le dashboard depuis un RSC server-side.
 *
 * NB : la dépendance `@tobyg74/tiktok-api-dl` n'est pas encore déclarée dans
 * `apps/rpb-bot/package.json` — c'est le job de W2D. Le typecheck signalera
 * un import non résolu jusqu'à `bun install` post-W2D.
 */
import { getTikTokVideos } from "../../services/tiktok.js";

import { errorResponse, jsonResponse, optionsHandler, withAuth } from "./_helpers.js";

const feed = withAuth(async (req) => {
  const url = new URL(req.url);
  const username = (url.searchParams.get("username") ?? "").trim();
  if (!username) {
    return errorResponse("BAD_REQUEST", "username query param required", 400);
  }
  if (!/^[a-z0-9._]{1,32}$/i.test(username)) {
    return errorResponse("BAD_REQUEST", "invalid username (a-z 0-9 . _ only, ≤32 chars)", 400);
  }

  const posts = await getTikTokVideos(username);
  return jsonResponse({
    ok: true,
    username,
    posts,
    count: posts.length,
    fetchedAt: new Date().toISOString(),
  });
});

export function getTikTokRoutes() {
  return {
    "/api/tiktok/feed": {
      GET: feed,
      OPTIONS: optionsHandler,
    },
  };
}

export { feed };
