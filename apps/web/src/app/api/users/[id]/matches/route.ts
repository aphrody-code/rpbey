/**
 * RPB - User Matches API
 * Get match history for a specific user
 */

import { type NextRequest, NextResponse } from "next/server";
import { db, schema, and, count, desc, eq, or } from "@/lib/db";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const { id: userId } = await params;
		const { searchParams } = new URL(request.url);
		const limit = parseInt(searchParams.get("limit") ?? "20", 10);
		const offset = parseInt(searchParams.get("offset") ?? "0", 10);

		const where = and(
			or(
				eq(schema.tournamentMatches.player1Id, userId),
				eq(schema.tournamentMatches.player2Id, userId),
			),
			eq(schema.tournamentMatches.state, "complete"),
		);

		const matchRows = await db.query.tournamentMatches.findMany({
			where,
			with: {
				tournament: { columns: { id: true, name: true } },
				user_player1Id: {
					columns: { id: true, name: true, image: true },
					with: { profiles: { columns: { bladerName: true } } },
				},
				user_player2Id: {
					columns: { id: true, name: true, image: true },
					with: { profiles: { columns: { bladerName: true } } },
				},
				user_winnerId: { columns: { id: true } },
			},
			orderBy: desc(schema.tournamentMatches.createdAt),
			limit,
			offset,
		});

		const matches = matchRows.map((m) => ({
			...m,
			player1: m.user_player1Id
				? { ...m.user_player1Id, profile: m.user_player1Id.profiles[0] ?? null }
				: null,
			player2: m.user_player2Id
				? { ...m.user_player2Id, profile: m.user_player2Id.profiles[0] ?? null }
				: null,
			winner: m.user_winnerId ?? null,
		}));

		const [totalRow] = await db
			.select({ value: count() })
			.from(schema.tournamentMatches)
			.where(where);
		const total = totalRow?.value ?? 0;

		return NextResponse.json({
			data: matches,
			meta: { total, limit, offset },
		});
	} catch (error) {
		console.error("Error fetching user matches:", error);
		return NextResponse.json(
			{ error: "Failed to fetch matches" },
			{ status: 500 },
		);
	}
}
