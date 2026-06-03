import type { Store } from "./store";
export interface IngestStats {
  tweetsIngested: number;
  usersIngested: number;
  communitiesIngested: number;
}
/**
 * Recursively find and upsert all users in any JSON structure.
 */
export declare function findAndUpsertUsers(root: any, store: Store): number;
/**
 * Reads and ingests Beyblade X scraper JSON output (typically beyblade_data.json)
 * into the given SQLite Store.
 */
export declare function ingestBeybladeData(filePath: string, store: Store): Promise<IngestStats>;
