/**
 * RPB - Tournaments API
 * Complete CRUD for tournaments with Challonge sync
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireStaff } from "@/lib/auth-utils";
import { getChallongeService } from "@/lib/challonge";
import {
  createTournamentRow,
  deleteTournamentsBulk,
  listTournamentCards,
} from "@/server/dal/tournaments";

const VALID_STATUSES = [
  "UPCOMING",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "CHECKIN",
  "UNDERWAY",
  "COMPLETE",
  "CANCELLED",
  "ARCHIVED",
] as const;
type StatusVal = (typeof VALID_STATUSES)[number];

// GET - List tournaments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    const status =
      statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as StatusVal)
        : undefined;

    const { items, total } = await listTournamentCards({
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      data: items,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json({ error: "Failed to fetch tournaments" }, { status: 500 });
  }
}

// POST - Create tournament
export async function POST(request: NextRequest) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, date, location, format, maxPlayers, createOnChallonge } = body as {
      name: string;
      description?: string;
      date: string;
      location?: string;
      format?: string;
      maxPlayers?: number;
      createOnChallonge?: boolean;
    };

    if (!name || !date) {
      return NextResponse.json({ error: "Name and date are required" }, { status: 400 });
    }

    let challongeId: string | undefined;
    let challongeUrl: string | undefined;

    // Create on Challonge if requested
    if (createOnChallonge) {
      try {
        const challonge = getChallongeService();
        const result = await challonge.createTournament({
          name,
          description,
          tournamentType: format?.includes("Double") ? "double elimination" : "single elimination",
          gameName: "Beyblade X",
          startAt: new Date(date).toISOString(),
          signupCap: maxPlayers,
        });

        challongeId = result.id;
        challongeUrl = `https://challonge.com/${result.attributes.url}`;
      } catch (err) {
        console.error("Failed to create Challonge tournament:", err);
        // Continue without Challonge integration
      }
    }

    const tournament = await createTournamentRow({
      name,
      description,
      date: new Date(date).toISOString(),
      location,
      format: format ?? "3on3 Double Elimination",
      maxPlayers: maxPlayers ?? 64,
      challongeId,
      challongeUrl,
      status: "UPCOMING",
    });

    return NextResponse.json({ data: tournament }, { status: 201 });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json({ error: "Failed to create tournament" }, { status: 500 });
  }
}

// DELETE - Delete fake tournaments (admin only)
export async function DELETE(request: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get("all") === "true";

    const deleted = await deleteTournamentsBulk({ all: deleteAll });

    return NextResponse.json({
      deleted,
      message: deleteAll ? "All tournaments deleted" : "Fake tournaments deleted",
    });
  } catch (error) {
    console.error("Error deleting tournaments:", error);
    return NextResponse.json({ error: "Failed to delete tournaments" }, { status: 500 });
  }
}
