"use client";

import { useEffect } from "react";
import { useThemeMode } from "@/components/theme/ThemeRegistry";

/**
 * Quand monté, passe le thème global en "blue" (logo header/sidebar bascule
 * sur `/stardust-logo.webp`, variables CSS --rpb-primary deviennent bleues).
 * Ne revient PAS en "red" au démontage — laisse l'utilisateur choisir.
 * (Pattern identique à TournamentDetail pour les tournois STARDUST.)
 */
export function StardustThemeSync() {
  const { mode, setTheme } = useThemeMode();

  useEffect(() => {
    if (mode !== "blue") {
      setTheme("blue");
    }
  }, [mode, setTheme]);

  return null;
}
