import { parseStringPromise } from 'xml2js';
import { type VideoInfo } from './twitch';

const YOUTUBE_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const DEFAULT_CHANNEL_ID = 'UCaGPpRP8MJzc5s8WGOD4jLw';

export async function getRecentYouTubeVideos(
  channelId: string = DEFAULT_CHANNEL_ID,
  limit = 6,
): Promise<VideoInfo[]> {
  try {
    const response = await fetch(`${YOUTUBE_RSS_URL}${channelId}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube RSS: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);

    const entries = result.feed.entry || [];

    // Process only the first 'limit' entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return entries.slice(0, limit).map((entry: any) => {
      const videoId = entry['yt:videoId']?.[0];
      const title = entry.title?.[0];
      const published = new Date(entry.published?.[0]);

      const stats =
        entry['media:group']?.[0]?.['media:community']?.[0]?.[
          'media:statistics'
        ]?.[0]?.$;
      const views = stats ? parseInt(stats.views, 10) : 0;

      const thumbnail =
        entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$.url;
      const url = entry.link?.[0]?.$.href;

      return {
        id: videoId,
        title,
        url,
        thumbnailUrl: thumbnail,
        duration: 'YouTube', // RSS doesn't give duration easily, using placeholder
        publishedAt: published,
        viewCount: views,
      };
    });
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return [];
  }
}
