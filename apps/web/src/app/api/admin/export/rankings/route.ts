import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { listGlobalRankings, listSeasonEntries } from "@/server/dal/rankings";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "csv";
  const seasonId = searchParams.get("seasonId");

  // Fetch data
  let data = [];

  if (seasonId && seasonId !== "current") {
    // Historical Data
    const entries = await listSeasonEntries(seasonId);

    data = entries.map((e, i) => ({
      Rank: i + 1,
      Name: e.playerName || e.user?.name || "Unknown",
      Username: e.user?.username || "",
      DiscordId: e.user?.discordId || "",
      Points: e.points,
      Wins: e.wins,
      Losses: e.losses,
      Tournaments: e.tournamentWins,
    }));
  } else {
    // Live Data
    const rankings = await listGlobalRankings();

    data = rankings.map((p, i) => ({
      Rank: i + 1,
      Name: p.playerName || p.user?.name || "Unknown",
      Username: p.user?.username || "",
      DiscordId: p.user?.discordId || "",
      Points: p.points,
      Wins: p.wins,
      Losses: p.losses,
      Tournaments: p.tournamentWins,
    }));
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rankings-${seasonId || "current"}.json"`,
      },
    });
  }

  // CSV Format
  const csvHeaders = [
    "Rank",
    "Name",
    "Username",
    "DiscordId",
    "Points",
    "Wins",
    "Losses",
    "Tournaments",
  ];
  const csvRows = data.map((row) =>
    csvHeaders
      .map((header) => {
        const val = row[header as keyof typeof row];
        if (typeof val === "string") {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(","),
  );

  const csvString = [csvHeaders.join(","), ...csvRows].join("\n");

  return new NextResponse(csvString, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="rankings-${seasonId || "current"}.csv"`,
    },
  });
}
