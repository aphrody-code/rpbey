/**
 * X Radar (Premium+) — https://x.com/i/radar
 * Community: keyword monitor + trend viz via SearchTimeline (querySource: radar).
 */
export declare const RADAR_PAGE_URL: "https://x.com/i/radar";
export declare const RADAR_NEW_URL: "https://x.com/i/radar/new";
export declare const RADAR_ROUTES: readonly ["/i/radar", "/i/radar/new"];
/** GraphQL used by Radar UI (no dedicated Radar* op in 2026 public bundles). */
export declare const RADAR_GRAPHQL_OPS: readonly [
  "SearchTimeline",
  "ExplorePage",
  "ExploreSidebar",
];
export declare const RADAR_QUERY_SOURCE: "radar";
export declare const RADAR_SEARCH_PRODUCTS: readonly ["Latest", "Top"];
export type RadarSearchProduct = (typeof RADAR_SEARCH_PRODUCTS)[number];
/** Advanced search operators documented for Radar (help.x.com / community). */
export declare const RADAR_QUERY_SYNTAX_HELP: readonly [
  '"exact phrase"',
  "term1 OR term2",
  "term -exclude",
  "term min_faves:100",
  "term url:domain",
  "@handle",
  "from:user",
];
