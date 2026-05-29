/**
 * Endpoints maintenance + stardust recalc (W2B refacto Vercel).
 *
 * Réplique de :
 *  - `server/actions/maintenance#actionImportTournament` (import un slug Challonge)
 *    → POST `/api/maintenance/scrape-all` { slugs: string[] }
 *      (le dashboard appelle un slug à la fois ; on accepte un tableau pour
 *       batch maintenance — fallback sur 1 slug = 1 import).
 *  - `server/actions/stardust#syncStardustRanking` (recalcule la ranking BTS)
 *    → POST `/api/stardust/recalc` { scope?: 'stardust' | 'global' | 'wb' | 'satr' }
 *
 * Les helpers ranking (`@/lib/stardust-sync-bts`,
 * `@/lib/auto-sync-ranking-pure`) ne sont pas encore déplacés vers le bot —
 * c'est W2D qui les copiera depuis `apps/rpb-dashboard/src/lib/`. On utilise
 * `dynamic import` avec @ts-ignore pour ne pas bloquer le typecheck dès W2B.
 */
import { ChallongeScraper } from "@rose-griffon/challonge";

import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";

import {
  errorResponse,
  extractSlug,
  jsonResponse,
  optionsHandler,
  readJsonBody,
  withAuth,
} from "./_helpers.js";

function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/^(satr_|satr |teamarc|team arc |bts[1-3]_|@)/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

interface ScrapeAllBody {
  slugs?: string[];
  slug?: string;
}

interface StardustRecalcBody {
  scope?: "stardust" | "global" | "wb" | "satr";
}

