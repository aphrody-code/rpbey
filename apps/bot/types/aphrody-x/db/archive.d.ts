import type { Tweet } from "../core/parse";
import { Store } from "./store";
/** Locate the tweets file inside an archive directory or accept a direct path. */
export declare function resolveTweetsFile(input: string): string | null;
/** Strip the window.YTD.* assignment prefix and parse the JSON array. */
export declare function parseArchiveArray(raw: string): any[];
/** Convert one archive element into a Tweet structure. */
export declare function archiveTweetToTweet(
  elem: any,
  owner: {
    username: string;
    name: string;
  },
): Tweet | null;
/** Import a tweets archive into the SQLite store. */
export declare function importArchive(
  store: Store,
  path: string,
  ownerHandle: string,
): Promise<number>;
