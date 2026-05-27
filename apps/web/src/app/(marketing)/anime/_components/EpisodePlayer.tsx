'use client';

import { Box } from '@mui/material';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { useCallback, useEffect, useRef } from 'react';
import { YouTubePlayer } from './YouTubePlayer';

interface EpisodePlayerProps {
  title: string;
  src: string;
  sourceType: string;
  savedProgress?: number;
  episodeId: string;
  duration?: number;
  startTime?: number;
  onEnded?: () => void;
}

/** Sources that must be rendered as an iframe (not via Vidstack) */
const IFRAME_HOSTS = [
  'sibnet.ru',
  'vidmoly.net',
  'vk.com',
  'dailymotion.com',
  'ok.ru',
  'mail.ru',
  'myvi.ru',
  'sendvid.com',
];

function isIframeSource(src: string, sourceType: string): boolean {
  if (sourceType === 'IFRAME' || sourceType === 'DAILYMOTION') return true;
  return IFRAME_HOSTS.some((host) => src.includes(host));
}

function isYouTubeSource(src: string, sourceType: string): boolean {
  if (sourceType === 'YOUTUBE') return true;
  return (
    src.includes('youtube.com') ||
    src.includes('youtu.be') ||
    src.startsWith('youtube/')
  );
}

/** Extract YouTube video ID from any src format */
/** Extract YouTube video ID from any src format */
function extractYouTubeId(src: string): string {
  if (src.startsWith('youtube/')) {
    return src.replace('youtube/', '');
  }
  const match = src.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
  );
  return match?.[1] ?? src;
}

/** Append start time to iframe URL based on host */
function applyStartTime(src: string, startTime: number): string {
  if (startTime <= 0) return src;
  const sep = src.includes('?') ? '&' : '?';
  if (src.includes('sibnet.ru')) return `${src}${sep}t=${startTime}`;
  if (src.includes('vk.com')) return `${src}${sep}t=${startTime}s`;
  if (src.includes('dailymotion.com')) return `${src}${sep}start=${startTime}`;
  if (src.includes('vidmoly.net')) return `${src}${sep}start=${startTime}`;
  if (src.includes('ok.ru')) return `${src}${sep}fromTime=${startTime}`;
  return src;
}

export function EpisodePlayer({
  title,
  src,
  sourceType,
  savedProgress = 0,
  episodeId,
  duration: episodeDuration,
  startTime = 0,
  onEnded: onEndedProp,
}: EpisodePlayerProps) {
  const lastReportRef = useRef(0);
  const episodeIdRef = useRef(episodeId);

  useEffect(() => {
    episodeIdRef.current = episodeId;
  }, [episodeId]);

  const reportProgress = useCallback(async (time: number, dur: number) => {
    try {
      await fetch('/api/anime/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: episodeIdRef.current,
          progressTime: Math.floor(time),
          duration: Math.floor(dur),
        }),
      });
    } catch {
      // Silently fail
    }
  }, []);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number; duration: number }) => {
      const now = Date.now();
      if (now - lastReportRef.current < 30000) return;
      lastReportRef.current = now;
      reportProgress(
        detail.currentTime,
        detail.duration || episodeDuration || 0,
      );
    },
    [reportProgress, episodeDuration],
  );

  const handleEnded = useCallback(() => {
    reportProgress(episodeDuration || 9999, episodeDuration || 9999);
    onEndedProp?.();
  }, [reportProgress, episodeDuration, onEndedProp]);

  // ── Iframe player (Sibnet, VidMoly, VK, Dailymotion, etc.) ──
  if (isIframeSource(src, sourceType)) {
    return (
      <Box
        sx={{
          width: '100%',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: '#000',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%', // 16:9
          }}
        >
          <Box
            component="iframe"
            src={applyStartTime(src, startTime)}
            title={title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </Box>
      </Box>
    );
  }

  // ── YouTube native player (thumbnail + click to play) ──
  if (isYouTubeSource(src, sourceType)) {
    return <YouTubePlayer videoId={extractYouTubeId(src)} title={title} />;
  }

  // ── Vidstack player (MP4, HLS) ──
  return (
    <Box
      sx={{
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: '#000',
        '& media-player': {
          '--media-brand': 'var(--rpb-primary)',
          '--media-focus-ring-color': 'var(--rpb-primary)',
        },
      }}
    >
      <MediaPlayer
        title={title}
        src={src}
        aspectRatio="16/9"
        playsInline
        crossOrigin
        currentTime={Math.max(savedProgress, startTime)}
        onTimeUpdate={(detail) =>
          handleTimeUpdate(
            detail as unknown as { currentTime: number; duration: number },
          )
        }
        onEnded={handleEnded}
        style={{
          '--video-brand': 'var(--rpb-primary)',
          '--video-focus-ring-color': 'var(--rpb-primary)',
          '--video-border-radius': '12px',
        }}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </Box>
  );
}
