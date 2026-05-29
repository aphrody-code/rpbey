/**
 * Routes REST du serveur gacha, montées sur l'app express de Colyseus.
 * Réutilise les handlers économie. Auth = Bearer token (table `sessions`),
 * le même que minte le bot (apps/bot/src/lib/gacha-api.ts).
 */
import { resolveUser, type AuthUser } from "./auth";
import { WEB_BASE } from "./config";
import * as h from "./handlers";
import { ApiError } from "./http";

// L'app passée par Colyseus est express-compatible — typage souple.
type ExpressApp = {
  get: (path: string, ...fns: unknown[]) => void;
  post: (path: string, ...fns: unknown[]) => void;
};
interface Req {
  headers: Record<string, string | undefined>;
  query: Record<string, unknown>;
  params: Record<string, string>;
  body?: Record<string, unknown>;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  redirect: (code: number, url: string) => void;
}

function bearerOf(req: Req): string | null {
  const hdr = req.headers["authorization"] ?? req.headers["Authorization"];
  if (typeof hdr === "string" && hdr.startsWith("Bearer ")) return hdr.slice(7).trim() || null;
  return null;
}
function qs(req: Req): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (typeof v === "string") u.set(k, v);
  }
  return u;
}
function sendError(res: Res, e: unknown) {
  if (e instanceof ApiError) {
    res.status(e.status).json({
      ok: false,
      error: { code: e.code, message: e.message, retryInMs: e.retryInMs },
    });
    return;
  }
  console.error("[gacha-rest]", e);
  res.status(500).json({
    ok: false,
    error: { code: "INTERNAL", message: "Erreur interne" },
  });
}

/** Wrappe un handler authentifié : Bearer → user → fn → res.json. */
function authed(fn: (user: AuthUser, req: Req) => Promise<unknown> | unknown) {
  return async (req: Req, res: Res) => {
    try {
      const token = bearerOf(req);
      if (!token) {
        res.status(401).json({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Token manquant" },
        });
        return;
      }
      const user = await resolveUser(token);
      if (!user) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session invalide ou expirée",
          },
        });
        return;
      }
      res.json(await fn(user, req));
    } catch (e) {
      sendError(res, e);
    }
  };
}

function notImplemented(feature: string) {
  return (_req: Req, res: Res) => {
    res.status(501).json({
      ok: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: `${feature} non disponible`,
      },
    });
  };
}

export function mountRest(app: ExpressApp): void {
  // ── Gacha ──
  app.post(
    "/api/gacha/pull",
    authed((u) => h.pull(u)),
  );
  app.post(
    "/api/gacha/pull10",
    authed((u) => h.pullMulti(u)),
  );
  app.post(
    "/api/gacha/daily",
    authed((u) => h.daily(u)),
  );
  app.get(
    "/api/gacha/balance",
    authed((u) => h.balance(u)),
  );
  app.get(
    "/api/gacha/inventory/page",
    authed((u, req) => h.inventoryPage(u, qs(req))),
  );
  app.post(
    "/api/gacha/sell",
    authed((u, req) => h.sell(u, req.body ?? {})),
  );
  app.post(
    "/api/gacha/sell-all",
    authed((u) => h.sellAll(u)),
  );
  app.post(
    "/api/gacha/gift",
    authed((u, req) => h.gift(u, req.body ?? {})),
  );
  app.post(
    "/api/gacha/wishlist/toggle",
    authed((u, req) => h.wishlistToggle(u, req.body ?? {})),
  );
  app.get(
    "/api/gacha/wishlist",
    authed((u) => h.wishlist(u)),
  );
  app.get(
    "/api/gacha/history",
    authed((u, req) => h.history(u, qs(req))),
  );
  app.get(
    "/api/gacha/rates",
    authed(() => h.rates()),
  );
  app.get(
    "/api/gacha/cards/search",
    authed((_u, req) => h.searchCards(qs(req))),
  );
  app.get(
    "/api/gacha/banners",
    authed(() => h.banners()),
  );
  app.get(
    "/api/gacha/badges",
    authed((u) => h.badges(u)),
  );
  app.post(
    "/api/gacha/badges/claim",
    authed((u) => h.claimBadge(u)),
  );
  app.get(
    "/api/gacha/fusion/preview",
    authed((u) => h.fusionPreview(u)),
  );
  app.post(
    "/api/gacha/fusion",
    authed((u, req) => h.fuse(u, req.body ?? {})),
  );
  app.get(
    "/api/gacha/cards/:id",
    authed((_u, req) => h.cardById(req.params.id ?? "")),
  );

  // ── Leaderboard ──
  app.get(
    "/api/leaderboard/:category",
    authed((_u, req) => h.leaderboard(req.params.category ?? "currency", qs(req))),
  );

  // ── Admin ──
  app.post(
    "/api/admin/currency/grant",
    authed((u, req) => h.adminGrant(u, req.body ?? {})),
  );

  // ── Image carte → redirige vers le rendu OG du web (le bot a un fallback) ──
  app.get("/api/cards/:id/image.png", (req: Req, res: Res) => {
    res.redirect(302, `${WEB_BASE}/api/gacha/card?id=${encodeURIComponent(req.params.id ?? "")}`);
  });

  // ── Duel / Trade async : non réimplémentés côté REST (routes paramétrées, pas de wildcard) ──
  const duelNI = notImplemented("Duel asynchrone");
  app.post("/api/duel/propose", duelNI);
  app.get("/api/duel/active", duelNI);
  app.get("/api/duel/history", duelNI);
  app.post("/api/duel/:id/:action", duelNI);
  const tradeNI = notImplemented("Échange asynchrone");
  app.post("/api/trade/propose", tradeNI);
  app.get("/api/trade/pending", tradeNI);
  app.post("/api/trade/:id/:action", tradeNI);
}
