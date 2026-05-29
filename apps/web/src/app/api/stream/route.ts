/**
 * RPB Stream API — Tournament Stream Helper integration
 *
 * Public endpoint for TSH to discover active/recent tournaments.
 * GET /api/stream → list streamable tournaments
 */

import { type NextRequest, NextResponse } from "next/server";
import { loadJsonSafe } from "@/lib/data-cache";
import { listStreamableTournaments } from "@/server/dal/stream";

interface ScrapedExport {
  url?: string;
  participantsCount?: number;
  matchesCount?: number;
  scrapedAt?: string;
}

export async function GET(_request: NextRequest) {
  try {
    // Tournaments that are UNDERWAY / CHECKIN, or recently COMPLETE (last 24h).
    const tournamentRows = await listStreamableTournaments();

    const tournaments = tournamentRows.map((t) => ({
      ...t,
      _count: {
        participants: t.tournamentParticipants.length,
        matches: t.tournamentMatches.length,
      },
    }));

    // Also include scraped BTS tournaments (FS/CDN via loadJsonSafe — pas de process.cwd()).
    const scrapedTournaments = [];
    for (const slug of ["B_TS2", "B_TS3"]) {
      const data = await loadJsonSafe<ScrapedExport>(`data/exports/${slug}.json`);
      if (data) {
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
