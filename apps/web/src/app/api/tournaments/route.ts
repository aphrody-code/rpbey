/**
 * RPB - Tournaments API
 * Complete CRUD for tournaments with Challonge sync
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireStaff } from "@/lib/auth-utils";
import { getChallongeService } from "@/lib/challonge";
import { db, schema, count, desc, eq, isNull } from "@/lib/db";

// GET - List tournaments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    const validStatuses = ["PENDING", "ACTIVE", "COMPLETE", "ARCHIVED"];
    const where =
      status && validStatuses.includes(status)
        ? eq(
            schema.tournaments.status,
            status as (typeof schema.tournamentStatus.enumValues)[number],
          )
        : undefined;

    const [tournamentRows, totalRows] = await Promise.all([
      db.query.tournaments.findMany({
        where,
        with: {
          tournamentParticipants: {
            with: {
              user: {
                with: {
                  profiles: true,
                },
              },
            },
          },
          tournamentMatches: { columns: { id: true } },
        },
        orderBy: desc(schema.tournaments.date),
        limit,
        offset,
      }),
      db.select({ value: count() }).from(schema.tournaments).where(where),
    ]);

    const tournaments = tournamentRows.map((t) => ({
      ...t,
      _count: {
        participants: t.tournamentParticipants.length,
        matches: t.tournamentMatches.length,
      },
      participants: t.tournamentParticipants.map((p) => ({
        ...p,
        user: p.user ? { ...p.user, profile: p.user.profiles[0] ?? null } : null,
      })),
    }));

    const total = totalRows[0]?.value ?? 0;

    return NextResponse.json({
      data: tournaments,
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

    const [tournament] = await db
      .insert(schema.tournaments)
      .values({
        name,
        description,
        date: new Date(date).toISOString(),
        location,
        format: format ?? "3on3 Double Elimination",
        maxPlayers: maxPlayers ?? 64,
        challongeId,
        challongeUrl,
        status: "UPCOMING",
      })
      .returning();

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

    if (deleteAll) {
      const deleted = await db.delete(schema.tournaments).returning({ id: schema.tournaments.id });
      return NextResponse.json({
        deleted: deleted.length,
        message: "All tournaments deleted",
      });
    }

    // Delete only fake tournaments (no challongeId)
    const deleted = await db
      .delete(schema.tournaments)
      .where(isNull(schema.tournaments.challongeId))
      .returning({ id: schema.tournaments.id });

    return NextResponse.json({
      deleted: deleted.length,
      message: "Fake tournaments deleted",
    });
  } catch (error) {
    console.error("Error deleting tournaments:", error);
    return NextResponse.json({ error: "Failed to delete tournaments" }, { status: 500 });
  }
}
