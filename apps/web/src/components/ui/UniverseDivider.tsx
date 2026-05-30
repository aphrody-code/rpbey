"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * Bande de **transition « changement d'univers »** entre deux sections de la home.
 * On la traverse au scroll : le nom de la prochaine saison surgit en grand (gradient de
 * marque), glisse et se dissout — l'impression de **basculer dans un autre monde** avant
 * que la frame suivante n'apparaisse. Purement décoratif (`aria-hidden`).
 *
 * Piloté par `useScroll` sur la bande elle-même : opacité 0→1→0 et glissement latéral au
 * passage ; coupé en `prefers-reduced-motion` (label statique centré).
 */
export interface UniverseDividerProps {
  /** Nom de l'univers suivant (ex. « Metal Fight »). */
  label: string;
  /** Sous-titre court (année, génération…). */
  sub?: string;
}

export function UniverseDivider({ label, sub }: UniverseDividerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const x = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    reduce ? ["0%", "0%", "0%"] : ["-9%", "0%", "9%"],
  );
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.9, 1.04, 0.9]);
  const opacity = useTransform(scrollYProgress, [0, 0.32, 0.68, 1], [0, 1, 1, 0]);
  // Trait lumineux qui balaie horizontalement.
  const sweep = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-30%", "130%"]);

  return (
    <Box
      ref={ref}
      aria-hidden
      sx={{
        position: "relative",
        height: { xs: "30vh", md: "38vh" },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        bgcolor: "#06060a",
      }}
    >
      {/* Halo de marque */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 50% 50%, rgba(var(--rpb-primary-rgb),0.20), transparent 62%)",
        }}
      />
      {/* Trait lumineux balayant */}
      <Box
        component={m.div}
        style={{ left: sweep }}
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "40%",
          background:
            "linear-gradient(90deg, transparent, rgba(var(--rpb-primary-rgb),0.16), transparent)",
          filter: "blur(8px)",
        }}
      />
      <Box component={m.div} style={{ x, scale, opacity }} sx={{ textAlign: "center", px: 2 }}>
        <Typography
          component="span"
          sx={{
            display: "block",
            mb: 1,
            color: "var(--rpb-text-tertiary, #9aa)",
            letterSpacing: 8,
            textTransform: "uppercase",
            fontSize: { xs: "0.6rem", md: "0.72rem" },
            fontWeight: 800,
          }}
        >
          {"—"} Univers suivant {"—"}
        </Typography>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontSize: { xs: "2.1rem", md: "4.2rem" },
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            backgroundImage:
              "var(--rpb-gradient-ai, linear-gradient(90deg,#dc2626 0%,#fb7185 50%,#fbbf24 100%))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {label}
        </Typography>
        {sub && (
          <Typography
            component="span"
            sx={{
              display: "block",
              mt: 1.5,
              color: "var(--rpb-text-secondary, #bbb)",
              letterSpacing: 5,
              textTransform: "uppercase",
              fontSize: { xs: "0.65rem", md: "0.8rem" },
              fontWeight: 700,
            }}
          >
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
