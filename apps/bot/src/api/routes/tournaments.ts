/**
 * Endpoints tournaments (W2B refacto Vercel).
 *
 * Réplique de :
 *  - `app/api/tournaments/[id]/live/route.ts`        → POST `/api/tournaments/:id/live`
 *  - `server/actions/brackets#syncTournament`        → POST `/api/tournaments/sync`
 *  - `server/actions/brackets#refreshBrackets`       → POST `/api/tournaments/refresh-brackets`
 *  - `scripts/finalize-tournament.ts`                → POST `/api/tournaments/finalize`
 *  - `server/actions/maintenance#actionImportTournament` (extrait scraper) →
 *    réutilisable indirectement par `/api/tournaments/sync`.
 *
 * Les helpers de ranking (`stardust-sync-bts`, `auto-sync-ranking-pure`,
 * `ranking-service`) ne sont **pas encore** côté bot — W2D les copiera depuis
 * `apps/rpb-dashboard/src/lib/`. Pour l'instant on les import via dynamic
 * import (chemin relatif `../../lib/...`) ; les tsc errors sont attendus pour
 * cette wave.
 */
import {
  ChallongeApi,
  ChallongeReverse,
  ChallongeScraper,
  fetchAndParseAsScrapedTournament,
  fetchPublicTournamentJson,
} from "@rose-griffon/challonge";
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

function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const [before] = raw.split("/");
  return (before ?? raw).trim();
}

interface BracketsTransportBody {
  idOrSlug?: string;
  transport?: "api" | "htmlrewriter" | "auto";
}

interface FinalizeBody {
  tournamentId?: string;
  slug?: string;
  syncOnly?: boolean;
  keepName?: boolean;
  /**
   * Publie le canvas BTS top 10 dans #classement avec ping @Tournois.
   * Best-effort : un echec de publication ne fait pas echouer le finalize.
   */
  publishRanking?: boolean;
  /** Saison BTS a publier (default 2). Ignore si publishRanking=false. */
  publishSeason?: 1 | 2;
}

// ─── POST /api/tournaments/:id/live ───────────────────────────────────────
const liveRefresh = withAuth<{ id: string }>(async (req) => {
  const { id } = req.params;
  // optional `{ force?: boolean }` — non utilisé pour l'instant côté bot
  // (force= toujours actif, car appel POST = scrape complet).
  const { error } = await readJsonBody(req);
  if (error) return error;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, challongeId: true, challongeUrl: true },
  });
  if (!tournament) return errorResponse("NOT_FOUND", "Tournament not found", 404);

  const challongeRef =
    tournament.challongeId ??
    (tournament.challongeUrl ? extractSlug(tournament.challongeUrl) : null);
  if (!challongeRef) return errorResponse("BAD_REQUEST", "Tournament not linked to Challonge", 400);

  const apiKey = process.env.CHALLONGE_API_KEY;
  if (!apiKey) return errorResponse("MISSING_ENV", "CHALLONGE_API_KEY not configured", 500);

  const api = new ChallongeApi({ apiKey });
  const apiTournament = await api.get(challongeRef, {
    includeParticipants: true,
    includeMatches: true,
  });
  const canonical = api.toCanonical(apiTournament, { synthesizeLog: true });
  const participants = canonical.participants;
  const matches = canonical.matches;
  const activityLog = canonical.log;

  const reverseSlug = tournament.challongeUrl
    ? extractSlug(tournament.challongeUrl)
    : String(apiTournament.id);
  const reverse = new ChallongeReverse();
  const [standingsResult, storeResult] = await Promise.allSettled([
    reverse.getStandings(reverseSlug),
    reverse.getStore(reverseSlug),
  ]);
  const liveStandings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
  const store = storeResult.status === "fulfilled" ? storeResult.value : null;

  await prisma.tournament.update({
    where: { id },
    data: {
      challongeId: tournament.challongeId ?? String(apiTournament.id),
      challongeState: apiTournament.state ?? null,
      standings: liveStandings as never,
      stations: (store ?? []) as never,
      activityLog: activityLog as never,
    },
  });

  const completed = matches.filter((m) => m.state === "complete").length;
  const open = matches.filter((m) => m.state === "open").length;
  const pending = matches.filter((m) => m.state === "pending").length;

  return jsonResponse({
    ok: true,
    matches,
    log: activityLog,
    participants,
    summary: {
      matchesCount: matches.length,
      matchesComplete: completed,
      matchesOpen: open,
      matchesPending: pending,
      standingsCount: liveStandings.length,
      stationsCount: 0,
      participantsCount: participants.length,
    },
  });
});

