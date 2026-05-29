"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import type { GlobalSearchItem, RecommendedProduct } from "@rpbey/api-contract";
import { GoogleSearchField } from "./GoogleSearchField";
import { GoogleTopBar } from "./GoogleTopBar";
import { GRADIENT_WORDMARK, TEXT_TERTIARY } from "./tokens";

interface GoogleHomeProps {
  suggestions: GlobalSearchItem[];
  query: string;
  aiMode: boolean;
  topReco: RecommendedProduct | null;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onToggleAi: () => void;
  onLucky: () => void;
}

export function GoogleHome({
  suggestions,
  query,
  aiMode,
  topReco,
  onChange,
  onSubmit,
  onToggleAi,
  onLucky,
}: GoogleHomeProps) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <GoogleTopBar compact={false} />

      {/* Zone centrale verticalement centree */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          pb: 12,
        }}
      >
        {/* Wordmark */}
        <Typography
          component="h1"
          sx={{
            fontWeight: 900,
            fontSize: { xs: "3rem", sm: "4.5rem", md: "5.5rem" },
            lineHeight: 1,
            letterSpacing: "-0.04em",
            mb: 1.5,
            background: GRADIENT_WORDMARK,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            userSelect: "none",
          }}
        >
          RPB
        </Typography>

        {/* Tagline : ce moteur couvre tout l'univers Beyblade, pas juste le comparateur */}
        <Typography
          sx={{
            fontSize: { xs: "0.95rem", sm: "1.2rem" },
            fontWeight: 600,
            color: "text.secondary",
            mb: 4,
            textAlign: "center",
            letterSpacing: "-0.01em",
            maxWidth: 620,
          }}
        >
          Le moteur de recherche Beyblade — beys, parts, combos, tournois, bladers, anime & lexique
        </Typography>

        {/* Greeting contextuel */}
        {aiMode && (
          <Typography
            sx={{
              fontSize: { xs: "1.4rem", sm: "2rem" },
              fontWeight: 600,
              color: "text.primary",
              mb: 3,
              textAlign: "center",
            }}
          >
            Salut. Que cherches-tu dans l&apos;univers Beyblade ?
          </Typography>
        )}

        {/* Barre de recherche */}
        <GoogleSearchField
          value={query}
          suggestions={suggestions}
          aiMode={aiMode}
          onChange={onChange}
          onSubmit={onSubmit}
          onToggleAi={onToggleAi}
        />

        {/* Boutons Rechercher / Chance */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            disableElevation
            onClick={() => onSubmit(query)}
            sx={{
              bgcolor: "var(--rpb-surface-high, #3c4043)",
              color: "text.primary",
              fontWeight: 500,
              fontSize: "0.875rem",
              textTransform: "none",
              borderRadius: 1,
              px: 2,
              py: 0.75,
              "&:hover": { bgcolor: "var(--rpb-surface-highest, #4a4d51)" },
            }}
          >
            Rechercher
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={onLucky}
            disabled={!topReco}
            title={topReco ? `Meilleure reco : ${topReco.name}` : "Calcul en cours..."}
            sx={{
              bgcolor: "var(--rpb-surface-high, #3c4043)",
              color: "text.primary",
              fontWeight: 500,
              fontSize: "0.875rem",
              textTransform: "none",
              borderRadius: 1,
              px: 2,
              py: 0.75,
              "&:hover": { bgcolor: "var(--rpb-surface-highest, #4a4d51)" },
            }}
          >
            J&apos;ai de la chance
          </Button>
        </Stack>

        {/* Sous-texte (style Google) */}
        <Typography sx={{ mt: 3, fontSize: "0.8rem", color: TEXT_TERTIARY }}>
          Recherche Beyblade — toutes générations (Bakuten, Metal, Burst, X) · français
        </Typography>
      </Box>
    </Box>
  );
}
