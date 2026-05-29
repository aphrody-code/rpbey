/**
 * RPB - Set Active Deck API (authentifié — session better-auth)
 * POST /api/decks/[id]/activate - Set a deck as active
 *
 * Route legacy authentifiée (hors `/api/v1`). Accès DB via la DAL uniquement.
 */

import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateDeck, deckBelongsToUser } from "@/server/dal/decks";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await deckBelongsToUser(id, session.user.id))) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    await activateDeck(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error activating deck:", error);
    return NextResponse.json({ error: "Failed to activate deck" }, { status: 500 });
  }
}
