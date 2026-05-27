'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Suspense, use, useState } from 'react';
import { type BeyTubeVideo } from '@/lib/beytube';
import { type TikTokVideo } from '@/lib/tiktok-types';
import { type StreamInfo, type VideoInfo } from '@/lib/twitch';
import { LiveBanner } from './LiveBanner';
import { TikTokMiniCard } from './TikTokMiniCard';
import { VideoCard } from './VideoCard';
import { VideoPlayerModal } from './VideoPlayerModal';

/* ---------- Types ---------- */

interface TvFeedProps {
  streamPromise: Promise<StreamInfo | null>;
  clipsPromise: Promise<VideoInfo[]>;
  rpbVideosPromise: Promise<VideoInfo[]>;
  beyTubeVideosPromise: Promise<BeyTubeVideo[]>;
  tikTokVideosPromise: Promise<TikTokVideo[]>;
  domain: string;
}

/* ---------- Skeleton loaders ---------- */

function CardSkeleton({
  count = 4,
  portrait = false,
}: {
  count?: number;
  portrait?: boolean;
}) {
  return (
    <Grid container spacing={{ xs: 1.5, md: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid
          key={`skel-${i}`}
          size={portrait ? { xs: 4, sm: 3, md: 2 } : { xs: 6, sm: 4, md: 3 }}
        >
          <Skeleton
            variant="rectangular"
            sx={{
              aspectRatio: portrait ? '9/16' : '16/9',
              borderRadius: 2.5,
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="85%" height={16} />
              <Skeleton width="55%" height={14} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

/* ---------- Section heading ---------- */

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
      }}
    >
      <Typography
        variant="h6"
        component="h2"
        sx={{
          fontWeight: 700,
          fontSize: { xs: '1rem', md: '1.15rem' },
          lineHeight: 1.3,
        }}
      >
        {title}
      </Typography>
      {count != null && count > 0 && (
        <Chip
          label={count}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.72rem',
            fontWeight: 700,
            bgcolor: 'action.hover',
          }}
        />
      )}
    </Box>
  );
}

/* ---------- Resolved grids ---------- */

function LiveSection({
  promise,
  domain,
}: {
  promise: Promise<StreamInfo | null>;
  domain: string;
}) {
  const stream = use(promise);
  if (!stream?.isLive) return null;

  return (
    <Box>
      <SectionHeading title="En direct" />
      <LiveBanner stream={stream} domain={domain} />
    </Box>
  );
}

function ClipsGrid({
  promise,
  onVideoClick,
}: {
  promise: Promise<VideoInfo[]>;
  onVideoClick: (v: VideoInfo) => void;
}) {
  const clips = use(promise);
  if (clips.length === 0) return null;

  return (
    <Box>
      <SectionHeading title="Clips" count={clips.length} />
      <Grid container spacing={{ xs: 1.5, md: 2 }}>
        {clips.map((clip) => (
          <Grid key={clip.id} size={{ xs: 6, sm: 4, md: 3 }}>
            <VideoCard
              title={clip.title}
              thumbnail={clip.thumbnailUrl}
              duration={clip.duration}
              channelName={clip.channelName || 'RPB'}
              channelAvatar={clip.channelAvatar || clip.channelLogo}
              views={clip.viewCount}
              ago={formatDistanceToNow(new Date(clip.publishedAt), {
                addSuffix: true,
                locale: fr,
              })}
              platform="twitch"
              onClick={() => onVideoClick(clip)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function VideosGrid({
  promise,
  onVideoClick,
}: {
  promise: Promise<VideoInfo[]>;
  onVideoClick: (v: VideoInfo) => void;
}) {
  const videos = use(promise);
  if (videos.length === 0) return null;

  return (
    <Box>
      <SectionHeading title="Rediffusions" count={videos.length} />
      <Grid container spacing={{ xs: 1.5, md: 2 }}>
        {videos.map((video) => (
          <Grid key={video.id} size={{ xs: 6, sm: 4, md: 3 }}>
            <VideoCard
              title={video.title}
              thumbnail={video.thumbnailUrl}
              duration={video.duration}
              channelName={video.channelName || 'RPB'}
              channelAvatar={video.channelAvatar || video.channelLogo}
              views={video.viewCount}
              ago={formatDistanceToNow(new Date(video.publishedAt), {
                addSuffix: true,
                locale: fr,
              })}
              platform="youtube"
              onClick={() => onVideoClick(video)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function BeyTubeGrid({ promise }: { promise: Promise<BeyTubeVideo[]> }) {
  const videos = use(promise);
  if (videos.length === 0) return null;

  return (
    <Box>
      <SectionHeading title="BeyTube FR" count={videos.length} />
      <Grid container spacing={{ xs: 1.5, md: 2 }}>
        {videos.map((video) => (
          <Grid key={video.id} size={{ xs: 6, sm: 4, md: 3 }}>
            <VideoCard
              title={video.title}
              thumbnail={video.thumbnail}
              duration={video.duration || '0:00'}
              channelName={video.channelName}
              channelAvatar={video.channelAvatar}
              views={video.views}
              ago={video.ago || 'Recemment'}
              url={video.url}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function TikTokGrid({ promise }: { promise: Promise<TikTokVideo[]> }) {
  const videos = use(promise);
  if (videos.length === 0) return null;

  return (
    <Box>
      <SectionHeading title="TikTok" count={videos.length} />
      <Grid container spacing={{ xs: 1.5, md: 2 }}>
        {videos.map((video) => (
          <Grid key={video.id} size={{ xs: 4, sm: 3, md: 2 }}>
            <TikTokMiniCard video={video} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

/* ---------- Main feed ---------- */

export function TvFeed({
  streamPromise,
  clipsPromise,
  rpbVideosPromise,
  beyTubeVideosPromise,
  tikTokVideosPromise,
  domain,
}: TvFeedProps) {
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);
  const [videoType, setVideoType] = useState<'twitch' | 'youtube' | null>(null);

  const handleVideoClick = (video: VideoInfo, type: 'twitch' | 'youtube') => {
    setSelectedVideo(video);
    setVideoType(type);
  };

  return (
    <Stack spacing={{ xs: 3, md: 4 }} sx={{ pb: 8 }}>
      {/* En direct */}
      <Suspense fallback={null}>
        <LiveSection promise={streamPromise} domain={domain} />
      </Suspense>

      {/* Rediffusions */}
      <Suspense fallback={<CardSkeleton />}>
        <VideosGrid
          promise={rpbVideosPromise}
          onVideoClick={(v) => handleVideoClick(v, 'youtube')}
        />
      </Suspense>

      {/* Clips */}
      <Suspense fallback={<CardSkeleton />}>
        <ClipsGrid
          promise={clipsPromise}
          onVideoClick={(v) => handleVideoClick(v, 'twitch')}
        />
      </Suspense>

      {/* BeyTube FR */}
      <Suspense fallback={<CardSkeleton count={4} />}>
        <BeyTubeGrid promise={beyTubeVideosPromise} />
      </Suspense>

      {/* TikTok */}
      <Suspense fallback={<CardSkeleton count={6} portrait />}>
        <TikTokGrid promise={tikTokVideosPromise} />
      </Suspense>

      {/* Video player modal */}
      <VideoPlayerModal
        open={!!selectedVideo}
        video={selectedVideo}
        type={videoType}
        onClose={() => setSelectedVideo(null)}
        domain={domain}
      />
    </Stack>
  );
}
