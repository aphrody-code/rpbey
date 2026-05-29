"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Lightweight client pageview tracker.
 *
 * Sends a `pageview` beacon on every navigation (App Router pathname change).
 * Uses navigator.sendBeacon when available (survives unload, non-blocking) and
 * falls back to fetch(keepalive). Never throws, never logs noisily, never
 * blocks rendering. No IP is sent from the client; the server derives an
 * anonymous, daily-rotating session id.
 */
function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const full = qs ? `${pathname}?${qs}` : pathname;
    // Dedupe identical consecutive sends (e.g. effect re-fires).
    if (lastSent.current === full) return;
    lastSent.current = full;

    const payload = JSON.stringify({
      type: "pageview",
      path: full,
      referrer: document.referrer || null,
    });

    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/analytics", blob);
      } else {
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* tracking must never break the app */
    }
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsTracker() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
