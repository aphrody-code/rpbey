/**
 * REST API skeleton — Wave 1A refacto rpb-dashboard → Vercel.
 *
 * Cohabite avec le `Bun.serve` existant de `lib/api-server.ts`. On exporte ici :
 *  - `bearerAuthenticate(req)` : middleware `Authorization: Bearer <BOT_API_KEY>`
 *    (compare timing-safe, distinct du `x-api-key` legacy utilisé par le
 *    dashboard / bridge gacha).
 *  - `getRefactorRoutes()` : objet de routes Bun à fusionner dans `routes:`.
 *
 * Wave 2B : les routes scrapers/tournaments/tiktok/maintenance sont
 * maintenant implémentées via les modules `./routes/*.ts`. Les stubs 501
 * restent uniquement pour les endpoints non-couverts (rankings.refresh).
 */
import { timingSafeEqual } from "node:crypto";
import { getMaintenanceRoutes } from "./routes/maintenance.js";
import { getScrapeRoutes } from "./routes/scrape.js";
import { getTikTokRoutes } from "./routes/tiktok.js";
import { getTournamentRoutes } from "./routes/tournaments.js";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
};

/**
 * Bearer-token auth — `Authorization: Bearer <BOT_API_KEY>`.
 * Retourne `null` si OK, sinon une `Response` 401/500 prête à être renvoyée.
 *
 * Différent du middleware `authenticate()` legacy de `lib/api-server.ts` qui
 * lit `x-api-key`. La clé attendue est la même (`process.env.BOT_API_KEY`).
 */
export function bearerAuthenticate(req: Request): Response | null {
	const expectedKey = process.env.BOT_API_KEY;
	if (!expectedKey) {
		return Response.json(
			{ error: "Server misconfiguration: BOT_API_KEY missing" },
			{ status: 500, headers: CORS_HEADERS },
		);
	}

	const header = req.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	if (!match) {
		return Response.json(
			{ error: "Unauthorized", message: "Missing Bearer token" },
			{ status: 401, headers: CORS_HEADERS },
		);
	}

	const provided = match[1];
	const a = new TextEncoder().encode(provided);
	const b = new TextEncoder().encode(expectedKey);
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		return Response.json(
			{ error: "Unauthorized", message: "Invalid Bearer token" },
			{ status: 401, headers: CORS_HEADERS },
		);
	}

	return null;
}

/** Réponse stub uniforme pour les endpoints non encore implémentés. */
function notImplemented(name: string): Response {
	return Response.json(
		{ error: "NOT_IMPLEMENTED", endpoint: name },
		{ status: 501, headers: CORS_HEADERS },
	);
}

/** Wrap un handler protégé Bearer + corps JSON `{ ok, ... }` ou erreur. */
function protectedStub(name: string) {
	return async (req: Request) => {
		const authError = bearerAuthenticate(req);
		if (authError) return authError;
		return notImplemented(name);
	};
}

/** Réponse OPTIONS uniforme pour CORS preflight. */
const optionsHandler = () =>
	new Response(null, { status: 204, headers: CORS_HEADERS });

/**
 * Routes ajoutées par la refacto Vercel.
 *
 * Implémentation par sous-modules (W2B) :
 *  - `./routes/scrape.ts`       → POST /api/scrape/challonge/:slug + GET log/module
 *  - `./routes/tournaments.ts`  → POST /api/tournaments/:id/live, sync,
 *                                  refresh-brackets, finalize
 *  - `./routes/tiktok.ts`       → GET  /api/tiktok/feed
 *  - `./routes/maintenance.ts`  → POST /api/maintenance/scrape-all,
 *                                  /api/stardust/recalc
 *
 * Les stubs restants (501) couvrent les endpoints prévus mais hors scope W2B.
 */
export function getRefactorRoutes() {
	return {
		// Healthcheck public — pas d'auth, exposé publiquement (utilisé par
		// uptime monitors externes + Vercel preview smoke tests).
		"/api/health": {
			GET: () =>
				Response.json(
					{
						ok: true,
						uptime: process.uptime(),
						commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
					},
					{ headers: CORS_HEADERS },
				),
			OPTIONS: optionsHandler,
		},

		// ─── Scrapers (W2B) ───────────────────────────────────────────────────
		...getScrapeRoutes(),
		// stubs scrapers tiers non implémentés
		"/api/scrape/youtube/:channel": {
			POST: protectedStub("scrape.youtube"),
			OPTIONS: optionsHandler,
		},
		"/api/scrape/twitch/:channel": {
			POST: protectedStub("scrape.twitch"),
			OPTIONS: optionsHandler,
		},

		// ─── Tournaments (W2B) ────────────────────────────────────────────────
		...getTournamentRoutes(),

		// ─── TikTok (W2B) ─────────────────────────────────────────────────────
		...getTikTokRoutes(),

		// ─── Maintenance + Stardust recalc (W2B) ──────────────────────────────
		...getMaintenanceRoutes(),

		// ─── Rankings (stub) ──────────────────────────────────────────────────
		"/api/rankings/refresh": {
			POST: protectedStub("rankings.refresh"),
			OPTIONS: optionsHandler,
		},
	};
}
