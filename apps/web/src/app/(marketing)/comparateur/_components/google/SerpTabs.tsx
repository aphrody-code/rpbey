"use client";

import { AutoAwesome } from "@mui/icons-material";
import { Box, Tab, Tabs } from "@mui/material";
import type { SearchCategory } from "@rpbey/api-contract";
import { ACCENT, BG_DEEP, BORDER, GRADIENT_AI, ON_GRADIENT, TEXT_SECONDARY } from "./tokens";

// Mapping onglets → SearchCategory ("all" = Tous, "ai" = vue synthese)
const TABS: { label: string; value: SearchCategory | "all" | "ai" }[] = [
  { label: "Mode IA", value: "ai" },
  { label: "Tous", value: "all" },
  { label: "Beys", value: "product" },
  { label: "Parts", value: "part" },
  { label: "Combos", value: "combo" },
  { label: "Tournois", value: "tournament" },
  { label: "Bladers", value: "blader" },
  { label: "Anime", value: "anime" },
  { label: "Lexique", value: "lexicon" },
  { label: "Sites", value: "site" },
  { label: "Pages", value: "page" },
];

interface SerpTabsProps {
  active: SearchCategory | "all" | "ai";
  onChange: (v: SearchCategory | "all" | "ai") => void;
  /** Compteurs par catégorie (facettes) — masque les onglets vides (hors Mode IA/Tous). */
  facets?: Record<string, number>;
}

export function SerpTabs({ active, onChange, facets }: SerpTabsProps) {
  const visible = TABS.filter(
    (t) => t.value === "ai" || t.value === "all" || !facets || (facets[t.value] ?? 0) > 0,
  );
  return (
    <Box
      sx={{
        bgcolor: BG_DEEP,
        borderBottom: "1px solid",
        borderColor: BORDER,
        px: { xs: 1, sm: 2 },
      }}
    >
      <Tabs
        value={active}
        onChange={(_, v) => onChange(v as SearchCategory | "all" | "ai")}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 44,
          "& .MuiTabs-indicator": {
            background: ACCENT,
            height: 3,
            borderRadius: "3px 3px 0 0",
          },
          "& .MuiTab-root": {
            minHeight: 44,
            fontSize: "0.875rem",
            fontWeight: 400,
            color: TEXT_SECONDARY,
            textTransform: "none",
            px: 1.5,
            py: 0,
            minWidth: "unset",
            "&.Mui-selected": {
              color: "text.primary",
              fontWeight: 500,
            },
          },
        }}
      >
        {visible.map((t) => {
          const count = facets?.[t.value];
          const showCount = t.value !== "ai" && t.value !== "all" && count != null;
          return (
            <Tab
              key={t.value}
              value={t.value}
              label={
                t.value === "ai" ? (
                  // Onglet Mode IA avec icone sparkle gradient
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        background: GRADIENT_AI,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <AutoAwesome sx={{ fontSize: 10, color: ON_GRADIENT }} />
                    </Box>
                    {t.label}
                  </Box>
                ) : showCount ? (
                  `${t.label} (${count})`
                ) : (
                  t.label
                )
              }
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
