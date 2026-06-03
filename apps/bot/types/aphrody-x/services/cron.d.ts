import { XClient } from "../core/client";
import { Store } from "../db/store";
export interface SyncOptions {
    cronExpression?: string;
    onSyncComplete?: (stats: {
        newTweets: number;
        timestamp: number;
    }) => void;
    syncHome?: boolean;
    syncBookmarks?: boolean;
}
/** Schedule a periodic background sync of X data into the local store using Bun.cron. */
export declare function startSyncCron(client: XClient, store: Store, options?: SyncOptions): Bun.CronJob;
export type CronInstance = ReturnType<typeof Bun.cron>;
