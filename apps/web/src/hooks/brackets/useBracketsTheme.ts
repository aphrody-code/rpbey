"use client";

import { useCallback, useEffect, useState } from "react";

import type { BracketsTheme } from "@/lib/brackets/types";

const STORAGE_KEY = "rpbey:brackets:theme";

function read(): BracketsTheme {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "auto") return v;
  return "auto";
}

/**
 * Persistent theme toggle pour `<BracketsViewer>` (light / dark / auto).
 * Stocke dans `localStorage` sous la cle `rpbey:brackets:theme`.
 *
 * @example
 *   const { theme, setTheme } = useBracketsTheme();
 *   <BracketsViewer theme={theme} data={data} />
 *   <BracketsThemeSwitch value={theme} onChange={setTheme} />
 */
export function useBracketsTheme(initial: BracketsTheme = "auto"): {
  theme: BracketsTheme;
  setTheme: (next: BracketsTheme) => void;
} {
  const [theme, setThemeState] = useState<BracketsTheme>(initial);

  useEffect(() => {
    setThemeState(read());
  }, []);

  const setTheme = useCallback((next: BracketsTheme) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { theme, setTheme };
}
