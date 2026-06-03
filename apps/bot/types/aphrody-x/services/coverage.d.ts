import type { XClient } from "../core/client";
export interface CoverageReport {
  generated_at: string;
  catalog: {
    total: number;
    queries: number;
    mutations: number;
  };
  sdk_surface: readonly string[];
  premium_ops: readonly string[];
  query_id_cache?: {
    live_bundle_ops: number;
    stale_vs_catalog: string[];
  };
  premium_fetch?: Record<
    string,
    {
      ok: boolean;
    }
  >;
}
/** Compare embedded catalog vs live bundle + optional live Premium probe. */
export declare function buildCoverageReport(
  client?: XClient,
  opts?: {
    probePremium?: boolean;
    checkQueryIds?: boolean;
  },
): Promise<CoverageReport>;
/** Resolve queryId: runtime cache → catalog (documents resolution order). */
export declare function resolveOperationQueryId(
  opName: string,
  runtimeId?: string,
): string | undefined;
