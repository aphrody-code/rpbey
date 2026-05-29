/**
 * RPB - Decks API (authentifié — session better-auth)
 * GET /api/decks - List user's decks
 * POST /api/decks - Create a new deck
 *
 * Route legacy authentifiée : reste hors `/api/v1` (la lecture publique d'un deck
 * partageable est exposée par `/api/v1/decks?id=`). Tout l'accès DB passe par la DAL.
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDeck, type DeckBeyInput, listUserDecks, validateDeckBeys } from "@/server/dal/decks";

// GET - List user's decks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");

    const session = await auth.api.getSession({ headers: await headers() });
    const targetUserId = userIdParam || session?.user?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Viewing someone else's decks → only the active one.
    const onlyActive = Boolean(userIdParam && userIdParam !== session?.user?.id);
    const decks = await listUserDecks(targetUserId, onlyActive);

    const formattedDecks = decks.map((deck) => ({ ...deck, beys: deck.items }));
    return NextResponse.json({ data: formattedDecks });
  } catch (error) {
    console.error("Error fetching decks:", error);
    return NextResponse.json({ error: "Failed to fetch decks" }, { status: 500 });
  }
}

// POST - Create a new deck
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, beys, isActive } = body as {
      name: string;
      isActive?: boolean;
      beys: DeckBeyInput[];
    };

    if (!name || !beys || beys.length !== 3) {
      return NextResponse.json(
        { error: "Invalid deck: name and exactly 3 beys required" },
        { status: 400 },
      );
    }

    const validation = await validateDeckBeys(beys);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const deck = await createDeck({
      userId: session.user.id,
      name,
      isActive: isActive ?? false,
      beys,
    });

    const formattedDeck = { ...deck, beys: deck.items };
    return NextResponse.json({ data: formattedDeck }, { status: 201 });
  } catch (error) {
    console.error("Error creating deck:", error);
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 });
  }
}
