/**
 * RPB - Single User API
 * Get user details by ID
 */

import { type NextRequest, NextResponse } from "next/server";
import { db, schema, and, asc, count, eq, inArray, or } from "@/lib/db";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;

		const userRow = await db.query.users.findFirst({
			where: eq(schema.users.id, id),
			columns: {
				id: true,
				name: true,
				image: true,
				createdAt: true,
				discordTag: true,
				nickname: true,
				serverAvatar: true,
				globalName: true,
				roles: true,
			},
			with: {
				profiles: {
					columns: {
						bladerName: true,
						favoriteType: true,
						experience: true,
						bio: true,
						wins: true,
						losses: true,
						tournamentWins: true,
						twitterHandle: true,
						tiktokHandle: true,
					},
				},
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
		});

		if (!userRow) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// _count aggregates (Prisma _count)
		const [tournamentsRow, p1Row, p2Row] = await Promise.all([
			db
				.select({ value: count() })
				.from(schema.tournamentParticipants)
				.where(eq(schema.tournamentParticipants.userId, id)),
			db
				.select({ value: count() })
				.from(schema.tournamentMatches)
				.where(eq(schema.tournamentMatches.player1Id, id)),
			db
				.select({ value: count() })
				.from(schema.tournamentMatches)
				.where(eq(schema.tournamentMatches.player2Id, id)),
		]);

		const user = {
			...userRow,
			profile: userRow.profiles[0] ?? null,
			decks: userRow.decks.map((d) => ({
				...d,
				items: d.deckItems.map((it) => ({
					...it,
					bey: it.beyblade,
					blade: it.part_bladeId,
					ratchet: it.part_ratchetId,
					bit: it.part_bitId,
				})),
			})),
			_count: {
				tournaments: tournamentsRow[0]?.value ?? 0,
				player1Matches: p1Row[0]?.value ?? 0,
				player2Matches: p2Row[0]?.value ?? 0,
			},
		};

		return NextResponse.json({ data: user });
	} catch (error) {
		console.error("Error fetching user:", error);
		return NextResponse.json(
			{ error: "Failed to fetch user" },
			{ status: 500 },
		);
	}
}
