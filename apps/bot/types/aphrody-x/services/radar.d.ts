import type { XClient } from "../core/client";
import type { Tweet, TweetPage } from "../core/parse";
import { type RadarSearchProduct } from "../config/radar-surface";
export interface RadarSearchOptions {
  count?: number;
  cursor?: string;
  product?: RadarSearchProduct;
  quoteDepth?: number;
  /** Override querySource (default: radar). */
  querySource?: string;
}
export interface RadarActivityBucket {
  /** ISO date YYYY-MM-DD */
  day: string;
  count: number;
}
export interface RadarMetrics {
  query: string;
  tweet_count: number;
  total_likes: number;
  total_retweets: number;
  avg_likes: number;
  top_tweets: Tweet[];
  activity_by_day: RadarActivityBucket[];
  fetched_at: string;
}
export interface RadarExploreSnapshot {
  explore_page: unknown;
  explore_sidebar: unknown;
  fetched_at: string;
}
/** Radar search — SearchTimeline with querySource `radar` (matches x.com/i/radar). */
export declare function radarSearch(
  client: XClient,
  rawQuery: string,
  opts?: RadarSearchOptions,
): Promise<TweetPage>;
export declare function radarSearchAll(
  client: XClient,
  rawQuery: string,
  maxPages?: number,
  opts?: Omit<RadarSearchOptions, "cursor">,
): Promise<{
  tweets: Tweet[];
  pages: number;
}>;
export declare function radarMetrics(
  client: XClient,
  rawQuery: string,
  maxPages?: number,
  opts?: Omit<RadarSearchOptions, "cursor">,
): Promise<RadarMetrics>;
export declare function radarExplore(client: XClient): Promise<RadarExploreSnapshot>;
export declare function probeRadarAccess(client: XClient): Promise<{
  page_urls: {
    radar: string;
    new: string;
  };
  search_ok: boolean;
  explore_ok: boolean;
  graphql_ops: readonly string[];
  error?: string;
}>;