// ─── POST /api/tournaments/sync ────────────────────────────────────────────
// Réplique `convertChallongeToBrackets` (server/actions/brackets.ts) — fetch
// via `auto|api|htmlrewriter` et retourne `ViewerData`.
const sync = withAuth(async (req) => {
  const { body, error } = await readJsonBody<BracketsTransportBody>(req);
  if (error) return error;

  const slug = (body.idOrSlug ?? "").trim();
  if (!slug) return errorResponse("BAD_REQUEST", "idOrSlug required", 400);

  const transport = body.transport ?? "auto";
  if (transport === "api" && !process.env.CHALLONGE_API_KEY) {
    return errorResponse("MISSING_ENV", "CHALLONGE_API_KEY missing (transport='api' forced)", 500);
  }

  const fetchViaApi = async () => {
    const api = new ChallongeApi();
    const t = await api.get(slug, {
      includeParticipants: true,
      includeMatches: true,
    });
    const canonical = api.toCanonical(t);
    // `challongeToViewerData` est une fonction pure du dashboard
    // (`@/lib/brackets/challonge`). Côté bot on retourne le canonical brut :
    // le dashboard fera la conversion ViewerData côté client/RSC.
    return {
      transport: "api" as const,
      canonical,
      source: {
        idOrSlug: slug,
        challongeId: canonical.metadata.id,
        name: canonical.metadata.name,
        url: canonical.metadata.url,
        state: canonical.metadata.state,
        type: canonical.metadata.type,
        participantsCount: canonical.participants.length,
        matchesCount: canonical.matches.length,
      },
    };
  };

  const fetchViaHtmlRewriter = async () => {
    let challongeId: number | null = null;
    let realState: string | null = null;
    let jsonTournamentType: string | null = null;
    try {
      const json = await fetchPublicTournamentJson(slug);
      if (json && typeof json === "object" && "tournament" in json) {
        const t = (
          json as {
            tournament?: {
              id?: number;
              state?: string;
              tournament_type?: string;
            };
          }
        ).tournament;
        challongeId = t?.id ?? null;
        realState = t?.state ?? null;
        jsonTournamentType = t?.tournament_type ?? null;
      }
    } catch {
      /* best-effort */
    }
    const scraped = await fetchAndParseAsScrapedTournament(slug);
    if (challongeId) scraped.metadata.id = challongeId;
    if (realState) scraped.metadata.state = realState;
    if (jsonTournamentType) scraped.metadata.type = jsonTournamentType;
    return {
      transport: "htmlrewriter" as const,
      canonical: scraped,
      source: {
        idOrSlug: slug,
        challongeId,
        name: scraped.metadata.name,
        url: scraped.metadata.url,
        state: scraped.metadata.state ?? null,
        type: scraped.metadata.type,
        participantsCount: scraped.participants.length,
        matchesCount: scraped.matches.length,
      },
    };
  };

  let result:
    | Awaited<ReturnType<typeof fetchViaApi>>
    | Awaited<ReturnType<typeof fetchViaHtmlRewriter>>;
  if (transport === "api") {
    result = await fetchViaApi();
  } else if (transport === "htmlrewriter") {
    result = await fetchViaHtmlRewriter();
  } else if (process.env.CHALLONGE_API_KEY) {
    try {
      result = await fetchViaApi();
    } catch (err) {
      logger.warn({ err }, "[sync] api transport failed, falling back to htmlrewriter");
      result = await fetchViaHtmlRewriter();
    }
  } else {
    result = await fetchViaHtmlRewriter();
  }

  return jsonResponse({
    ok: true,
    synced: true,
    ...result,
    fetchedAt: new Date().toISOString(),
  });
});

// ─── POST /api/tournaments/refresh-brackets ───────────────────────────────
// Variante non-cachée — `tournamentId` ou `idOrSlug` accepté.
const refreshBrackets = withAuth(async (req) => {
  const { body, error } = await readJsonBody<BracketsTransportBody & { tournamentId?: string }>(
    req,
  );
  if (error) return error;

  let slug = (body.idOrSlug ?? "").trim();
  if (!slug && body.tournamentId) {
    const t = await prisma.tournament.findUnique({
      where: { id: body.tournamentId },
      select: { challongeId: true, challongeUrl: true },
    });
    if (!t) return errorResponse("NOT_FOUND", "tournament not found", 404);
    slug = t.challongeId ?? (t.challongeUrl ? extractSlug(t.challongeUrl) : "");
  }
  if (!slug) return errorResponse("BAD_REQUEST", "idOrSlug or tournamentId required", 400);

  const api = new ChallongeApi();
  const t = await api.get(slug, {
    includeParticipants: true,
    includeMatches: true,
  });
  const canonical = api.toCanonical(t, { synthesizeLog: true });

  return jsonResponse({
    ok: true,
    brackets: canonical,
    source: {
      idOrSlug: slug,
      participantsCount: canonical.participants.length,
      matchesCount: canonical.matches.length,
    },
    fetchedAt: new Date().toISOString(),
  });
});

