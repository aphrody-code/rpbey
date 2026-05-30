"use client";

import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton } from "@mui/material";
import dynamic from "next/dynamic";
import { useState } from "react";

/**
 * Launcher flottant du chat « Rpbey » (présent sur toutes les pages marketing, donc
 * sur /search). Un FAB à anneau gradient (sparkle) ouvre un Drawer latéral contenant
 * le chat. `RpbeyChat` est chargé en `next/dynamic` (ssr:false) UNIQUEMENT à l'ouverture
 * → zéro poids sur le bundle initial. Coexiste avec la nav mobile (offset bas).
 */

const RpbeyChat = dynamic(() => import("@/components/chat/RpbeyChat").then((m) => m.RpbeyChat), {
  ssr: false,
});

function SparkleIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <radialGradient id="rpb-fab-grad" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="40%" stopColor="#9168C0" />
          <stop offset="75%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#FBBC04" />
        </radialGradient>
      </defs>
      <path
        d="M12 0 C12 6 6 6 0 12 C6 12 12 12 12 24 C12 12 18 12 24 12 C18 12 12 12 12 0 Z"
        fill="url(#rpb-fab-grad)"
      />
    </svg>
  );
}

export function RpbeyChatLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB */}
      <Box
        component="button"
        aria-label="Demander à Rpbey"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          right: { xs: 16, md: 24 },
          bottom: { xs: "calc(80px + env(safe-area-inset-bottom))", md: 24 },
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          gap: 1,
          height: 56,
          px: { xs: 0, md: 2.25 },
          width: { xs: 56, md: "auto" },
          justifyContent: "center",
          cursor: "pointer",
          borderRadius: "28px",
          color: "var(--rpb-text)",
          bgcolor: "var(--rpb-surface-high)",
          border: "1.5px solid transparent",
          background:
            "linear-gradient(var(--rpb-surface-high),var(--rpb-surface-high)) padding-box, var(--rpb-gradient-ai) border-box",
          boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
          transition: "transform 200ms cubic-bezier(0.05,0.7,0.1,1), box-shadow 200ms",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 16px 36px -12px rgba(var(--rpb-primary-rgb),0.5)",
          },
        }}
      >
        <SparkleIcon size={26} />
        <Box
          component="span"
          sx={{ display: { xs: "none", md: "block" }, fontWeight: 700, fontSize: 14.5 }}
        >
          Demander à Rpbey
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100%", sm: 440 },
              maxWidth: "100%",
              bgcolor: "var(--rpb-bg)",
              backgroundImage: "none",
              borderLeft: "1px solid var(--rpb-divider)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 1.5,
              borderBottom: "1px solid var(--rpb-divider)",
            }}
          >
            <SparkleIcon size={24} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>Rpbey</Box>
              <Box sx={{ fontSize: 11.5, color: "var(--rpb-text-secondary)" }}>
                L'expert omniscient du Beyblade
              </Box>
            </Box>
            <IconButton
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              sx={{ color: "var(--rpb-text-secondary)" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {/* Chat */}
          <Box sx={{ flex: 1, minHeight: 0 }}>{open && <RpbeyChat height="100%" />}</Box>
        </Box>
      </Drawer>
    </>
  );
}
