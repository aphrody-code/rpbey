/**
 * Leaderboard Card Image Generation
 * Genere une card top 10 saisonnier via next/og ImageResponse.
 */

import { ImageResponse } from "next/og";
import { loadGoogleSansFonts } from "@/lib/og/fonts";
import { getActiveSeasonTop10 } from "@/server/dal/gacha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#94a3b8";
}

export async function GET() {
  try {
    const season = await getActiveSeasonTop10();

    if (!season || season.entries.length === 0) {
      return new Response(JSON.stringify({ error: "No leaderboard data" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fonts = await loadGoogleSansFonts();
    const width = 1000;
    const height = 1200;

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(30, 27, 75, 0.85) 0%, rgba(0, 0, 0, 0.95) 100%)",
          fontFamily: "GoogleSans",
          color: "#ffffff",
          padding: "40px 50px",
        }}
      >
        {/* Title */}
        <span
          style={{
            display: "flex",
            alignSelf: "center",
            color: "#FFD700",
            fontWeight: 700,
            fontSize: 56,
          }}
        >
          CLASSEMENT OFFICIEL RPB
        </span>
        <span
          style={{
            display: "flex",
            alignSelf: "center",
            marginTop: 6,
            color: "rgba(255, 255, 255, 0.5)",
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          {season.name}
        </span>

        {/* Entries */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
            gap: 8,
          }}
        >
          {season.entries.map((entry, i) => {
            const rank = i + 1;
            const rc = rankColor(rank);
            const totalGames = entry.wins + entry.losses;
            const wr = totalGames > 0 ? ((entry.wins / totalGames) * 100).toFixed(1) : "0";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: i % 2 === 0 ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0)",
                  borderRadius: 12,
                }}
              >
                {/* Rank circle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: 9999,
                    background: rc,
                    color: "#000000",
                    fontWeight: 700,
                    fontSize: 24,
                    marginRight: 24,
                  }}
                >
                  #{rank}
                </div>

                {/* Name */}
                <span
                  style={{
                    display: "flex",
                    flex: 1,
                    color: rank === 1 ? "#FFD700" : "#ffffff",
                    fontWeight: 700,
                    fontSize: 28,
                  }}
                >
                  {ellipsize((entry.user?.name || "Anonyme").toUpperCase(), 20)}
                </span>

                {/* Points */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    width: 140,
                    marginRight: 24,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      color: rc,
                      fontWeight: 700,
                      fontSize: 30,
                    }}
                  >
                    {entry.points}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    PTS
                  </span>
                </div>

                {/* WR */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    width: 90,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 22,
                    }}
                  >
                    {wr}%
                  </span>
                  <span
                    style={{
                      display: "flex",
                      color: "rgba(255, 255, 255, 0.5)",
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    WR
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignSelf: "center",
            marginTop: "auto",
            color: "rgba(255, 255, 255, 0.3)",
            fontWeight: 500,
            fontSize: 18,
            fontStyle: "italic",
          }}
        >
          rpbey.fr/rankings - Mis à jour en temps réel
        </div>
      </div>,
      {
        width,
        height,
        fonts: fonts.length > 0 ? (fonts as never) : undefined,
        headers: {
          "Content-Disposition": 'inline; filename="classement-rpb.png"',
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  } catch (error) {
    console.error("Error generating leaderboard card:", error);
    return new Response(JSON.stringify({ error: "Failed to generate leaderboard card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
