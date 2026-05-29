import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getExternalLeaderboardSnapshot } from "@/server/dal/rankings";

export const revalidate = 60; // Cache for 1 minute

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://rpbey.fr",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    },
  });
}

export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const expectedApiKey = process.env.EXTERNAL_PARTNER_KEY;

  if (!expectedApiKey) {
    return NextResponse.json({ error: "API key not configured on server" }, { status: 500 });
  }

  // Security: Constant-time comparison
  const providedKeyBuffer = new TextEncoder().encode(apiKey || "");
  const expectedKeyBuffer = new TextEncoder().encode(expectedApiKey);

  if (
    providedKeyBuffer.length !== expectedKeyBuffer.length ||
    !crypto.timingSafeEqual(providedKeyBuffer, expectedKeyBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rankingConfig, tournamentRows, players, activeSeasonRow } =
      await getExternalLeaderboardSnapshot();

    const tournaments = tournamentRows.map((t) => ({
      ...t,
      category: t.tournamentCategory,
      participants: t.tournamentParticipants.map((p) => ({
        ...p,
        user: p.user ? { ...p.user, profile: p.user.profiles[0] ?? null } : null,
      })),
      matches: t.tournamentMatches.map((m) => ({
        ...m,
        player1: m.user_player1Id,
        player2: m.user_player2Id,
        winner: m.user_winnerId,
      })),
    }));

    const activeSeason = activeSeasonRow
      ? {
          ...activeSeasonRow,
          entries: activeSeasonRow.seasonEntries.map((e) => ({
            ...e,
            user: e.user ? { ...e.user, profile: e.user.profiles[0] ?? null } : null,
          })),
        }
      : null;

    const response = NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      config: rankingConfig,
      season: activeSeason,
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        date: t.date,
        status: t.status,
        format: t.format,
        multiplier: t.category?.multiplier || t.weight || 1.0,
        participants: t.participants.map((p) => ({
          userId: p.userId,
          name:
            p.playerName ||
            p.user?.profile?.bladerName ||
            p.user?.name ||
            p.user?.username ||
            "Unknown",
          discordTag: p.user?.discordTag || null,
          image: p.user?.image || null,
          placement: p.finalPlacement,
          wins: p.wins,
          losses: p.losses,
          points: p.user?.profile?.rankingPoints || 0,
        })),
        matches: t.matches.map((m) => ({
          id: m.id,
          round: m.round,
          player1: m.player1?.name || m.player1?.username || "Unknown",
          player2: m.player2?.name || m.player2?.username || "Unknown",
          winner: m.winner?.name || m.winner?.username || null,
          score: m.score,
          state: m.state,
        })),
      })),
      leaderboard: players.map((p) => ({
        userId: p.userId,
        bladerName: p.bladerName || p.user.name || p.user.username,
        points: p.rankingPoints,
        wins: p.wins,
        losses: p.losses,
        tournamentWins: p.tournamentWins,
        image: p.user.image,
      })),
    });

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "https://rpbey.fr");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");

    return response;
  } catch (error) {
    console.error("External API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
