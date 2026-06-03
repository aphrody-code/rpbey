/** Extract GraphQL operation descriptors from X responsive-web bundles (bxc-aligned). */
export interface BundleOperation {
  queryId: string;
  operationName: string;
  operationType: "query" | "mutation" | "subscription";
}
export interface CatalogFile {
  extracted_from?: string;
  operation_count?: number;
  operations: Record<
    string,
    {
      queryId: string;
      operationType: string;
      featureSwitches: string[];
    }
  >;
}
export declare const DEFAULT_CATALOG_PATH: string;
/** Discover client-web bundle URLs from public X pages (same pages as QueryIdStore). */
export declare function discoverBundleUrls(extraPages?: string[]): Promise<string[]>;
/** Parse all `{queryId, operationName}` pairs from bundle JS. */
export declare function extractAllOperationsFromJs(js: string): Map<string, string>;
/** Fetch bundles and return merged operation → queryId map. */
export declare function fetchLiveQueryIds(targets?: string[]): Promise<{
  ids: Record<string, string>;
  bundles: string[];
}>;
/** Merge live queryIds into on-disk catalog; preserve featureSwitches. */
export declare function mergeCatalogQueryIds(
  catalog: CatalogFile,
  liveIds: Record<string, string>,
  sourceBundle?: string,
): {
  updated: number;
  stale: string[];
  missing_in_bundle: string[];
};
export declare function loadCatalog(path?: string): CatalogFile;
export declare function saveCatalog(catalog: CatalogFile, path?: string): void;
/** Full sync: scrape bundles → update catalog JSON (+ optional rust mirror path). */
export declare function syncCatalogFromBundles(opts?: {
  catalogPath?: string;
  rustCatalogPath?: string;
}): Promise<Record<string, unknown>>;
