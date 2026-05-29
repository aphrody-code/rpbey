/**
 * RPB - Single Tournament API
 * GET, PUT, DELETE operations with Challonge sync
 */

import { type NextRequest, NextResponse } from "next/server";
import { type TournamentStatus } from "@/lib/types";
import { requireAdmin, requireStaff } from "@/lib/auth-utils";
import { getChallongeService } from "@/lib/challonge";
import { db, schema, and, asc, eq, ilike, or } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function remapTournamentFull(
  t:
    | ({
        tournamentParticipants: Array<Record<string, unknown>>;
        tournamentMatches: Array<Record<string, unknown>>;
      } & Record<string, unknown>)
    | null
    | undefined,
) {
  if (!t) return t;
  const { tournamentParticipants, tournamentMatches, ...rest } = t;
  return {
    ...rest,
    participants: tournamentParticipants.map((p) => {
      const user = p.user as { profiles?: unknown[] } | null;
      return {
        ...p,
        user: user ? { ...user, profile: user.profiles?.[0] ?? null } : null,
      };
    }),
    matches: tournamentMatches.map((m) => ({
      ...m,
      player1: m.user_player1Id ?? null,
      player2: m.user_player2Id ?? null,
      winner: m.user_winnerId ?? null,
    })),
  };
}

function isOffline(tournament: { challongeId: string | null; challongeUrl: string | null }) {
  return tournament.challongeId === "17261774" || tournament.challongeUrl?.includes("B_TS1");
}

// GET - Get single tournament with full details
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    let tournamentRow = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.id, id),
      with: {
        tournamentParticipants: {
          with: { user: { with: { profiles: true } } },
          orderBy: asc(schema.tournamentParticipants.seed),
        },
        tournamentMatches: {
          with: {
            user_player1Id: { with: { profiles: true } },
            user_player2Id: { with: { profiles: true } },
            user_winnerId: { with: { profiles: true } },
          },
          orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
        },
      },
    });

    // Fallback: Try searching by challongeId or challongeUrl slug
    if (!tournamentRow) {
      tournamentRow = await db.query.tournaments.findFirst({
        where: or(
          eq(schema.tournaments.challongeId, id),
          ilike(schema.tournaments.challongeUrl, `%${id}%`),
        ),
        with: {
          tournamentParticipants: {
            with: { user: { with: { profiles: true } } },
            orderBy: asc(schema.tournamentParticipants.seed),
          },
          tournamentMatches: {
            with: {
              user_player1Id: { with: { profiles: true } },
              user_player2Id: { with: { profiles: true } },
              user_winnerId: { with: { profiles: true } },
            },
            orderBy: [asc(schema.tournamentMatches.round), asc(schema.tournamentMatches.createdAt)],
          },
        },
      });
    }

    if (!tournamentRow) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ data: remapTournamentFull(tournamentRow) });
  } catch (error) {
    console.error("Error fetching tournament:", error);
    return NextResponse.json({ error: "Failed to fetch tournament" }, { status: 500 });
  }
}

// PUT - Update tournament
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, date, location, format, maxPlayers, status } = body as {
      name?: string;
      description?: string;
      date?: string;
      location?: string;
      format?: string;
      maxPlayers?: number;
      status?: string;
    };

    const existing = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.id, id),
    });
    if (!existing) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Update on Challonge if linked AND not offline
    if (existing.challongeId && (name || description || date) && !isOffline(existing)) {
      try {
        const challonge = getChallongeService();
        await challonge.updateTournament(existing.challongeId, {
          name: name ?? existing.name,
          description: description ?? existing.description ?? "",
          startAt: date ? new Date(date).toISOString() : undefined,
        });
      } catch (err) {
        console.error("Failed to update Challonge tournament:", err);
      }
    }

    const [tournament] = await db
      .update(schema.tournaments)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date).toISOString() }),
        ...(location !== undefined && { location }),
        ...(format && { format }),
        ...(maxPlayers && { maxPlayers }),
        ...(status && { status: status as TournamentStatus }),
      })
      .where(eq(schema.tournaments.id, id))
      .returning();

    return NextResponse.json({ data: tournament });
  } catch (error) {
    console.error("Error updating tournament:", error);
    return NextResponse.json({ error: "Failed to update tournament" }, { status: 500 });
  }
}

// DELETE - Delete tournament
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const tournament = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.id, id),
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Delete from Challonge if linked
    if (tournament.challongeId && !isOffline(tournament)) {
      try {
        const challonge = getChallongeService();
        await challonge.deleteTournament(tournament.challongeId);
      } catch (err) {
        console.error("Failed to delete Challonge tournament:", err);
      }
    }

    // Delete related data atomically
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.tournamentMatches)
        .where(eq(schema.tournamentMatches.tournamentId, id));
      await tx
        .delete(schema.tournamentParticipants)
        .where(eq(schema.tournamentParticipants.tournamentId, id));
      await tx.delete(schema.tournaments).where(eq(schema.tournaments.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tournament:", error);
    return NextResponse.json({ error: "Failed to delete tournament" }, { status: 500 });
  }
}

