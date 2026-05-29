"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

export interface AnalyticsSummary {
  liveVisitors: number;
  pageviewsToday: number;
  pageviews7d: number;
  eventsToday: number;
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; count: number }[];
  recentEvents: {
    id: string;
    type: string;
    path: string | null;
    userId: string | null;
    createdAt: string;
  }[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<AnalyticsSummary>;
  });

/**
 * Real-time admin analytics. Opens the SSE stream
 * (`/api/admin/analytics/stream`) for push updates and uses SWR polling on
 * `/api/admin/analytics` as a fallback (and to seed the very first render).
 *
 * @param initial server-rendered snapshot for instant first paint.
 */
export function useAnalyticsStream(initial: AnalyticsSummary) {
  const [data, setData] = useState<AnalyticsSummary>(initial);
  const [live, setLive] = useState(false);
  const sseOk = useRef(false);

  // SWR fallback: only polls actively while SSE is not connected.
  const { data: polled } = useSWR<AnalyticsSummary>("/api/admin/analytics", fetcher, {
    fallbackData: initial,
    refreshInterval: live ? 0 : 15_000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (polled && !sseOk.current) setData(polled);
  }, [polled]);

  useEffect(() => {
    const es = new EventSource("/api/admin/analytics/stream");

    es.onopen = () => {
      sseOk.current = true;
      setLive(true);
    };

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as AnalyticsSummary;
        sseOk.current = true;
        setLive(true);
        setData(parsed);
      } catch {
        /* skip malformed frames */
      }
    };

    es.onerror = () => {
      sseOk.current = false;
      setLive(false);
      // EventSource auto-reconnects; SWR fallback resumes meanwhile.
    };

    return () => {
      es.close();
      sseOk.current = false;
      setLive(false);
    };
  }, []);

  return { data, live };
}
