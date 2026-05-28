import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, and, eq } from "@/lib/db";
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
		await db
			.insert(schema.profiles)
			.values({
				userId: session.user.id,
				bladerName: session.user.name,
			})
			.onConflictDoNothing({ target: schema.profiles.userId });

		// Check if tournament exists
		const tournament = await db.query.tournaments.findFirst({
			where: eq(schema.tournaments.id, id),
			with: { tournamentParticipants: true },
		});

		if (!tournament) {
			return NextResponse.json(
				{ error: "Tournament not found" },
				{ status: 404 },
			);
		}

		// Check if already registered
		const existingParticipant = await db.query.tournamentParticipants.findFirst(
			{
				where: and(
					eq(schema.tournamentParticipants.tournamentId, id),
					eq(schema.tournamentParticipants.userId, session.user.id),
				),
			},
		);

		if (existingParticipant) {
			return NextResponse.json(
				{ error: "Already registered" },
				{ status: 400 },
			);
		}

		// Check if tournament is full
		if (
			tournament.maxPlayers &&
			tournament.tournamentParticipants.length >= tournament.maxPlayers
		) {
			return NextResponse.json(
				{ error: "Tournament is full" },
				{ status: 400 },
			);
		}

		// Register participant
		const [created] = await db
			.insert(schema.tournamentParticipants)
			.values({
				tournamentId: id,
				userId: session.user.id,
			})
			.returning();

		const participantRow = await db.query.tournamentParticipants.findFirst({
			where: eq(schema.tournamentParticipants.id, created!.id),
			with: { user: { with: { profiles: true } } },
		});

		const participant = participantRow
			? {
					...participantRow,
					user: participantRow.user
						? {
								...participantRow.user,
								profile: participantRow.user.profiles[0] ?? null,
							}
						: null,
				}
			: created;

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
		await db
			.delete(schema.tournamentParticipants)
			.where(
				and(
					eq(schema.tournamentParticipants.tournamentId, id),
					eq(schema.tournamentParticipants.userId, session.user.id),
				),
			);

		return NextResponse.json({ message: "Unregistered from tournament" });
	} catch (error) {
		console.error("Error unregistering from tournament:", error);
		return NextResponse.json(
			{ error: "Failed to unregister" },
			{ status: 500 },
		);
	}
}
