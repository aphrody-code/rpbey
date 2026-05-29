/**
 * RPB - Tournament Matches API
 * View and report match results with Challonge sync
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { getChallongeService } from "@/lib/challonge";
import {
  getMatchWithContext,
  getMatchWithPlayers,
  listParticipantsByUserIds,
  listTournamentMatchesFull,
  reportMatchById,
} from "@/server/dal/tournaments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List matches
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const round = searchParams.get("round");
    const state = searchParams.get("state");

    const matches = await listTournamentMatchesFull({
      tournamentId: id,
      round: round ? parseInt(round, 10) : undefined,
      state: state ?? undefined,
    });

    // Group by round for bracket display
    const byRound = matches.reduce(
      (acc, match) => {
        const r = match.round;
        if (!acc[r]) acc[r] = [];
        acc[r].push(match);
        return acc;
      },
      {} as Record<number, typeof matches>,
    );

    return NextResponse.json({
      data: matches,
      byRound,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

// POST - Report match result
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { matchId, winnerId, score1, score2 } = body as {
      matchId: string;
      winnerId: string;
      score1: number;
      score2: number;
    };

    const match = await getMatchWithContext(matchId, id);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Check authorization: admin/mod/superadmin or one of the players
    const isAdmin = isStaffUser(session.user);
    const isPlayer = match.player1Id === session.user.id || match.player2Id === session.user.id;

    if (!isAdmin && !isPlayer) {
      return NextResponse.json({ error: "Not authorized to report this match" }, { status: 403 });
    }

    // Validate winner is one of the players
    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      return NextResponse.json({ error: "Winner must be one of the players" }, { status: 400 });
    }

    // Update on Challonge if linked
    if (match.tournament.challongeId && match.challongeMatchId) {
      try {
        const challonge = getChallongeService();

        // Get participant IDs
        if (!match.player1Id || !match.player2Id) {
          throw new Error("Match participants missing");
        }

        const participants = await listParticipantsByUserIds(id, [
          match.player1Id,
          match.player2Id,
        ]);

        const winnerParticipant = participants.find((p) => p.userId === winnerId);

        await challonge.reportMatchScore(match.tournament.challongeId, match.challongeMatchId, {
          winnerId: winnerParticipant?.challongeParticipantId ?? "",
          scoresCsv: `${score1}-${score2}`,
        });
      } catch (err) {
        console.error("Failed to report match to Challonge:", err);
      }
    }

    await reportMatchById(matchId, {
      winnerId,
      score: `${score1}-${score2}`,
      state: "complete",
    });

    const updated = await getMatchWithPlayers(matchId);

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error reporting match:", error);
    return NextResponse.json({ error: "Failed to report match" }, { status: 500 });
  }
}
