"use client";

import { AutoAwesome } from "@mui/icons-material";
import { Box, Tab, Tabs } from "@mui/material";
import type { SearchCategory } from "@rpbey/api-contract";
import { ACCENT, BG_DEEP, BORDER, GRADIENT_AI, ON_GRADIENT, TEXT_SECONDARY } from "./tokens";

// Mapping onglets → SearchCategory (null = "Tous", "ai" = vue synthese)
const TABS: { label: string; value: SearchCategory | "all" | "ai" }[] = [
  { label: "Mode IA", value: "ai" },
  { label: "Tous", value: "all" },
  { label: "Boutiques", value: "product" },
  { label: "Pieces", value: "part" },
  { label: "Tournois", value: "tournament" },
  { label: "Bladers", value: "blader" },
  { label: "Lexique", value: "lexicon" },
];

interface SerpTabsProps {
  active: SearchCategory | "all" | "ai";
  onChange: (v: SearchCategory | "all" | "ai") => void;
}

export function SerpTabs({ active, onChange }: SerpTabsProps) {
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
        {TABS.map((t) => (
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
              ) : (
                t.label
              )
            }
          />
        ))}
      </Tabs>
    </Box>
  );
}
