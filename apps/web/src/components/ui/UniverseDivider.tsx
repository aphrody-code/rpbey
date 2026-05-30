"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/**
 * Bande-CHAPITRE de transition « changement d'univers » entre deux sections de la home,
 * en langage **propagande constructiviste** (République Populaire du Beyblade) : chiffre
 * romain géant fantôme, barre rouge en biais qui balaie au scroll, nom de la saison en
 * display condensé. On la traverse → on bascule dans un autre monde. `aria-hidden`.
 *
 * Le wipe rouge + le glissement sont pilotés par `useScroll` ; coupés en
 * `prefers-reduced-motion`. La police display est héritée via `var(--rpb-display)`.
 */
export interface UniverseDividerProps {
  /** Numéro de chapitre romain (ex. « II »). */
  chapter: string;
  /** Nom de l'univers suivant (ex. « Metal Fight »). */
  label: string;
  /** Sous-titre court (génération, année…). */
  sub?: string;
}

export function UniverseDivider({ chapter, label, sub }: UniverseDividerProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // Barre rouge diagonale qui balaie l'écran au passage.
  const wipeX = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? ["-40%", "-40%"] : ["-120%", "120%"],
  );
  const labelX = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    reduce ? ["0%", "0%", "0%"] : ["-7%", "0%", "7%"],
  );
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const ghostScale = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    reduce ? [1, 1, 1] : [1.25, 1, 1.25],
  );

  return (
    <Box
      ref={ref}
      aria-hidden
      sx={{
        position: "relative",
        height: { xs: "32vh", md: "40vh" },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        bgcolor: "#08070b",
        // liserés rouges haut/bas (raccord de section)
        borderTop: "2px solid rgba(var(--rpb-primary-rgb),0.55)",
        borderBottom: "2px solid rgba(var(--rpb-primary-rgb),0.55)",
      }}
    >
      {/* Chiffre romain géant fantôme */}
      <Box
        component={m.div}
        aria-hidden
        style={{ scale: ghostScale }}
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--rpb-display, inherit)",
          fontWeight: 900,
          fontSize: { xs: "16rem", md: "30rem" },
          lineHeight: 1,
          color: "transparent",
          WebkitTextStroke: "2px rgba(var(--rpb-primary-rgb),0.16)",
          userSelect: "none",
        }}
      >
        {chapter}
      </Box>

      {/* Wipe rouge diagonal */}
      <Box
        component={m.div}
        style={{ x: wipeX }}
        sx={{
          position: "absolute",
          top: "-20%",
          bottom: "-20%",
          width: "55%",
          background:
            "linear-gradient(100deg, transparent, rgba(var(--rpb-primary-rgb),0.30) 45%, rgba(var(--rpb-primary-rgb),0.30) 55%, transparent)",
          transform: "skewX(-12deg)",
          filter: "blur(2px)",
        }}
      />

      {/* Texte chapitre */}
      <Box
        component={m.div}
        style={{ x: labelX, opacity }}
        sx={{ position: "relative", textAlign: "center", px: 2 }}
      >
        <Typography
          component="span"
          sx={{
            display: "block",
            mb: { xs: 0.5, md: 1 },
            color: "rgba(var(--rpb-primary-rgb),1)",
            letterSpacing: "0.5em",
            textTransform: "uppercase",
            fontWeight: 800,
            fontSize: { xs: "0.66rem", md: "0.8rem" },
            pl: "0.5em",
          }}
        >
          Chapitre {chapter}
        </Typography>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontFamily: "var(--rpb-display, inherit)",
            fontSize: { xs: "2.6rem", md: "5.4rem" },
            fontWeight: 900,
            lineHeight: 0.86,
            letterSpacing: { xs: "0.01em", md: "0.005em" },
            textTransform: "uppercase",
            color: "#f5f0e6",
            textShadow: "0 6px 40px rgba(0,0,0,0.6)",
          }}
        >
          {label}
        </Typography>
        {sub && (
          <Typography
            component="span"
            sx={{
              display: "block",
              mt: { xs: 1, md: 1.5 },
              color: "rgba(245,240,230,0.62)",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              fontWeight: 700,
              fontSize: { xs: "0.6rem", md: "0.72rem" },
              pl: "0.42em",
            }}
          >
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
