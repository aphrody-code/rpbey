/**
 * Combo Card Image Generation
 * Genere une card combo Beyblade depuis query params via next/og.
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadGoogleSansFonts } from "@/lib/og/fonts";
import { getComboParts } from "@/server/dal/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  ATTACK: "#ef4444",
  DEFENSE: "#3b82f6",
  STAMINA: "#22c55e",
  BALANCE: "#a855f7",
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min((value / 100) * 100, 100);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginTop: 8,
      }}
    >
      <span
        style={{
          display: "flex",
          width: 130,
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 18,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          flex: 1,
          height: 18,
          borderRadius: 9,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
          marginRight: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${pct}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
      <span
        style={{
          display: "flex",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 18,
          width: 40,
          justifyContent: "flex-end",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const bladeId = searchParams.get("blade");
    const ratchetId = searchParams.get("ratchet");
    const bitId = searchParams.get("bit");

    if (!bladeId || !ratchetId || !bitId) {
      return new Response(JSON.stringify({ error: "blade, ratchet, and bit params required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { blade, ratchet, bit } = await getComboParts(bladeId, ratchetId, bitId);

    if (!blade || !ratchet || !bit) {
      return new Response(JSON.stringify({ error: "Parts not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fonts = await loadGoogleSansFonts();
    const comboName = `${blade.name} ${ratchet.name} ${bit.name}`;
    const beyType = blade.beyType || "BALANCE";
    const hexColor = TYPE_COLORS[beyType] || "#a855f7";
    const totalWeight = (blade.weight || 0) + (ratchet.weight || 0) + (bit.weight || 0);

    const width = 800;
    const height = 550;

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#000000",
          border: `15px solid ${hexColor}`,
          fontFamily: "GoogleSans",
          color: "#ffffff",
          padding: "32px 40px",
        }}
      >
        {/* Combo name */}
        <span
          style={{
            display: "flex",
            alignSelf: "center",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 44,
            textAlign: "center",
          }}
        >
          {comboName.toUpperCase()}
        </span>

        {/* Type badge */}
        <div
          style={{
            display: "flex",
            alignSelf: "center",
            marginTop: 12,
            padding: "8px 32px",
            background: hexColor,
            borderRadius: 20,
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          {beyType.toUpperCase()}
        </div>

        {/* Parts list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 28,
          }}
        >
          {[
            { label: "BLADE", value: blade.name },
            { label: "RATCHET", value: ratchet.name },
            { label: "BIT", value: bit.name },
          ].map((p) => (
            <div
              key={p.label}
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <span
                style={{
                  display: "flex",
                  width: 130,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: 600,
                  fontSize: 22,
                  justifyContent: "flex-end",
                  marginRight: 16,
                }}
              >
                {p.label}
              </span>
              <span
                style={{
                  display: "flex",
                  color: "#fbbf24",
                  fontWeight: 700,
                  fontSize: 28,
                }}
              >
                {p.value}
              </span>
            </div>
          ))}
          {totalWeight > 0 ? (
            <span
              style={{
                display: "flex",
                alignSelf: "center",
                marginTop: 14,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 26,
              }}
            >
              {totalWeight.toFixed(1)}g
            </span>
          ) : null}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 16,
          }}
        >
          <StatBar label="ATTAQUE" value={Number(blade.attack) || 0} color="#ef4444" />
          <StatBar label="DÉFENSE" value={Number(blade.defense) || 0} color="#3b82f6" />
          <StatBar label="ENDURANCE" value={Number(blade.stamina) || 0} color="#22c55e" />
          <StatBar label="DASH" value={Number(blade.dash) || 0} color="#eab308" />
        </div>
      </div>,
      {
        width,
        height,
        fonts: fonts.length > 0 ? (fonts as never) : undefined,
        headers: {
          "Content-Disposition": `inline; filename="${comboName}.png"`,
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Error generating combo card:", error);
    return new Response(JSON.stringify({ error: "Failed to generate combo card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
