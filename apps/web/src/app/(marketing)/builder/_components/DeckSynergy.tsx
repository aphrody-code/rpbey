"use client";

import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useMemo } from "react";
import { combinedComboScore, lookupTier, TIER_COLOR, type Tier } from "@/lib/beyblade-entity";
import type { Part } from "@/lib/types";
import { type BeySlot, useBuilder } from "./BuilderContext";

/**
 * Mètre de synergie méta temps réel du deck en construction. 100 % client et pur :
 * s'appuie sur la table de tier canonique (`@/lib/beyblade-entity`) — aucune requête
 * réseau, recalcul instantané à chaque changement de pièce. Donne au builder un
 * retour « ce combo est-il méta ? » sans dépendre du serveur ni des combos enrichis.
 *
 * Score par pièce : tier connu → S 100 / A 82 / B 62 / C 42 ; pièce présente mais
 * non répertoriée → 50 (neutre). Score d'un bey = `combinedComboScore` (la blade
 * porte le combo) ; synergie du deck = moyenne des beys ayant au moins une blade.
 */

const TIER_TO_SCORE: Record<Tier, number> = { S: 100, A: 82, B: 62, C: 42 };

function partScore(part: Part | null, type: "BLADE" | "RATCHET" | "BIT"): number | null {
  if (!part) return null;
  const t = lookupTier(part.name, type);
  return t ? TIER_TO_SCORE[t] : 50;
}

function beyScore(slot: BeySlot): number | null {
  if (!slot.blade) return null;
  const s = combinedComboScore(
    partScore(slot.blade, "BLADE"),
    partScore(slot.ratchet, "RATCHET"),
    partScore(slot.bit, "BIT"),
  );
  return s > 0 ? s : null;
}

function scoreTier(score: number): Tier {
  if (score >= 88) return "S";
  if (score >= 74) return "A";
  if (score >= 56) return "B";
  return "C";
}

export function DeckSynergy() {
  const { state } = useBuilder();

  const { deckScore, perBey, tier } = useMemo(() => {
    const perBey = state.beys.map(beyScore);
    const present = perBey.filter((s): s is number => s != null);
    const deckScore = present.length
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : null;
    return { deckScore, perBey, tier: deckScore != null ? scoreTier(deckScore) : null };
  }, [state.beys]);

  if (deckScore == null || tier == null) return null;
  const color = TIER_COLOR[tier];

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "var(--mui-palette-surface-high, rgba(255,255,255,0.02))",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          sx={{
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            fontWeight: 900,
            color: "text.secondary",
          }}
        >
          Synergie méta du deck
        </Typography>
        <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color }}>{tier}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: "text.secondary" }}>
            {deckScore}/100
          </Typography>
        </Stack>
      </Stack>

      {/* Barre de synergie + repères de seuils de tier (B 56 · A 74 · S 88) */}
      <Box
        sx={{
          position: "relative",
          height: 10,
          borderRadius: 5,
          bgcolor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            insetBlock: 0,
            left: 0,
            width: `${deckScore}%`,
            borderRadius: 5,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 50%, transparent), ${color})`,
            boxShadow: `0 0 12px color-mix(in srgb, ${color} 55%, transparent)`,
            transition: "width 0.45s cubic-bezier(0.34,1.4,0.64,1)",
          }}
        />
        {[56, 74, 88].map((t) => (
          <Box
            key={t}
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${t}%`,
              width: "1px",
              bgcolor: "rgba(255,255,255,0.22)",
            }}
          />
        ))}
      </Box>

      {/* Score par bey */}
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        {perBey.map((s, i) => (
          <Tooltip key={i} title={s == null ? "Bey incomplet" : `Bey ${i + 1} : ${s}/100`} arrow>
            <Box
              sx={{
                flex: 1,
                textAlign: "center",
                py: 0.5,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.03)",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", fontWeight: 700 }}>
                Bey {i + 1}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  color: s == null ? "text.disabled" : TIER_COLOR[scoreTier(s)],
                }}
              >
                {s == null ? "—" : s}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}