// PATCH - Special actions (start, finalize, sync)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body as {
      action: "start" | "finalize" | "sync" | "sync_participants";
    };

    const tournamentRow = await db.query.tournaments.findFirst({
      where: eq(schema.tournaments.id, id),
      with: {
        tournamentParticipants: { with: { user: true } },
        tournamentMatches: true,
      },
    });

    if (!tournamentRow) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const tournament = {
      ...tournamentRow,
      participants: tournamentRow.tournamentParticipants,
      matches: tournamentRow.tournamentMatches,
    };

    if (!tournament.challongeId) {
      return NextResponse.json({ error: "Tournament not linked to Challonge" }, { status: 400 });
    }

    // SKIP API for B_TS1
    if (isOffline(tournament)) {
      return NextResponse.json({
        success: true,
        action,
        message: "Tournament is in offline mode (B_TS1)",
      });
    }

    const challonge = getChallongeService();

    switch (action) {
      case "sync_participants": {
        const challongeParticipants = await challonge.listParticipants(tournament.challongeId);

        const participantsToCreate = [];
        const alreadySyncedLocalIds = new Set(
          tournament.participants.filter((p) => p.challongeParticipantId).map((p) => p.id),
        );

        for (const localParticipant of tournament.participants) {
          if (alreadySyncedLocalIds.has(localParticipant.id)) continue;

          const existingInChallonge = challongeParticipants.find(
            (p) =>
              p.attributes.misc === localParticipant.userId ||
              p.attributes.name ===
                (localParticipant.playerName ||
                  localParticipant.user?.name ||
                  localParticipant.user?.email),
          );

          if (existingInChallonge) {
            await db
              .update(schema.tournamentParticipants)
              .set({
                challongeParticipantId: String(existingInChallonge.id),
              })
              .where(eq(schema.tournamentParticipants.id, localParticipant.id));
          } else {
            participantsToCreate.push({
              name:
                localParticipant.playerName ||
                localParticipant.user?.name ||
                localParticipant.user?.email ||
                "Unknown",
              misc: localParticipant.userId ?? undefined,
              seed: localParticipant.seed ?? undefined,
            });
          }
        }

        if (participantsToCreate.length > 0) {
          const createdParticipants = await challonge.bulkCreateParticipants(
            tournament.challongeId,
            participantsToCreate,
          );

          // Map created participants back to local records
          for (const created of createdParticipants) {
            const localParticipant = tournament.participants.find(
              (p) => p.userId === created.attributes.misc,
            );
            if (localParticipant) {
              await db
                .update(schema.tournamentParticipants)
                .set({ challongeParticipantId: String(created.id) })
                .where(eq(schema.tournamentParticipants.id, localParticipant.id));
            }
          }
        }
        break;
      }

      case "start": {
        await challonge.startTournament(tournament.challongeId);
        await db
          .update(schema.tournaments)
          .set({ status: "UNDERWAY" })
          .where(eq(schema.tournaments.id, id));
        break;
      }

      case "finalize": {
        await challonge.finalizeTournament(tournament.challongeId);
        await db
          .update(schema.tournaments)
          .set({ status: "COMPLETE" })
          .where(eq(schema.tournaments.id, id));
        break;
      }

      case "sync": {
        // Sync matches from Challonge
        const matches = await challonge.listMatches(tournament.challongeId);

        for (const match of matches) {
          const attrs = match.attributes;

          // Find local players by challonge participant ID
          const player1 = tournament.participants.find(
            (p) => p.challongeParticipantId === String(attrs.player1Id),
          );
          const player2 = tournament.participants.find(
            (p) => p.challongeParticipantId === String(attrs.player2Id),
          );
          const winner = tournament.participants.find(
            (p) => p.challongeParticipantId === String(attrs.winnerId),
          );

          // Challonge v2.1 uses scores as an array or CSV depending on request. Attributes usually have scores as string.
          const scoreStr = attrs.scores || null;

          await db
            .insert(schema.tournamentMatches)
            .values({
              tournamentId: id,
              challongeMatchId: String(match.id),
              round: attrs.round,
              state: attrs.state,
              player1Id: player1?.userId ?? null,
              player2Id: player2?.userId ?? null,
              winnerId: winner?.userId ?? null,
              score: scoreStr,
            })
            .onConflictDoUpdate({
              target: [
                schema.tournamentMatches.tournamentId,
                schema.tournamentMatches.challongeMatchId,
              ],
              set: {
                round: attrs.round,
                state: attrs.state,
                score: scoreStr,
                winnerId: winner?.userId ?? null,
              },
            });
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Error performing tournament action:", error);
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 });
  }
}
