/**
 * RPB - Tournament Live Data API
 *
 * GET  : returns the cached live snapshot stored on the Tournament row.
 * POST : refreshes the snapshot from Challonge using @rose-griffon/challonge
 *        (API v1 + Cloudflare-bypassed reverse).  Staff-only.
 *
 * The historical implementation booted a Puppeteer scraper here, which broke
 * the moment Cloudflare started fingerprinting Runtime.enable.  The new
 * pipeline is browser-less and stays inside the Bun runtime.
 */

import { type NextRequest, NextResponse } from "next/server";
import { ChallongeApi } from "@rose-griffon/challonge/api";
import { ChallongeReverse } from "@rose-griffon/challonge/reverse";
import { requireStaff } from "@/lib/auth-utils";
import {
  getTournamentChallongeRef,
  getTournamentForLive,
  persistLiveSnapshot,
} from "@/server/dal/tournaments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Slug helper — accepts `B_TS4`, `fr/B_TS4`, full URL.
function extractSlug(input: string): string {
  let s = input
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^\//, "")
    .replace(/\/+$/, "");
  // Strip language prefix (`fr/`, `en/`, `ja/`, …)
  s = s.replace(/^(fr|en|es|de|ja|pt)\//, "");
  return s;
}

function summary(data: {
  matches: Array<{ state?: string }>;
  standings: unknown[];
  stations: unknown[];
}) {
  const completed = data.matches.filter((m) => m.state === "complete").length;
  const open = data.matches.filter((m) => m.state === "open").length;
  const pending = data.matches.filter((m) => m.state === "pending").length;
  return {
    matchesCount: data.matches.length,
    matchesComplete: completed,
    matchesOpen: open,
    matchesPending: pending,
    standingsCount: data.standings.length,
    stationsCount: data.stations.length,
  };
}

// ─── GET ────────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;


    const tournament = await getTournamentForLive(id);

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        standings: tournament.standings ?? [],
        stations: tournament.stations ?? [],
        activityLog: tournament.activityLog ?? [],
        lastUpdated: tournament.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching live data:", error);
    return NextResponse.json({ error: "Failed to fetch live data" }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireStaff())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const tournament = await getTournamentChallongeRef(id);

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const challongeRef =
      tournament.challongeId ??
      (tournament.challongeUrl ? extractSlug(tournament.challongeUrl) : null);

    if (!challongeRef) {
      return NextResponse.json({ error: "Tournament not linked to Challonge" }, { status: 400 });
    }

    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "CHALLONGE_API_KEY not configured" }, { status: 500 });
    }

    // 1. API v1 — typed source of truth
    const api = new ChallongeApi({ apiKey });
    const apiTournament = await api.get(challongeRef, {
      includeParticipants: true,
      includeMatches: true,
    });
    const canonical = api.toCanonical(apiTournament, { synthesizeLog: true });
    const participants = canonical.participants;
    const matches = canonical.matches;
    const activityLog = canonical.log;

    // 2. Reverse — best effort enrichment for live standings/store
    const reverseSlug = tournament.challongeUrl
      ? extractSlug(tournament.challongeUrl)
      : String(apiTournament.id);
    const reverse = new ChallongeReverse();
    const [standingsResult, storeResult] = await Promise.allSettled([
      reverse.getStandings(reverseSlug),
      reverse.getStore(reverseSlug),
    ]);
    const liveStandings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
    const store = storeResult.status === "fulfilled" ? storeResult.value : null;

    // 3. Persist
    await persistLiveSnapshot(id, {
      challongeId: tournament.challongeId ?? String(apiTournament.id),
      challongeState: apiTournament.state ?? null,
      standings: liveStandings,
      stations: store ?? [],
      activityLog,
    });

    return NextResponse.json({
      success: true,
      data: {
        standings: liveStandings,
        stations: store ?? [],
        activityLog,
        participantsCount: participants.length,
        ...summary({ matches, standings: liveStandings, stations: [] }),
      },
    });
  } catch (error) {
    console.error("Error scraping live data:", error);
    return NextResponse.json(
      {
        error: "Failed to scrape live data",
        message: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
