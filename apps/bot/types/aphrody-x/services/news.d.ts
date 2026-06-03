import type { XClient } from "../core/client";
export interface NewsOptions {
    tabs?: string[];
    ai_only?: boolean;
}
export interface NewsItem {
    id: string;
    headline: string;
    category: string;
    time_ago?: string;
    post_count?: number;
    description?: string;
    url?: string;
}
/** Parse a K/M/B-suffixed post count like "12.3K posts" or "5M posts". */
export declare function parsePostCount(s: string): number | null;
/** Parse one itemContent node into a NewsItem, applying the AI filter. */
export declare function parseNewsItem(itemContent: any, entryId: string, source: string, aiOnly: boolean): NewsItem | null;
/** Parse all news items from a GenericTimelineById response. */
export declare function parseTabItems(data: any, source: string, maxCount: number, aiOnly: boolean): NewsItem[];
/** Fetch news / trending items from the requested Explore tabs. */
export declare function getNews(client: XClient, count: number, options?: NewsOptions): Promise<NewsItem[]>;
