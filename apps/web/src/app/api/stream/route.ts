/**
 * RPB Stream API — Tournament Stream Helper integration
 *
 * Public endpoint for TSH to discover active/recent tournaments.
 * GET /api/stream → list streamable tournaments
 */

import { type NextRequest, NextResponse } from "next/server";
import { db, schema, and, desc, eq, gte, or } from "@/lib/db";

export async function GET(_request: NextRequest) {
  try {
    // Return tournaments that are UNDERWAY or recently COMPLETE (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const tournamentRows = await db.query.tournaments.findMany({
      where: or(
        eq(schema.tournaments.status, "UNDERWAY"),
        eq(schema.tournaments.status, "CHECKIN"),
        and(
          eq(schema.tournaments.status, "COMPLETE"),
          gte(schema.tournaments.updatedAt, oneDayAgo),
        ),
      ),
      columns: {
        id: true,
        name: true,
        status: true,
        format: true,
        date: true,
        location: true,
        challongeUrl: true,
        updatedAt: true,
      },
      with: {
        tournamentParticipants: { columns: { id: true } },
        tournamentMatches: { columns: { id: true } },
      },
      orderBy: desc(schema.tournaments.updatedAt),
    });

    const tournaments = tournamentRows.map((t) => ({
      ...t,
      _count: {
        participants: t.tournamentParticipants.length,
        matches: t.tournamentMatches.length,
      },
    }));

    // Also include scraped BTS tournaments
    const scrapedTournaments = [];
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    for (const slug of ["B_TS2", "B_TS3"]) {
      const filePath = join(process.cwd(), "data/exports", `${slug}.json`);
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        scrapedTournaments.push({
          id: slug.toLowerCase(),
          name: `Bey-Tamashii Séries - ${slug}`,
          status: "COMPLETE",
          format: "3on3 Double Elimination",
          challongeUrl: data.url,
          participantsCount: data.participantsCount,
          matchesCount: data.matchesCount,
          scrapedAt: data.scrapedAt,
        });
      }
    }

    return NextResponse.json({
      data: {
        active: tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          format: t.format,
          date: t.date,
          location: t.location,
          challongeUrl: t.challongeUrl,
          participantsCount: t._count.participants,
          matchesCount: t._count.matches,
          streamUrl: `/api/stream/${t.id}`,
          updatedAt: t.updatedAt,
        })),
        scraped: scrapedTournaments,
      },
    });
  } catch (error) {
    console.error("Stream API error:", error);
    return NextResponse.json({ error: "Failed to list tournaments" }, { status: 500 });
  }
}
