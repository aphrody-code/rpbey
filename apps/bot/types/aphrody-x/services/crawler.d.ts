import type { XClient } from "../core/client";
import { Store } from "../db/store";
export interface CrawlerOptions {
    seedUsers?: string[];
    seedCommunities?: string[];
    seedHashtags?: string[];
    maxUsersToCrawl?: number;
    maxCommunitiesToCrawl?: number;
    maxHashtagsToCrawl?: number;
    delayMs?: number;
    crawlFollowers?: boolean;
}
export declare class Crawler {
    private client;
    private store;
    private options;
    private queueUsers;
    private queueCommunities;
    private queueHashtags;
    private visitedUsers;
    private visitedCommunities;
    private visitedHashtags;
    private running;
    constructor(client: XClient, store: Store, options?: CrawlerOptions);
    /** Read existing data from database to populate visited sets and avoid duplicates */
    private initializeQueues;
    /** Clean up handle names */
    private cleanHandle;
    /** Regex extract hashtags and mentions from text to discover new targets */
    private extractMentionsAndHashtags;
    /** Run the crawler continuously */
    start(): Promise<void>;
    /** Stop the running crawler */
    stop(): void;
    /** Perform a single crawl task from the queues */
    step(): Promise<boolean>;
    getStats(): {
        queueUsers: number;
        queueCommunities: number;
        queueHashtags: number;
        visitedUsers: number;
        visitedCommunities: number;
        visitedHashtags: number;
    };
}
