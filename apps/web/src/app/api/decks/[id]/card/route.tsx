/**
 * Deck Card Image Generation
 * Generates a shareable deck card image using next/og ImageResponse.
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadGoogleSansFonts } from "@/lib/og/fonts";
import { getDeckForCard } from "@/server/dal/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const TYPE_COLORS: Record<string, string> = {
  ATTACK: "#ef4444",
  DEFENSE: "#3b82f6",
  STAMINA: "#22c55e",
  BALANCE: "#a855f7",
};

function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: deckId } = await params;

    const deck = await getDeckForCard(deckId);

    if (!deck) {
      return new Response(JSON.stringify({ error: "Deck not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fonts = await loadGoogleSansFonts();
    const width = 900;
    const height = 680;

    const items = deck.items.slice(0, 3);

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(160deg, #1a0a0a 0%, #0a0a0a 60%, #000000 100%)",
          fontFamily: "GoogleSans",
          color: "#ffffff",
        }}
      >
        {/* Header deck name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 40px 20px 40px",
            borderBottom: "3px solid",
            borderImage: "linear-gradient(90deg, #dc2626 0%, #fbbf24 50%, #dc2626 100%) 1",
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#fbbf24",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: 1,
            }}
          >
            {ellipsize(deck.name.toUpperCase(), 30)}
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 6,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 600,
              fontSize: 18,
            }}
          >
            {deck.user?.name || "Unknown"}
            {deck.isActive ? " · DECK ACTIF" : ""}
          </span>
        </div>

        {/* Bey columns */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "24px 32px",
            gap: 16,
          }}
        >
          {items.map((item, i) => {
            const typeColor = TYPE_COLORS[item.blade?.beyType || ""] || "#888";
            const combo = [item.blade?.name, item.ratchet?.name, item.bit?.name]
              .filter(Boolean)
              .join(" ");
            const stats = [
              {
                label: "ATK",
                value: Number(item.blade?.attack) || 0,
                color: "#ef4444",
              },
              {
                label: "DEF",
                value: Number(item.blade?.defense) || 0,
                color: "#3b82f6",
              },
              {
                label: "STA",
                value: Number(item.blade?.stamina) || 0,
                color: "#22c55e",
              },
            ];

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: 20,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${typeColor}40`,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      background: typeColor,
                      marginRight: 8,
                    }}
                  />
                  <span
                    style={{
                      display: "flex",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {ellipsize(combo, 22)}
                  </span>
                </div>
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        width: 36,
                        color: "rgba(255,255,255,0.5)",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {stat.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flex: 1,
                        height: 10,
                        borderRadius: 5,
                        background: "rgba(255,255,255,0.06)",
                        marginRight: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: `${Math.max(4, (stat.value / 100) * 100)}%`,
                          height: "100%",
                          background: stat.color,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        display: "flex",
                        color: "rgba(255,255,255,0.7)",
                        fontWeight: 700,
                        fontSize: 14,
                        width: 32,
                        justifyContent: "flex-end",
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 32px 20px 32px",
            color: "rgba(255,255,255,0.3)",
            fontWeight: 600,
            fontSize: 16,
            fontStyle: "italic",
          }}
        >
          rpbey.fr/builder
        </div>
      </div>,
      {
        width,
        height,
        fonts: fonts.length > 0 ? (fonts as never) : undefined,
        headers: {
          "Content-Disposition": `inline; filename="${deck.name}-deck.png"`,
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Error generating deck card:", error);
    return new Response(JSON.stringify({ error: "Failed to generate deck card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
