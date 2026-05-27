import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { unstable_cache } from 'next/cache';

const clientId = process.env.TWITCH_CLIENT_ID || '';
const clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
const channelName = process.env.NEXT_PUBLIC_TWITCH_CHANNEL || 'tv_rpb';

// Initialize the Auth Provider
// Note: This uses App Access Token (Server-to-Server), which is read-only for most user data.
// It cannot update stream titles or tags.
const authProvider = new AppTokenAuthProvider(clientId, clientSecret);

// Initialize the API Client
export const twitchClient = new ApiClient({ authProvider });

export interface StreamInfo {
  isLive: boolean;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: Date;
  thumbnailUrl?: string;
  userName: string;
  avatarUrl?: string;
}

export async function getRPBStreamInfo(): Promise<StreamInfo | null> {
  if (!clientId || !clientSecret) {
    console.warn('Twitch credentials not set.');
    return null;
  }

  try {
    const user = await twitchClient.users.getUserByName(channelName);

    if (!user) {
      return null;
    }

    const stream = await twitchClient.streams.getStreamByUserId(user.id);

    return {
      isLive: !!stream,
      title: stream?.title || user.description, // Fallback to bio if offline
      gameName: stream?.gameName,
      viewerCount: stream?.viewers,
      startedAt: stream?.startDate,
      thumbnailUrl: stream?.thumbnailUrl
        ?.replace('{width}', '1280')
        .replace('{height}', '720'),
      userName: user.displayName,
      avatarUrl: user.profilePictureUrl,
    };
  } catch (error) {
    console.error('Error fetching Twitch data:', error);
    return null;
  }
}

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration: string;
  publishedAt: Date;
  viewCount: number;
  channelLogo?: string;
  channelName?: string;
  channelAvatar?: string | null;
}

export async function getLatestRPBVideo(): Promise<VideoInfo | null> {
  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const user = await twitchClient.users.getUserByName(channelName);

    if (!user) {
      return null;
    }

    const videos = await twitchClient.videos.getVideosByUser(user.id, {
      limit: 1,
      type: 'archive', // Only past broadcasts
    });

    if (videos.data.length === 0) {
      return null;
    }

    const video = videos.data[0];

    if (!video) {
      return null;
    }

    return {
      id: video.id,
      title: video.title,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl
        .replace('%{width}', '640')
        .replace('%{height}', '360'),
      duration: video.duration,
      publishedAt: video.publishDate,
      viewCount: video.views,
      channelLogo: user.profilePictureUrl,
    };
  } catch (error) {
    console.error('Error fetching Twitch video:', error);
    return null;
  }
}

export async function getRPBClips(limit = 6): Promise<VideoInfo[]> {
  return unstable_cache(
    async () => {
      if (!clientId || !clientSecret) return [];

      try {
        const user = await twitchClient.users.getUserByName(channelName);
        if (!user) return [];

        const clips = await twitchClient.clips.getClipsForBroadcaster(user.id, {
          limit,
        });

        return clips.data.map((clip) => ({
          id: clip.id,
          title: clip.title,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl
            .replace('{width}', '640')
            .replace('{height}', '360'),
          duration: `${Math.round(clip.duration).toString()}s`,
          publishedAt: clip.creationDate,
          viewCount: clip.views,
          channelLogo: user.profilePictureUrl,
        }));
      } catch (error) {
        console.error('Error fetching Twitch clips:', error);
        return [];
      }
    },
    [`twitch-clips-${limit}`],
    { revalidate: 3600, tags: ['twitch'] },
  )();
}

export async function getRPBVideos(limit = 6): Promise<VideoInfo[]> {
  return unstable_cache(
    async () => {
      if (!clientId || !clientSecret) return [];

      try {
        const user = await twitchClient.users.getUserByName(channelName);
        if (!user) return [];

        const videos = await twitchClient.videos.getVideosByUser(user.id, {
          limit,
          type: 'archive',
        });

        return videos.data.map((video) => ({
          id: video.id,
          title: video.title,
          url: video.url,
          thumbnailUrl: video.thumbnailUrl
            .replace('%{width}', '640')
            .replace('%{height}', '360'),
          duration: video.duration,
          publishedAt: video.publishDate,
          viewCount: video.views,
        }));
      } catch (error) {
        console.error('Error fetching Twitch videos:', error);
        return [];
      }
    },
    [`twitch-videos-${limit}`],
    { revalidate: 3600, tags: ['twitch'] },
  )();
}
