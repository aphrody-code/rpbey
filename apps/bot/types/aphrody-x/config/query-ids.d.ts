export interface QueryIdSnapshot {
  fetched_at: number;
  ttl_secs: number;
  ids: Record<string, string>;
  bundles: string[];
}
export declare class QueryIdStore {
  private cachePath;
  private ttlSecs;
  private cachedSnapshot;
  constructor(cachePath?: string, ttlSecs?: number);
  private defaultCachePath;
  get(operation: string): string | undefined;
  snapshot(): QueryIdSnapshot | null;
  isFresh(snap: QueryIdSnapshot): boolean;
  refresh(targets: string[], force?: boolean): Promise<QueryIdSnapshot>;
  private discoverBundles;
  private fetchAndExtract;
  private extractOperations;
  private validQueryId;
}
