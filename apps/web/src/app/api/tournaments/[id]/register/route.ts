import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  countParticipants,
  createParticipant,
  deleteParticipant,
  ensureProfile,
  findParticipant,
  getParticipantWithUser,
  getTournamentById,
} from "@/server/dal/tournaments";
import { anonSessionId, clientIpFromHeaders, recordEvent } from "@/lib/analytics";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get current user
    const h = await headers();
    const session = await auth.api.getSession({
      headers: h,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user profile exists
    await ensureProfile(session.user.id, session.user.name);

    // Check if tournament exists
    const tournament = await getTournamentById(id);

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Check if already registered
    const existingParticipant = await findParticipant(id, session.user.id);

    if (existingParticipant) {
      return NextResponse.json({ error: "Already registered" }, { status: 400 });
    }

    // Check if tournament is full
    if (tournament.maxPlayers && (await countParticipants(id)) >= tournament.maxPlayers) {
      return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
    }

    // Register participant
    const created = await createParticipant({
      tournamentId: id,
      userId: session.user.id,
    });

    const participant = (created && (await getParticipantWithUser(created.id))) ?? created;

    void recordEvent({
      type: "tournament_register",
      path: `/tournaments/${id}`,
      referrer: h.get("referer"),
      sessionId: anonSessionId(clientIpFromHeaders(h), h.get("user-agent")),
      userId: session.user.id,
      meta: { tournamentId: id, tournamentName: tournament.name },
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("Error registering for tournament:", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get current user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete registration
    await deleteParticipant(id, session.user.id);

    return NextResponse.json({ message: "Unregistered from tournament" });
  } catch (error) {
    console.error("Error unregistering from tournament:", error);
    return NextResponse.json({ error: "Failed to unregister" }, { status: 500 });
  }
}
