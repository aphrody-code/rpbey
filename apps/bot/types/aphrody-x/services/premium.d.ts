import type { XClient } from "../core/client";
/** Known upsell surface keys on x.com (from Upsells GraphQL). */
export type UpsellSurfaceKey =
  | "UserProfileName"
  | "UserProfileHeader"
  | "HomeSidebar"
  | "PremiumNav"
  | "HomeNav"
  | string;
/** Checkout SKUs in responsive-web main bundle (2026-06); not separate GraphQL ops. */
export type ProductCategory =
  | "BlueVerified"
  | "BlueVerified3Months"
  | "BlueVerified6Months"
  | "BlueVerifiedPlus"
  | "BlueVerifiedPlus3Months"
  | "BlueVerifiedPlus6Months"
  | "PremiumBasic"
  | string;
export type ChargeInterval = "Month" | "Year" | string;
export interface UpsellDestination {
  charge_interval?: ChargeInterval;
  product_category?: ProductCategory;
}
export interface UpsellConfigEntry {
  key: UpsellSurfaceKey;
  attribution_referrer?: string;
  destination?: UpsellDestination;
  is_hidden?: boolean;
  variant_key?: string;
  action_label?: string;
  primary_label?: string;
}
export interface PremiumUpsells {
  configs: UpsellConfigEntry[];
  raw: unknown;
}
export interface PremiumAccountFlags {
  is_blue_verified?: boolean;
  premium_gifting_eligible?: boolean;
  creator_subscriptions_count?: number;
  super_follow_eligible?: boolean;
  super_followers_count?: number;
  is_super_follow_subscriber?: boolean;
  can_access_payments?: boolean;
}
/** Parse `Upsells` → viewer_v2.upsell_config_for_surfaces. */
export declare function parseUpsellsResponse(json: unknown): PremiumUpsells;
/** Extract premium-related flags from Viewer + UserByScreenName payloads. */
export declare function parsePremiumFlags(
  viewerJson: unknown,
  userJson?: unknown,
): PremiumAccountFlags;
export declare function fetchPremiumUpsells(client: XClient): Promise<PremiumUpsells>;
export declare function fetchPremiumBundle(
  client: XClient,
  handle: string,
  userId: string,
): Promise<{
  upsells: PremiumUpsells;
  flags: PremiumAccountFlags;
  raw: Record<string, unknown>;
}>;
/** Variable templates for full Premium GraphQL coverage (see scripts/x-premium-dump.ts). */
export declare function premiumGraphqlVariables(
  handle: string,
  userId: string,
): Record<string, Record<string, unknown>>;
/** Fetch every op in PREMIUM_GRAPHQL_OPS; failures are recorded, not thrown. */
export declare function fetchAllPremiumGraphql(
  client: XClient,
  handle: string,
  userId: string,
): Promise<
  Record<
    string,
    | {
        ok: true;
        data: unknown;
      }
    | {
        ok: false;
        error: string;
      }
  >
>;
