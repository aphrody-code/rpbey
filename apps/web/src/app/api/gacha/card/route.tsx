/**
 * Gacha Card Image Generation API
 * Genere une card via next/og ImageResponse (Satori). Le rendu est volontairement
 * simplifie par rapport a la version Discord bot (qui reste sous Skia/canvas
 * cote bot) pour respecter les contraintes Satori (flex-only, sous-set CSS).
 *
 * GET /api/gacha/card?id=<cardId>
 * GET /api/gacha/card?slug=<cardSlug>
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { loadGoogleSansFonts } from "@/lib/og/fonts";
import { getGachaCard } from "@/server/dal/gacha";

const ELEMENT_ICONS: Record<string, { emoji: string; color: string }> = {
  FEU: { emoji: "🔥", color: "#ef4444" },
  EAU: { emoji: "💧", color: "#3b82f6" },
  TERRE: { emoji: "🌍", color: "#a16207" },
  VENT: { emoji: "🌪️", color: "#22d3ee" },
  OMBRE: { emoji: "🌑", color: "#7c3aed" },
  LUMIERE: { emoji: "✨", color: "#fbbf24" },
  NEUTRAL: { emoji: "⚪", color: "#9ca3af" },
};

interface RarityTheme {
  borderColor: string;
  bgGradient: [string, string, string];
  accentColor: string;
  label: string;
  stars: number;
}

const RARITY_THEMES: Record<string, RarityTheme> = {
  COMMON: {
    borderColor: "#6b7280",
    bgGradient: ["#1a1f2e", "#141824", "#0d1117"],
    accentColor: "#9ca3af",
    label: "COMMUNE",
    stars: 1,
  },
  RARE: {
    borderColor: "#3b82f6",
    bgGradient: ["#0c2461", "#1e3a5f", "#0a1628"],
    accentColor: "#60a5fa",
    label: "RARE",
    stars: 2,
  },
  SUPER_RARE: {
    borderColor: "#8b5cf6",
    bgGradient: ["#1e0a4a", "#2e1065", "#140530"],
    accentColor: "#a78bfa",
    label: "SUPER RARE",
    stars: 3,
  },
  LEGENDARY: {
    borderColor: "#f59e0b",
    bgGradient: ["#3b1a00", "#422006", "#1a0d00"],
    accentColor: "#fcd34d",
    label: "LÉGENDAIRE",
    stars: 4,
  },
  SECRET: {
    borderColor: "#ef4444",
    bgGradient: ["#3b0a0a", "#450a0a", "#1f0000"],
    accentColor: "#f87171",
    label: "✦ SECRÈTE ✦",
    stars: 5,
  },
};

function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(value / 100, 1) * 100;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flex: 1,
      }}
    >
      <span
        style={{
          display: "flex",
          width: 38,
          color: "rgba(255,255,255,0.5)",
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          flex: 1,
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          marginRight: 8,
          overflow: "hidden",
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
          fontSize: 11,
          width: 26,
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
    const id = searchParams.get("id");
    const slug = searchParams.get("slug");

    if (!id && !slug) {
      return new Response(JSON.stringify({ error: "id or slug param required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = await getGachaCard({ id, slug });

    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fonts = await loadGoogleSansFonts();
    const W = 640;
    const H = 960;
    const theme = RARITY_THEMES[card.rarity] || RARITY_THEMES.COMMON!;
    const elem = card.element ? ELEMENT_ICONS[card.element] : null;
    const stars = "★".repeat(theme.stars) + "☆".repeat(5 - theme.stars);

    // Choix assumé : le rendu image binaire (vignette character) externe complexe
    // (sharp unflatten + clip path) n'est pas portable en Satori 1:1. On pose
    // l'imageUrl directement ; Satori charge les http(s) en src d'<img>. Le rendu
    // décoratif avancé (halo, particules) reste volontairement hors de cette carte OG.

    return new ImageResponse(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: `linear-gradient(160deg, ${theme.bgGradient[0]} 0%, ${theme.bgGradient[1]} 50%, ${theme.bgGradient[2]} 100%)`,
          fontFamily: "GoogleSans",
          color: "#ffffff",
          padding: 24,
          border: `4px solid ${theme.borderColor}`,
          borderRadius: 20,
        }}
      >
        {/* Rarity band */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            background: `${theme.borderColor}cc`,
            borderRadius: 12,
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {theme.label}
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 2,
              color: theme.accentColor,
              fontSize: 14,
            }}
          >
            {stars}
          </span>
        </div>

        {/* Element badge top-right */}
        {elem ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 32,
              right: 36,
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: `${elem.color}55`,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {elem.emoji}
          </div>
        ) : null}

        {/* Character image */}
        <div
          style={{
            display: "flex",
            marginTop: 16,
            width: "100%",
            height: 380,
            borderRadius: 12,
            border: `2px solid ${theme.borderColor}80`,
            background: "rgba(0,0,0,0.5)",
            overflow: "hidden",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              width={W - 60}
              height={380}
              style={{
                objectFit: "cover",
                width: "100%",
                height: "100%",
              }}
            />
          ) : null}
        </div>

        {/* Name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 30,
              textAlign: "center",
            }}
          >
            {ellipsize(card.name, 22)}
          </span>
          {card.nameJp ? (
            <span
              style={{
                display: "flex",
                marginTop: 4,
                color: "rgba(255,255,255,0.35)",
                fontSize: 15,
              }}
            >
              {card.nameJp}
            </span>
          ) : null}
        </div>

        {/* Series badge */}
        <div
          style={{
            display: "flex",
            alignSelf: "center",
            marginTop: 12,
            padding: "4px 14px",
            borderRadius: 11,
            background: `${theme.borderColor}33`,
            color: theme.accentColor,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {card.series.replace(/_/g, " ")}
        </div>

        {/* Beyblade row */}
        {card.beyblade ? (
          <div
            style={{
              display: "flex",
              marginTop: 14,
              padding: "8px 14px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              color: theme.accentColor,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            🌀 {card.beyblade}
          </div>
        ) : null}

        {/* Stats */}
        <div
          style={{
            display: "flex",
            marginTop: 14,
            gap: 12,
          }}
        >
          <StatBar label="ATT" value={card.att} color="#ef4444" />
          <StatBar label="DEF" value={card.def} color="#3b82f6" />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            gap: 12,
          }}
        >
          <StatBar label="END" value={card.end} color="#22d3ee" />
          <StatBar label="ÉQU" value={card.equilibre} color="#22c55e" />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "auto",
            padding: "10px 0",
            color: "rgba(255,255,255,0.4)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          rpbey.fr · RPB Gacha
        </div>
      </div>,
      {
        width: W,
        height: H,
        fonts: fonts.length > 0 ? (fonts as never) : undefined,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      },
    );
  } catch (error) {
    console.error("Gacha card generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
