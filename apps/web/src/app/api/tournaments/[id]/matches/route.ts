/**
 * RPB - Tournament Matches API
 * View and report match results with Challonge sync
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffUser } from "@/lib/auth-utils";
import { getChallongeService } from "@/lib/challonge";
import { db, schema, and, asc, eq, inArray } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function remapPlayer(
  u:
    | ({
        profiles?: unknown[];
        decks?: Array<Record<string, unknown>>;
      } & Record<string, unknown>)
    | null
    | undefined,
) {
  if (!u) return null;
  const { profiles, decks, ...rest } = u;
  return {
    ...rest,
    profile: profiles?.[0] ?? null,
    decks: (decks ?? []).map((d) => {
      const { deckItems, ...drest } = d as {
        deckItems?: Array<Record<string, unknown>>;
      } & Record<string, unknown>;
      return {
        ...drest,
        items: (deckItems ?? []).map((it) => ({
          ...it,
          bey: it.beyblade ?? null,
          blade: it.part_bladeId ?? null,
          ratchet: it.part_ratchetId ?? null,
          bit: it.part_bitId ?? null,
        })),
      };
    }),
  };
}

// GET - List matches
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const round = searchParams.get("round");
    const state = searchParams.get("state");

    const conditions = [eq(schema.tournamentMatches.tournamentId, id)];
    if (round) conditions.push(eq(schema.tournamentMatches.round, parseInt(round, 10)));
    if (state) conditions.push(eq(schema.tournamentMatches.state, state));

    const matchRows = await db.query.tournamentMatches.findMany({
      where: and(...conditions),
      with: {
        user_player1Id: {
          with: {
            profiles: true,
            decks: {
              where: eq(schema.decks.isActive, true),
              with: {
                deckItems: {
                  with: {
                    beyblade: true,
                    part_bladeId: true,
                    part_ratchetId: true,
                    part_bitId: true,
                  },
                },
              },
            },
          },
        },
        user_player2Id: {
          with: {
            profiles: true,
            decks: {
              where: eq(schema.decks.isActive, true),
              with: {
                deckItems: {
                  with: {
                    beyblade: true,
                    part_bladeId: true,
                    part_ratchetId: true,
                    part_bitId: true,
                  },
                },
              },
            },
          },
        },
        user_winnerId: { with: { profiles: true } },
      },
      orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
    });

    const matches = matchRows.map((m) => ({
      ...m,
      player1: remapPlayer(m.user_player1Id),
      player2: remapPlayer(m.user_player2Id),
      winner: m.user_winnerId
        ? { ...m.user_winnerId, profile: m.user_winnerId.profiles[0] ?? null }
        : null,
    }));

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

    const match = await db.query.tournamentMatches.findFirst({
      where: and(
        eq(schema.tournamentMatches.id, matchId),
        eq(schema.tournamentMatches.tournamentId, id),
      ),
      with: {
        tournament: true,
        user_player1Id: true,
        user_player2Id: true,
      },
    });

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

        const participants = await db.query.tournamentParticipants.findMany({
          where: and(
            eq(schema.tournamentParticipants.tournamentId, id),
            inArray(schema.tournamentParticipants.userId, [match.player1Id, match.player2Id]),
          ),
        });

        const winnerParticipant = participants.find((p) => p.userId === winnerId);

        await challonge.reportMatchScore(match.tournament.challongeId, match.challongeMatchId, {
          winnerId: winnerParticipant?.challongeParticipantId ?? "",
          scoresCsv: `${score1}-${score2}`,
        });
      } catch (err) {
        console.error("Failed to report match to Challonge:", err);
      }
    }

    await db
      .update(schema.tournamentMatches)
      .set({
        winnerId,
        score: `${score1}-${score2}`,
        state: "complete",
      })
      .where(eq(schema.tournamentMatches.id, matchId));

    const updatedRow = await db.query.tournamentMatches.findFirst({
      where: eq(schema.tournamentMatches.id, matchId),
      with: {
        user_player1Id: { with: { profiles: true } },
        user_player2Id: { with: { profiles: true } },
        user_winnerId: { with: { profiles: true } },
      },
    });

    const updated = updatedRow
      ? {
          ...updatedRow,
          player1: updatedRow.user_player1Id
            ? {
                ...updatedRow.user_player1Id,
                profile: updatedRow.user_player1Id.profiles[0] ?? null,
              }
            : null,
          player2: updatedRow.user_player2Id
            ? {
                ...updatedRow.user_player2Id,
                profile: updatedRow.user_player2Id.profiles[0] ?? null,
              }
            : null,
          winner: updatedRow.user_winnerId
            ? {
                ...updatedRow.user_winnerId,
                profile: updatedRow.user_winnerId.profiles[0] ?? null,
              }
            : null,
        }
      : null;

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error reporting match:", error);
    return NextResponse.json({ error: "Failed to report match" }, { status: 500 });
  }
}
