/**
 * RPB - Profile Card Image Generation
 * Genere une card profil utilisateur via next/og ImageResponse.
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadInterFonts } from "@/lib/og/fonts";
import { getUserStats, userExists } from "@/server/dal/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 400;

function getRankTitle(elo: number): string {
  if (elo >= 1500) return "Champion";
  if (elo >= 1300) return "Expert";
  if (elo >= 1150) return "Confirmé";
  if (elo >= 1000) return "Intermédiaire";
  return "Débutant";
}

function getRankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#6B7280";
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params;

    const user = await userExists(userId);

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stats = await getUserStats(userId);
    if (!stats) {
      return new Response(JSON.stringify({ error: "Stats not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fonts = await loadInterFonts();
    const bladerName = stats.bladerName || user.name || "?";
    const initial = (bladerName?.charAt(0) || "?").toUpperCase();
    const rankColor = getRankColor(stats.rank);
    const recentForm = stats.recentForm.slice(0, 10);

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
          fontFamily: "Inter",
          color: "#ffffff",
          padding: 40,
        }}
      >
        {/* Avatar column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 160,
            marginRight: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 128,
              height: 128,
              borderRadius: 9999,
              background: "#2a2a4a",
              border: `4px solid ${rankColor}`,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 56,
            }}
          >
            {initial}
          </div>
        </div>

        {/* Info column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          {/* Header line */}
          <span
            style={{
              display: "flex",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 36,
            }}
          >
            {bladerName}
          </span>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              gap: 16,
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                color: rankColor,
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              #{stats.rank}
            </span>
            <span
              style={{
                display: "flex",
                color: "#dc2626",
                fontWeight: 600,
                fontSize: 18,
              }}
            >
              {getRankTitle(stats.elo)}
            </span>
            <span
              style={{
                display: "flex",
                color: "#fbbf24",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {stats.elo} ELO
            </span>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              marginTop: 32,
              gap: 32,
            }}
          >
            {[
              {
                label: "Matchs",
                value: `${stats.wins}V - ${stats.losses}D`,
                color: "#ffffff",
              },
              {
                label: "Taux de victoire",
                value: `${stats.winRate.toFixed(1)}%`,
                color: stats.winRate >= 50 ? "#22c55e" : "#ef4444",
              },
              {
                label: "Tournois gagnés",
                value: `${stats.tournamentsWon}`,
                color: "#fbbf24",
              },
              {
                label: "Série",
                value: `${stats.currentStreak}🔥`,
                color: stats.currentStreak > 0 ? "#22c55e" : "#9ca3af",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    color: "#9ca3af",
                    fontWeight: 500,
                    fontSize: 14,
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    display: "flex",
                    marginTop: 6,
                    color: s.color,
                    fontWeight: 800,
                    fontSize: 26,
                  }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {/* Recent form */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 24,
            }}
          >
            <span
              style={{
                display: "flex",
                color: "#9ca3af",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              Forme récente
            </span>
            <div
              style={{
                display: "flex",
                marginTop: 8,
                gap: 6,
              }}
            >
              {recentForm.map((result, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    background: result === "W" ? "#22c55e" : "#ef4444",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {result}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 16,
            right: 24,
            color: "#6b7280",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          République Populaire du Beyblade • rpbey.fr
        </div>
      </div>,
      {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: fonts.length > 0 ? (fonts as never) : undefined,
        headers: {
          "Content-Disposition": `inline; filename="${bladerName}-card.png"`,
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Error generating profile card:", error);
    return new Response(JSON.stringify({ error: "Failed to generate card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
