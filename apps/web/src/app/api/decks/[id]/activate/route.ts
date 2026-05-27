/**
 * RPB - Set Active Deck API
 * POST /api/decks/[id]/activate - Set a deck as active
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, and, eq } from "@/lib/db";

export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;

		// Check ownership
		const existingDeck = await db.query.decks.findFirst({
			where: and(
				eq(schema.decks.id, id),
				eq(schema.decks.userId, session.user.id),
			),
		});

		if (!existingDeck) {
			return NextResponse.json({ error: "Deck not found" }, { status: 404 });
		}

		// Deactivate all other decks and activate this one
		await db.transaction(async (tx) => {
			await tx
				.update(schema.decks)
				.set({ isActive: false })
				.where(
					and(
						eq(schema.decks.userId, session.user.id),
						eq(schema.decks.isActive, true),
					),
				);
			await tx
				.update(schema.decks)
				.set({ isActive: true })
				.where(eq(schema.decks.id, id));
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error activating deck:", error);
		return NextResponse.json(
			{ error: "Failed to activate deck" },
			{ status: 500 },
		);
	}
}
