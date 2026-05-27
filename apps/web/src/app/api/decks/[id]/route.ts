/**
 * RPB - Single Deck API
 * GET /api/decks/[id] - Get a deck by ID
 * PUT /api/decks/[id] - Update a deck
 * DELETE /api/decks/[id] - Delete a deck
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, and, asc, eq, inArray, ne } from "@/lib/db";

const DECK_ITEMS_WITH = {
	with: {
		beyblade: true,
		part_bladeId: true,
		part_overBladeId: true,
		part_ratchetId: true,
		part_bitId: true,
		part_lockChipId: true,
		part_assistBladeId: true,
	},
	orderBy: asc(schema.deckItems.position),
} as const;

function remapDeckItem(it: Record<string, unknown>) {
	const {
		beyblade,
		part_bladeId,
		part_overBladeId,
		part_ratchetId,
		part_bitId,
		part_lockChipId,
		part_assistBladeId,
		...rest
	} = it;
	return {
		...rest,
		bey: beyblade ?? null,
		blade: part_bladeId ?? null,
		overBlade: part_overBladeId ?? null,
		ratchet: part_ratchetId ?? null,
		bit: part_bitId ?? null,
		lockChip: part_lockChipId ?? null,
		assistBlade: part_assistBladeId ?? null,
	};
}

function remapDeck<T extends { deckItems: Record<string, unknown>[] }>(
	deck: T,
) {
	const { deckItems, ...rest } = deck;
	return { ...rest, items: deckItems.map(remapDeckItem) };
}

// GET - Get a deck
export async function GET(
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

		const deck = await db.query.decks.findFirst({
			where: and(
				eq(schema.decks.id, id),
				eq(schema.decks.userId, session.user.id),
			),
			with: {
				deckItems: DECK_ITEMS_WITH,
			},
		});

		if (!deck) {
			return NextResponse.json({ error: "Deck not found" }, { status: 404 });
		}

		return NextResponse.json({ data: remapDeck(deck) });
	} catch (error) {
		console.error("Error fetching deck:", error);
		return NextResponse.json(
			{ error: "Failed to fetch deck" },
			{ status: 500 },
		);
	}
}

// PUT - Update a deck
export async function PUT(
	request: NextRequest,
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
		const body = await request.json();
		const { name, beys, isActive } = body as {
			name?: string;
			isActive?: boolean;
			beys?: Array<{
				position: number;
				nickname?: string;
				bladeId: string;
				overBladeId?: string;
				ratchetId: string;
				bitId: string;
				lockChipId?: string;
				assistBladeId?: string;
			}>;
		};

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

		// If updating beys, validate them
		if (beys) {
			if (beys.length !== 3) {
				return NextResponse.json(
					{ error: "Invalid deck: exactly 3 beys required" },
					{ status: 400 },
				);
			}

			const standardPartIds = beys.flatMap((b) => [
				b.bladeId,
				b.ratchetId,
				b.bitId,
			]);
			const uniqueStandardIds = new Set(standardPartIds);
			if (uniqueStandardIds.size !== standardPartIds.length) {
				return NextResponse.json(
					{ error: "Invalid deck: each standard part can only be used once" },
					{ status: 400 },
				);
			}

			// Collect all part IDs for validation
			const allPartIds = [...standardPartIds];
			for (const bey of beys) {
				if (bey.overBladeId) allPartIds.push(bey.overBladeId);
				if (bey.lockChipId) allPartIds.push(bey.lockChipId);
				if (bey.assistBladeId) allPartIds.push(bey.assistBladeId);
			}

			// Validate over blade uniqueness
			const overBladeIds = beys
				.map((b) => b.overBladeId)
				.filter(Boolean) as string[];
			if (new Set(overBladeIds).size !== overBladeIds.length) {
				return NextResponse.json(
					{ error: "Duplicate Over Blades in deck" },
					{ status: 400 },
				);
			}

			// Validate assist blade uniqueness
			const assistBladeIds = beys
				.map((b) => b.assistBladeId)
				.filter(Boolean) as string[];
			const uniqueAssistIds = new Set(assistBladeIds);
			if (uniqueAssistIds.size !== assistBladeIds.length) {
				return NextResponse.json(
					{ error: "Invalid deck: each Assist Blade can only be used once" },
					{ status: 400 },
				);
			}

			const parts = await db.query.parts.findMany({
				where: inArray(schema.parts.id, allPartIds),
			});

			const partMap = new Map(parts.map((p) => [p.id, p]));

			for (const bey of beys) {
				const blade = partMap.get(bey.bladeId);
				const ratchet = partMap.get(bey.ratchetId);
				const bit = partMap.get(bey.bitId);

				if (!blade || (blade.type !== "BLADE" && blade.type !== "OVER_BLADE")) {
					return NextResponse.json(
						{ error: `Invalid blade ID: ${bey.bladeId}` },
						{ status: 400 },
					);
				}

				if (bey.overBladeId) {
					const overBlade = partMap.get(bey.overBladeId);
					if (!overBlade || overBlade.type !== "OVER_BLADE") {
						return NextResponse.json(
							{ error: `Invalid over blade ID: ${bey.overBladeId}` },
							{ status: 400 },
						);
					}
				}

				if (!ratchet || ratchet.type !== "RATCHET") {
					return NextResponse.json(
						{ error: `Invalid ratchet ID: ${bey.ratchetId}` },
						{ status: 400 },
					);
				}
				if (!bit || bit.type !== "BIT") {
					return NextResponse.json(
						{ error: `Invalid bit ID: ${bey.bitId}` },
						{ status: 400 },
					);
				}

				if (bey.lockChipId) {
					const lockChip = partMap.get(bey.lockChipId);
					if (!lockChip || lockChip.type !== "LOCK_CHIP") {
						return NextResponse.json(
							{ error: `Invalid lock chip ID: ${bey.lockChipId}` },
							{ status: 400 },
						);
					}
				}

				if (bey.assistBladeId) {
					const assistBlade = partMap.get(bey.assistBladeId);
					if (!assistBlade || assistBlade.type !== "ASSIST_BLADE") {
						return NextResponse.json(
							{ error: `Invalid assist blade ID: ${bey.assistBladeId}` },
							{ status: 400 },
						);
					}
				}
			}
		}

		// If setting as active, deactivate other decks
		if (isActive) {
			await db
				.update(schema.decks)
				.set({ isActive: false })
				.where(
					and(
						eq(schema.decks.userId, session.user.id),
						eq(schema.decks.isActive, true),
						ne(schema.decks.id, id),
					),
				);
		}

		// Update deck
		await db.transaction(async (tx) => {
			const setData: Record<string, unknown> = {};
			if (name) setData.name = name;
			if (isActive !== undefined) setData.isActive = isActive;
			if (Object.keys(setData).length > 0) {
				await tx
					.update(schema.decks)
					.set(setData)
					.where(eq(schema.decks.id, id));
			}
			if (beys) {
				await tx
					.delete(schema.deckItems)
					.where(eq(schema.deckItems.deckId, id));
				await tx.insert(schema.deckItems).values(
					beys.map((bey) => ({
						deckId: id,
						position: bey.position,
						bladeId: bey.bladeId,
						overBladeId: bey.overBladeId || null,
						ratchetId: bey.ratchetId,
						bitId: bey.bitId,
						lockChipId: bey.lockChipId || null,
						assistBladeId: bey.assistBladeId || null,
					})),
				);
			}
		});

		const updatedDeck = await db.query.decks.findFirst({
			where: eq(schema.decks.id, id),
			with: { deckItems: DECK_ITEMS_WITH },
		});

		return NextResponse.json({ data: remapDeck(updatedDeck!) });
	} catch (error) {
		console.error("Error updating deck:", error);
		return NextResponse.json(
			{ error: "Failed to update deck" },
			{ status: 500 },
		);
	}
}

// DELETE - Delete a deck
export async function DELETE(
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

		await db.delete(schema.decks).where(eq(schema.decks.id, id));

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting deck:", error);
		return NextResponse.json(
			{ error: "Failed to delete deck" },
			{ status: 500 },
		);
	}
}
