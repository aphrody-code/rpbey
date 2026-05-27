/**
 * GET  /api/gacha/wishlist - Get user's wishlist
 * POST /api/gacha/wishlist - Add/remove card from wishlist
 */
import { type NextRequest, NextResponse } from "next/server";
import { db, schema, and, desc, eq } from "@/lib/db";
import { badRequest, getApiUser, serverError, unauthorized } from "../helpers";

export async function GET() {
	try {
		const user = await getApiUser();
		if (!user) return unauthorized();

		const profile = await db.query.profiles.findFirst({
			where: eq(schema.profiles.userId, user.id),
			columns: { id: true },
		});

		if (!profile) {
			return NextResponse.json({ success: true, cards: [] });
		}

		const wishlist = await db.query.cardWishlists.findMany({
			where: eq(schema.cardWishlists.profileId, profile.id),
			with: { gachaCard: true },
			orderBy: desc(schema.cardWishlists.createdAt),
		});

		return NextResponse.json({
			success: true,
			cards: wishlist.map((w) => w.gachaCard),
		});
	} catch (error) {
		return serverError(error);
	}
}

export async function POST(request: NextRequest) {
	try {
		const user = await getApiUser();
		if (!user) return unauthorized();

		const body = await request.json();
		const { cardId, action } = body as { cardId?: string; action?: string };

		if (!cardId) return badRequest("cardId requis");

		const profile = await db.query.profiles.findFirst({
			where: eq(schema.profiles.userId, user.id),
			columns: { id: true },
		});

		if (!profile) {
			return NextResponse.json(
				{ success: false, error: "Profil introuvable" },
				{ status: 404 },
			);
		}

		if (action === "remove") {
			await db
				.delete(schema.cardWishlists)
				.where(
					and(
						eq(schema.cardWishlists.profileId, profile.id),
						eq(schema.cardWishlists.cardId, cardId),
					),
				);
			return NextResponse.json({ success: true, action: "removed" });
		}

		// Add to wishlist
		await db
			.insert(schema.cardWishlists)
			.values({ profileId: profile.id, cardId })
			.onConflictDoNothing({
				target: [schema.cardWishlists.profileId, schema.cardWishlists.cardId],
			});

		return NextResponse.json({ success: true, action: "added" });
	} catch (error) {
		return serverError(error);
	}
}
