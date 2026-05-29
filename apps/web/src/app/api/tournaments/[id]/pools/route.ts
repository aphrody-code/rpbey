/**
 * GET /api/tournaments/[id]/pools
 *
 * Renvoie la structure des phases de poules d'un tournoi (V1 = T_SS1).
 *
 * Source de vérité (V1) : fichier `data/pools/<challongeId>.json` produit par
 * `scripts/parse-module-html.ts` à partir du HTML Challonge `/module`.
 * Enrichi à la volée avec les scores actuels en DB (`tournament_matches`
 * round=-100, joints sur `challongeMatchId`).
 *
 * Format réponse :
 *   {
 *     groups: Array<{
 *       name: string;
 *       participants: Array<{ rank, displayName, wins, losses, pts, ... }>;
 *       matches: Array<{ matchId, winner, loser, score?, state }>;
 *     }>;
 *     groupsCount: number;
 *     matchesCount: number;
 *   }
 *
 * Si le tournoi n'a pas de phase de poules, renvoie 404.
 */

import { NextResponse } from "next/server";
import path from "node:path";

import { db, schema, eq, or } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PoolMatch {
  matchId: string;
  groupName: string;
  state: string;
  winner: string;
  loser: string;
}

interface PoolParticipant {
  rank: number;
  displayName: string;
  challongeUsername?: string;
  portraitUrl?: string;
  advanced: boolean;
  wins: number;
  losses: number;
  ties: number;
  tb: number;
  setWins: number;
  setTies: number;
  pts: number;
  matchHistory: Array<{
    matchId: string;
    matchState: string;
    result: string;
  }>;
}

interface PoolGroup {
  name: string;
  participants: PoolParticipant[];
}

interface PoolStructure {
  slug: string;
  groupsCount: number;
  groups: PoolGroup[];
  matches: PoolMatch[];
  matchesCount: number;
  participantsCount: number;
}

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteParams): Promise<Response> {
  const { id: idOrChallongeId } = await params;

  if (!idOrChallongeId) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const tournament = await db.query.tournaments.findFirst({
    where: or(
      eq(schema.tournaments.id, idOrChallongeId),
      eq(schema.tournaments.challongeId, idOrChallongeId),
    ),
    columns: {
      id: true,
      name: true,
      challongeId: true,
    },
    with: {
      tournamentMatches: {
        where: eq(schema.tournamentMatches.round, -100),
        columns: {
          challongeMatchId: true,
          score: true,
          state: true,
          winnerName: true,
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json(
      { error: `tournament '${idOrChallongeId}' introuvable` },
      { status: 404 },
    );
  }

  const challongeKey = tournament.challongeId ?? tournament.id;
  const file = Bun.file(path.join(process.cwd(), "data", "pools", `${challongeKey}.json`));

  if (!(await file.exists())) {
    return NextResponse.json({ error: "no pool stage for this tournament" }, { status: 404 });
  }

  const structure = (await file.json()) as PoolStructure;

  // Enrichir les matches avec les scores DB (winnerName + score live).
  const dbByMatchId = new Map(
    tournament.tournamentMatches
      .filter((m) => m.challongeMatchId)
      .map((m) => [m.challongeMatchId!, m]),
  );

  const enrichedMatches = structure.matches.map((m) => {
    const dbMatch = dbByMatchId.get(m.matchId);
    return {
      ...m,
      score: dbMatch?.score ?? null,
      dbState: dbMatch?.state ?? null,
    };
  });

  return NextResponse.json(
    {
      groups: structure.groups,
      groupsCount: structure.groupsCount,
      matches: enrichedMatches,
      matchesCount: structure.matchesCount,
      participantsCount: structure.participantsCount,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
    },
    {
      headers: {
        "x-pool-source": "module-html",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
