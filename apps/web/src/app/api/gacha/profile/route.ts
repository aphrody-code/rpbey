/**
 * GET /api/gacha/profile
 * Get user's TCG profile (currency, streak, stats)
 */
import { NextResponse } from "next/server";
import { db, schema, count, eq } from "@/lib/db";
import { getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
	try {
		const user = await getApiUser();
		if (!user) return unauthorized();

		const profile = await db.query.profiles.findFirst({
			where: eq(schema.profiles.userId, user.id),
			columns: {
				id: true,
				userId: true,
				bladerName: true,
				currency: true,
				dailyStreak: true,
				lastDaily: true,
				pityCount: true,
				wins: true,
				losses: true,
				tournamentWins: true,
			},
		});

		if (!profile) {
			return NextResponse.json(
				{ success: false, error: "Profil introuvable" },
				{ status: 404 },
			);
		}

		// Count cards
		const [cardCountRow] = await db
			.select({ value: count() })
			.from(schema.cardInventory)
			.where(eq(schema.cardInventory.userId, user.id));
		const cardCount = cardCountRow?.value ?? 0;

		const [totalCardsRow] = await db
			.select({ value: count() })
			.from(schema.gachaCards)
			.where(eq(schema.gachaCards.isActive, true));
		const totalCards = totalCardsRow?.value ?? 0;

		return NextResponse.json({
			success: true,
			profile: {
				...profile,
				cardCount,
				totalCards,
				user: {
					id: user.id,
					name: user.name,
					image: user.image,
					discordTag: (user as Record<string, unknown>).discordTag,
				},
			},
		});
	} catch (error) {
		return serverError(error);
	}
}