// ─── POST /api/tournaments/finalize ───────────────────────────────────────
const finalize = withAuth(async (req) => {
  const { body, error } = await readJsonBody<FinalizeBody>(req);
  if (error) return error;

  const tournamentId = body.tournamentId;
  const slugInput = body.slug;
  if (!tournamentId && !slugInput)
    return errorResponse("BAD_REQUEST", "tournamentId or slug required", 400);

  const syncOnly = body.syncOnly === true;
  const keepName = body.keepName === true || syncOnly;

  const slug = slugInput ? extractSlug(slugInput) : null;
  const tournament = tournamentId
    ? await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { category: true },
      })
    : await prisma.tournament.findFirst({
        where: {
          OR: [{ challongeId: slug! }, { challongeUrl: { contains: slug! } }],
        },
        include: { category: true },
      });
  if (!tournament) return errorResponse("NOT_FOUND", "tournament not found", 404);

  const refSlug =
    slug ??
    tournament.challongeId ??
    (tournament.challongeUrl ? extractSlug(tournament.challongeUrl) : null);
  if (!refSlug && !syncOnly)
    return errorResponse("BAD_REQUEST", "tournament not linked to Challonge", 400);

  let scraped: Awaited<ReturnType<ChallongeScraper["scrape"]>> | null = null;

  if (!syncOnly && refSlug) {
    const scraper = new ChallongeScraper({
      log: (m: string) => logger.info({ slug: refSlug }, `[finalize] ${m}`),
    });
    try {
      scraped = await scraper.scrape(refSlug, {
        withStandings: true,
        withStations: true,
        withLog: true,
        withParticipants: true,
      });
    } finally {
      await scraper.close().catch(() => {});
    }
  }

  if (scraped) {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        profile: { select: { bladerName: true } },
      },
    });
    const userByKey = new Map<string, string>();
    for (const u of allUsers) {
      for (const candidate of [u.name, u.username, u.profile?.bladerName]) {
        const k = normalizeName(candidate ?? undefined).toLowerCase();
        if (k) userByKey.set(k, u.id);
      }
    }

    const challongeIdToUser = new Map<number, string | null>();
    const challongeIdToName = new Map<number, string>();
    for (const p of scraped.participants) {
      const cleanName = normalizeName(p.name);
      challongeIdToName.set(p.id, cleanName);
      challongeIdToUser.set(p.id, userByKey.get(cleanName.toLowerCase()) ?? null);
    }

    const completedAt = scraped.metadata.completedAt
      ? new Date(scraped.metadata.completedAt)
      : scraped.metadata.startedAt
        ? new Date(scraped.metadata.startedAt)
        : new Date();

    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        status: "COMPLETE",
        challongeState: scraped.metadata.state,
        standings: scraped.standings as never,
        stations: scraped.stations as never,
        activityLog: scraped.log as never,
        date: completedAt,
        name: keepName ? tournament.name : (scraped.metadata.name ?? tournament.name),
      },
    });

    // Upsert participants + matches (logique identique au script CLI)
    for (const p of scraped.participants) {
      const cleanName = normalizeName(p.name);
      const userId = challongeIdToUser.get(p.id) ?? null;
      const standing = scraped.standings.find(
        (s) => normalizeName(s.name).toLowerCase() === cleanName.toLowerCase(),
      );
      const finalPlacement = standing?.rank ?? p.finalRank ?? null;

      let wins = 0;
      let losses = 0;
      for (const m of scraped.matches) {
        if (m.state !== "complete") continue;
        if (m.winnerId === p.id) wins++;
        else if (m.loserId === p.id) losses++;
      }

      const existing = await prisma.tournamentParticipant.findFirst({
        where: {
          tournamentId: tournament.id,
          OR: [
            { challongeParticipantId: String(p.id) },
            { playerName: cleanName },
            ...(userId ? [{ userId }] : []),
          ],
        },
      });
      if (existing) {
        await prisma.tournamentParticipant.update({
          where: { id: existing.id },
          data: {
            challongeParticipantId: String(p.id),
            playerName: cleanName,
            userId: existing.userId ?? userId,
            finalPlacement: finalPlacement ?? existing.finalPlacement,
            wins,
            losses,
            seed: p.seed,
            checkedIn: true,
          },
        });
      } else {
        await prisma.tournamentParticipant.create({
          data: {
            tournamentId: tournament.id,
            challongeParticipantId: String(p.id),
            playerName: cleanName,
            userId,
            finalPlacement,
            wins,
            losses,
            seed: p.seed,
            checkedIn: true,
          },
        });
      }
    }

    for (const m of scraped.matches) {
      const player1Name = m.player1Id ? (challongeIdToName.get(m.player1Id) ?? null) : null;
      const player2Name = m.player2Id ? (challongeIdToName.get(m.player2Id) ?? null) : null;
      const winnerName = m.winnerId ? (challongeIdToName.get(m.winnerId) ?? null) : null;
      const player1Uid = m.player1Id ? (challongeIdToUser.get(m.player1Id) ?? null) : null;
      const player2Uid = m.player2Id ? (challongeIdToUser.get(m.player2Id) ?? null) : null;
      const winnerUid = m.winnerId ? (challongeIdToUser.get(m.winnerId) ?? null) : null;

      const data = {
        round: m.round,
        player1Id: player1Uid,
        player2Id: player2Uid,
        winnerId: winnerUid,
        player1Name,
        player2Name,
        winnerName,
        score: m.scores,
        state: m.state,
      };

      const existing = await prisma.tournamentMatch.findUnique({
        where: {
          tournamentId_challongeMatchId: {
            tournamentId: tournament.id,
            challongeMatchId: String(m.id),
          },
        },
      });

      if (existing) {
        await prisma.tournamentMatch.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.tournamentMatch.create({
          data: {
            tournamentId: tournament.id,
            challongeMatchId: String(m.id),
            ...data,
          },
        });
      }
    }
  }

  // Ranking auto-sync — dispatch via classifyRanking + helpers dashboard.
  // W2D copiera ces helpers vers `apps/rpb-bot/src/lib/`.
  let syncResult: {
    triggered: string;
    success: boolean;
    error?: string;
  } = { triggered: "skipped", success: true };
  try {
    const { classifyRanking } = (await import(
      // @ts-ignore — fichier copié par W2D
      "../../lib/auto-sync-ranking-pure.js"
    )) as { classifyRanking: (n?: string | null) => string };
    const kind = classifyRanking(tournament.category?.name);

    if (kind === "stardust") {
      const mod = (await import(
        // @ts-ignore — fichier copié par W2D
        "../../lib/stardust-sync-bts.js"
      )) as {
        syncStardustRankingsToDb: (
          p: typeof prisma,
        ) => Promise<{ success: boolean; error?: string }>;
      };
      const r = await mod.syncStardustRankingsToDb(prisma);
      syncResult = {
        triggered: "stardust",
        success: r.success,
        error: r.success ? undefined : r.error,
      };
    } else {
      syncResult = { triggered: kind, success: true };
    }
  } catch (err) {
    logger.warn({ err }, "[finalize] ranking helpers not present yet (W2D pending)");
    syncResult = {
      triggered: "skipped",
      success: false,
      error: "ranking helpers not yet copied from dashboard (W2D)",
    };
  }

  // Publication automatique du classement BTS canvas si demandé.
  // Best-effort : un échec ne casse pas le finalize.
  let publishResult:
    | Awaited<ReturnType<typeof import("../../lib/classement-publisher.js").publishBtsRanking>>
    | { ok: false; skipped: true } = { ok: false, skipped: true };
  if (body.publishRanking) {
    try {
      const { publishBtsRanking } = await import("../../lib/classement-publisher.js");
      publishResult = await publishBtsRanking({
        season: body.publishSeason ?? 2,
        purgePrevious: true,
      });
    } catch (err) {
      logger.warn({ err }, "[finalize] classement publish failed");
      publishResult = {
        ok: false,
        skipped: false,
        error: (err as Error).message,
      } as never;
    }
  }

  return jsonResponse({
    ok: true,
    tournamentId: tournament.id,
    scraped: scraped
      ? {
          participants: scraped.participants.length,
          matches: scraped.matches.length,
          standings: scraped.standings.length,
        }
      : null,
    ranking: syncResult,
    classementPublish: publishResult,
  });
});

export function getTournamentRoutes() {
  return {
    "/api/tournaments/:id/live": {
      POST: liveRefresh,
      OPTIONS: optionsHandler,
    },
    "/api/tournaments/sync": {
      POST: sync,
      OPTIONS: optionsHandler,
    },
    "/api/tournaments/refresh-brackets": {
      POST: refreshBrackets,
      OPTIONS: optionsHandler,
    },
    "/api/tournaments/finalize": {
      POST: finalize,
      OPTIONS: optionsHandler,
    },
  };
}
