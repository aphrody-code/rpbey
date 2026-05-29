"use client";

import { useEffect, useRef, useState } from "react";

import type { Config, ViewerData } from "@/lib/brackets/types";

const SCRIPT_URL = "/vendor/brackets/brackets-viewer.min.js";
const STYLE_URL = "/vendor/brackets/brackets-viewer.min.css";
const SCRIPT_ID = "rpbey-brackets-viewer-script";
const STYLE_ID = "rpbey-brackets-viewer-style";

type WindowWithViewer = Window & {
  bracketsViewer?: {
    render: (data: ViewerData, config?: Partial<Config>) => Promise<void>;
  };
};

let scriptLoadPromise: Promise<void> | null = null;

function loadScriptOnce(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as WindowWithViewer;
  if (w.bracketsViewer) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    if (!document.getElementById(STYLE_ID)) {
      const link = document.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      document.head.appendChild(link);
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script load failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = (): void => resolve();
    script.onerror = (): void => reject(new Error(`failed to load ${SCRIPT_URL}`));
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Hook bas-niveau pour piloter `window.bracketsViewer` directement.
 * Retourne une `ref` a attacher sur un container et un `render(data, config)` async.
 *
 * Usage avance : si tu veux multi-render dans un meme container ou hooker des
 * events DOM custom (mutation observer, intersection, etc.), prefere ce hook
 * au composant `<BracketsViewer>` qui encapsule deja tout.
 */
export function useBracketsViewer(): {
  ref: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  error: Error | null;
  render: (data: ViewerData, config?: Partial<Config>) => Promise<void>;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScriptOnce()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const render = async (data: ViewerData, config?: Partial<Config>): Promise<void> => {
    if (!ref.current) throw new Error("ref not attached");
    const container = ref.current;
    container.classList.add("brackets-viewer");
    const w = window as WindowWithViewer;
    const viewer = w.bracketsViewer;
    if (!viewer) throw new Error("viewer script not loaded");
    container.innerHTML = "";
    await viewer.render(data, {
      selector: `#${container.id || (container.id = `bv-${Math.random().toString(36).slice(2, 9)}`)}`,
      clear: true,
      ...config,
    });
  };

  return { ref, ready, error, render };
}