// ─── POST /api/maintenance/scrape-all ─────────────────────────────────────
// Pipe identique à `actionImportTournament` côté dashboard. Pour un batch,
// on traite chaque slug séquentiellement (Puppeteer = 1 browser à la fois).
const scrapeAll = withAuth(async (req) => {
  const { body, error } = await readJsonBody<ScrapeAllBody>(req);
  if (error) return error;

  const slugs: string[] = [];
  if (Array.isArray(body.slugs)) {
    for (const s of body.slugs) {
      if (typeof s === "string" && s.trim()) slugs.push(s.trim());
    }
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    slugs.push(body.slug.trim());
  }
  if (slugs.length === 0) {
    return errorResponse("BAD_REQUEST", "body must include `slug` or `slugs[]`", 400);
  }

  const results: Array<{
    slug: string;
    ok: boolean;
    tournamentId?: string;
    error?: string;
    participants?: number;
    matches?: number;
  }> = [];

  const categoryId = "cmkxcqif90000rma3yonpba8r"; // BEY-TAMASHII SERIES

  for (const rawSlug of slugs) {
    const slug = extractSlug(rawSlug);
    const normalizedSlug = slug.replace(/[^a-z0-9]/gi, "_");
    const tournamentId = `cm-${normalizedSlug.toLowerCase()}-auto`;
    const scraper = new ChallongeScraper({
      log: (m: string) => logger.info({ slug }, `[scrape-all] ${m}`),
    });
    try {
      const result = await scraper.scrape(slug);

      await prisma.tournament.upsert({
        where: { id: tournamentId },
        update: {
          name: result.metadata.name,
          challongeUrl: result.metadata.url,
          challongeId: String(result.metadata.id || ""),
          status: "COMPLETE",
          standings: result.standings as never,
          categoryId,
          description: result.raw.description || "",
        },
        create: {
          id: tournamentId,
          name: result.metadata.name,
          challongeUrl: result.metadata.url,
          challongeId: String(result.metadata.id || ""),
          date: new Date(),
          status: "COMPLETE",
          standings: result.standings as never,
          categoryId,
          description: result.raw.description || "",
        },
      });

      // stats wins/losses
      const statsMap = new Map<number, { wins: number; losses: number }>();
      for (const m of result.matches) {
        if (m.state === "complete" && m.winnerId) {
          const w = statsMap.get(m.winnerId) || { wins: 0, losses: 0 };
          w.wins++;
          statsMap.set(m.winnerId, w);
          if (m.loserId) {
            const l = statsMap.get(m.loserId) || { wins: 0, losses: 0 };
            l.losses++;
            statsMap.set(m.loserId, l);
          }
        }
      }

      const allUsers = await prisma.user.findMany({
        include: { profile: true },
      });
      const challongeIdToUserId = new Map<number, string>();

      for (const p of result.participants) {
        const sName = normalizeName(p.name);
        let matchedUser = allUsers.find((u: any) => {
          return (
            normalizeName(u.name) === sName ||
            normalizeName(u.username) === sName ||
            normalizeName(u.profile?.bladerName) === sName ||
            (p.challongeUsername &&
              normalizeName(u.username) === normalizeName(p.challongeUsername))
          );
        });

        if (!matchedUser) {
          matchedUser = await prisma.user.create({
            data: {
              name: p.name,
              username: p.challongeUsername || `${normalizedSlug}_${sName}`,
              email: `${p.challongeUsername || sName}@placeholder.rpb`,
              profile: {
                create: { bladerName: p.name, rankingPoints: 0 },
              },
            },
            include: { profile: true },
          });
        }
        if (!matchedUser) continue;

        challongeIdToUserId.set(p.id, matchedUser.id);
        const stats = statsMap.get(p.id) || { wins: 0, losses: 0 };
        const standing = result.standings.find((s) => normalizeName(s.name) === sName);

        const existingPart = await prisma.tournamentParticipant.findFirst({
          where: { tournamentId, userId: matchedUser.id },
        });

        if (existingPart) {
          await prisma.tournamentParticipant.update({
            where: { id: existingPart.id },
            data: {
              finalPlacement: standing?.rank || p.finalRank || 999,
              wins: stats.wins,
              losses: stats.losses,
            },
          });
        } else {
          await prisma.tournamentParticipant.create({
            data: {
              tournamentId,
              userId: matchedUser.id,
              challongeParticipantId: String(p.id),
              finalPlacement: standing?.rank || p.finalRank || 999,
              wins: stats.wins,
              losses: stats.losses,
              checkedIn: true,
            },
          });
        }
      }

      for (const m of result.matches) {
        const p1Id = m.player1Id ? challongeIdToUserId.get(m.player1Id) : null;
        const p2Id = m.player2Id ? challongeIdToUserId.get(m.player2Id) : null;
        const winnerId = m.winnerId ? challongeIdToUserId.get(m.winnerId) : null;
        if (!p1Id && !p2Id) continue;

        await prisma.tournamentMatch.upsert({
          where: {
            tournamentId_challongeMatchId: {
              tournamentId,
              challongeMatchId: String(m.id),
            },
          },
          create: {
            id: `tm-${tournamentId}-${m.id}`,
            tournamentId,
            challongeMatchId: String(m.id),
            round: m.round,
            player1Id: p1Id || null,
            player2Id: p2Id || null,
            winnerId: winnerId || null,
            score: m.scores,
            state: m.state,
          },
          update: {
            player1Id: p1Id,
            player2Id: p2Id,
            winnerId,
            score: m.scores,
            state: m.state,
          },
        });
      }

      results.push({
        slug,
        ok: true,
        tournamentId,
        participants: result.participants.length,
        matches: result.matches.length,
      });
    } catch (err) {
      logger.error({ slug, err }, "[scrape-all] failed");
      results.push({
        slug,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await scraper.close().catch(() => {});
    }
  }

  const allOk = results.every((r) => r.ok);
  return jsonResponse({ ok: allOk, results });
});

// ─── POST /api/stardust/recalc ────────────────────────────────────────────
const stardustRecalc = withAuth(async (req) => {
  const { body, error } = await readJsonBody<StardustRecalcBody>(req);
  if (error) return error;

  const scope = body.scope ?? "stardust";

  if (scope !== "stardust") {
    // W2D copiera les recalc helpers wb/satr/global. Pour l'instant on signale
    // que seul stardust est implémenté.
    return jsonResponse({
      ok: false,
      error: `scope='${scope}' not yet implemented (W2D pending)`,
      scope,
    });
  }

  try {
    const mod = (await import(
      // @ts-ignore — fichier copié par W2D depuis dashboard
      "../../lib/stardust-sync-bts.js"
    )) as {
      syncStardustRankingsToDb: (p: typeof prisma) => Promise<{
        success: boolean;
        count?: number;
        tournamentCount?: number;
        error?: string;
      }>;
    };
    const r = await mod.syncStardustRankingsToDb(prisma);
    return jsonResponse({
      ok: r.success,
      scope,
      count: r.count,
      tournamentCount: r.tournamentCount,
      error: r.success ? undefined : r.error,
    });
  } catch (err) {
    logger.warn({ err }, "[stardust recalc] helper not present yet (W2D pending)");
    return jsonResponse({
      ok: false,
      scope,
      error: "stardust-sync-bts helper not yet copied from dashboard (W2D)",
    });
  }
});

export function getMaintenanceRoutes() {
  return {
    "/api/maintenance/scrape-all": {
      POST: scrapeAll,
      OPTIONS: optionsHandler,
    },
    "/api/stardust/recalc": {
      POST: stardustRecalc,
      OPTIONS: optionsHandler,
    },
  };
}

export { scrapeAll, stardustRecalc };
