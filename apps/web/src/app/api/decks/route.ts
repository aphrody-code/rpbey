/**
 * RPB - Decks API
 * GET /api/decks - List user's decks
 * POST /api/decks - Create a new deck
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema, and, asc, desc, eq, inArray } from "@/lib/db";

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

// Remap drizzle relation field names → Prisma-style names
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

function remapDeck<T extends { deckItems: Record<string, unknown>[] }>(deck: T) {
  const { deckItems, ...rest } = deck;
  return { ...rest, items: deckItems.map(remapDeckItem) };
}

// GET - List user's decks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const targetUserId = userIdParam || session?.user?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If viewing someone else's decks, only show the active one
    const conditions = [eq(schema.decks.userId, targetUserId)];
    if (userIdParam && userIdParam !== session?.user?.id) {
      conditions.push(eq(schema.decks.isActive, true));
    }

    const decks = await db.query.decks.findMany({
      where: and(...conditions),
      with: {
        deckItems: DECK_ITEMS_WITH,
      },
      orderBy: [desc(schema.decks.isActive), desc(schema.decks.updatedAt)],
    });

    const formattedDecks = decks.map((deck) => {
      const remapped = remapDeck(deck);
      return { ...remapped, beys: remapped.items };
    });

    return NextResponse.json({ data: formattedDecks });
  } catch (error) {
    console.error("Error fetching decks:", error);
    return NextResponse.json({ error: "Failed to fetch decks" }, { status: 500 });
  }
}

// POST - Create a new deck
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, beys, isActive } = body as {
      name: string;
      isActive?: boolean;
      beys: Array<{
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

    // Validate input
    if (!name || !beys || beys.length !== 3) {
      return NextResponse.json(
        { error: "Invalid deck: name and exactly 3 beys required" },
        { status: 400 },
      );
    }

    // Validate uniqueness of standard parts within deck
    const standardPartIds = beys.flatMap((b) => [b.bladeId, b.ratchetId, b.bitId]);
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
    const overBladeIds = beys.map((b) => b.overBladeId).filter(Boolean) as string[];
    if (new Set(overBladeIds).size !== overBladeIds.length) {
      return NextResponse.json({ error: "Duplicate Over Blades in deck" }, { status: 400 });
    }

    // Validate assist blade uniqueness
    const assistBladeIds = beys.map((b) => b.assistBladeId).filter(Boolean) as string[];
    const uniqueAssistIds = new Set(assistBladeIds);
    if (uniqueAssistIds.size !== assistBladeIds.length) {
      return NextResponse.json(
        { error: "Invalid deck: each Assist Blade can only be used once" },
        { status: 400 },
      );
    }

    // Validate parts exist and are correct types
    const parts = await db.query.parts.findMany({
      where: inArray(schema.parts.id, allPartIds),
    });

    const partMap = new Map(parts.map((p) => [p.id, p]));

    for (const bey of beys) {
      const blade = partMap.get(bey.bladeId);
      const ratchet = partMap.get(bey.ratchetId);
      const bit = partMap.get(bey.bitId);

      if (!blade || (blade.type !== "BLADE" && blade.type !== "OVER_BLADE")) {
        return NextResponse.json({ error: `Invalid blade ID: ${bey.bladeId}` }, { status: 400 });
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
        return NextResponse.json({ error: `Invalid bit ID: ${bey.bitId}` }, { status: 400 });
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

    // If setting as active, deactivate other decks
    if (isActive) {
      await db
        .update(schema.decks)
        .set({ isActive: false })
        .where(and(eq(schema.decks.userId, session.user.id), eq(schema.decks.isActive, true)));
    }

    // Create deck with beys
    const createdDeckId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.decks)
        .values({
          name,
          isActive: isActive ?? false,
          userId: session.user.id,
        })
        .returning();
      await tx.insert(schema.deckItems).values(
        beys.map((bey) => ({
          deckId: created!.id,
          position: bey.position,
          bladeId: bey.bladeId,
          overBladeId: bey.overBladeId || null,
          ratchetId: bey.ratchetId,
          bitId: bey.bitId,
          lockChipId: bey.lockChipId || null,
          assistBladeId: bey.assistBladeId || null,
        })),
      );
      return created!.id;
    });

    const deck = await db.query.decks.findFirst({
      where: eq(schema.decks.id, createdDeckId),
      with: { deckItems: DECK_ITEMS_WITH },
    });

    const remapped = remapDeck(deck!);
    const formattedDeck = { ...remapped, beys: remapped.items };

    return NextResponse.json({ data: formattedDeck }, { status: 201 });
  } catch (error) {
    console.error("Error creating deck:", error);
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 });
  }
}
