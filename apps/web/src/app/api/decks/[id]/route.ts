/**
 * RPB - Single Deck API (authentifié — session better-auth)
 * GET /api/decks/[id] - Get a deck by ID
 * PUT /api/decks/[id] - Update a deck
 * DELETE /api/decks/[id] - Delete a deck
 *
 * Route legacy authentifiée (hors `/api/v1`). Accès DB via la DAL uniquement.
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  type DeckBeyInput,
  deckBelongsToUser,
  deleteDeck,
  getUserDeck,
  updateDeck,
  validateDeckBeys,
} from "@/server/dal/decks";

// GET - Get a deck
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deck = await getUserDeck(id, session.user.id);
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    return NextResponse.json({ data: deck });
  } catch (error) {
    console.error("Error fetching deck:", error);
    return NextResponse.json({ error: "Failed to fetch deck" }, { status: 500 });
  }
}

// PUT - Update a deck
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, beys, isActive } = body as {
      name?: string;
      isActive?: boolean;
      beys?: DeckBeyInput[];
    };

    if (!(await deckBelongsToUser(id, session.user.id))) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    if (beys) {
      const validation = await validateDeckBeys(beys);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const updated = await updateDeck({
      id,
      userId: session.user.id,
      name,
      isActive,
      beys,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating deck:", error);
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 });
  }
}

// DELETE - Delete a deck
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await deckBelongsToUser(id, session.user.id))) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    await deleteDeck(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deck:", error);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}
