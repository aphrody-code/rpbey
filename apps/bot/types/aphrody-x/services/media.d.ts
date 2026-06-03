import type { XClient } from "../core/client";
/** Upload a local media file and return its media_id string. */
export declare function uploadMedia(
  client: XClient,
  filePath: string,
  alt?: string,
): Promise<string>;
