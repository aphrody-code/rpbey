/**
 * POST /api/gacha/multi
 * Multi pull: 5 cards for 450 BeyCoins (10% discount), guaranteed 1 SR+
 */
import { NextResponse } from "next/server";
import { db, schema, and, count, desc, eq, sql } from "@/lib/db";
import {
	getApiUser,
	MULTI_PULL_COST,
	MULTI_PULL_COUNT,
	rollCardRarity,
	serverError,
	unauthorized,
} from "../helpers";

export async function POST() {
	try {
		const user = await getApiUser();
		if (!user) return unauthorized();

		const result = await db.transaction(async (tx) => {
			const profile = await tx.query.profiles.findFirst({
				where: eq(schema.profiles.userId, user.id),
				columns: { id: true, currency: true, pityCount: true },
			});

			if (!profile) throw new Error("NO_PROFILE");
			if (profile.currency < MULTI_PULL_COST)
				throw new Error("INSUFFICIENT_FUNDS");

			// Roll all rarities
			const rarities = Array.from({ length: MULTI_PULL_COUNT }, () =>
				rollCardRarity(),
			);

			// Guarantee at least 1 SR+
			const hasSRPlus = rarities.some((r) =>
				["SUPER_RARE", "LEGENDARY", "SECRET"].includes(r),
			);
			if (!hasSRPlus) {
				rarities[MULTI_PULL_COUNT - 1] = "SUPER_RARE";
			}

			// Select cards for each rarity
			const cards = [];
			for (const rarity of rarities) {
				const [cnt] = await tx
					.select({ value: count() })
					.from(schema.gachaCards)
					.where(
						and(
							eq(schema.gachaCards.rarity, rarity),
							eq(schema.gachaCards.isActive, true),
						),
					);
				let card = await tx.query.gachaCards.findFirst({
					where: and(
						eq(schema.gachaCards.rarity, rarity),
						eq(schema.gachaCards.isActive, true),
					),
					orderBy: desc(schema.gachaCards.createdAt),
					offset: Math.floor(Math.random() * (cnt?.value ?? 0)),
				});

				if (!card) {
					card = await tx.query.gachaCards.findFirst({
						where: eq(schema.gachaCards.isActive, true),
					});
				}

				if (card) cards.push(card);
			}

			if (cards.length === 0) throw new Error("NO_CARDS");

			// Deduct currency
			const [updatedProfile] = await tx
				.update(schema.profiles)
				.set({
					currency: sql`${schema.profiles.currency} - ${MULTI_PULL_COST}`,
					pityCount: 0,
				})
				.where(eq(schema.profiles.userId, user.id))
				.returning();

			// Add all cards to inventory
			for (const card of cards) {
				await tx
					.insert(schema.cardInventory)
					.values({ userId: user.id, cardId: card.id, count: 1 })
					.onConflictDoUpdate({
						target: [schema.cardInventory.userId, schema.cardInventory.cardId],
						set: { count: sql`${schema.cardInventory.count} + 1` },
					});
			}

			// Log transaction
			await tx.insert(schema.currencyTransactions).values({
				userId: user.id,
				amount: -MULTI_PULL_COST,
				type: "MULTI_PULL",
				note: `Multi-tirage ×${cards.length}`,
			});

			return {
				cards,
				newBalance: updatedProfile!.currency,
				pityCount: 0,
			};
		});

		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === "NO_PROFILE")
				return NextResponse.json(
					{ success: false, error: "Profil introuvable" },
					{ status: 404 },
				);
			if (error.message === "INSUFFICIENT_FUNDS")
				return NextResponse.json(
					{
						success: false,
						error: `Solde insuffisant (${MULTI_PULL_COST} requis)`,
					},
					{ status: 400 },
				);
			if (error.message === "NO_CARDS")
				return NextResponse.json(
					{ success: false, error: "Aucune carte disponible" },
					{ status: 404 },
				);
		}
		return serverError(error);
	}
}
