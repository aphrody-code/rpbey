'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LiveData } from './types';

const POLL_MS = 30_000;

export function useLiveTournament(
  tournamentId: string,
  initialData: LiveData,
  isLive: boolean,
) {
  const [liveData, setLiveData] = useState<LiveData>(initialData);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/live`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) setLiveData(json.data);
      }
    } catch {
      // silent
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(fetchLive, POLL_MS);
    return () => clearInterval(id);
  }, [isLive, fetchLive]);

  return { liveData, refresh: fetchLive };
}
