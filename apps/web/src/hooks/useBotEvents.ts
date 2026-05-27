'use client';

import { useEffect, useRef, useState } from 'react';

export type BotTopic = 'logs' | 'bot-events' | 'discord-events';

export interface BotEvent {
  topic: string;
  data: unknown;
  ts?: number;
}

interface Options {
  /** Topics to subscribe to. Default: all three. */
  topics?: BotTopic[];
  /** Max items to keep in memory. Default 200. */
  bufferSize?: number;
  /** Called for every event, regardless of topic. */
  onEvent?: (event: BotEvent) => void;
}

/**
 * Subscribe to real-time bot events via the /api/bot/events SSE bridge.
 *
 * ```tsx
 * const { events, connected } = useBotEvents({ topics: ['bot-events'] });
 * ```
 */
export function useBotEvents(options: Options = {}) {
  const topics = options.topics ?? ['logs', 'bot-events', 'discord-events'];
  const bufferSize = options.bufferSize ?? 200;
  const onEventRef = useRef(options.onEvent);
  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  const [events, setEvents] = useState<BotEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = `/api/bot/events?topics=${topics.join(',')}`;
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);

    es.onmessage = (msgEvent) => {
      try {
        const parsed = JSON.parse(msgEvent.data) as BotEvent;
        onEventRef.current?.(parsed);
        setEvents((prev) => {
          const next = [...prev, parsed];
          return next.length > bufferSize ? next.slice(-bufferSize) : next;
        });
      } catch {
        /* skip malformed frames */
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects; nothing to do here besides reflecting state.
    };

    return () => {
      es.close();
      setConnected(false);
    };
     
  }, [bufferSize, topics.join]);

  return { events, connected };
}
