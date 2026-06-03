/**
 * X.com private web API surface map (bxc recon + bundle extraction, 2026-06).
 * Shared by @aphrody-code/x and aphrody-x-client.
 */
export declare const X_DISCOVERY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
/** Pages that reference responsive-web bundles (queryId discovery). */
export declare const X_DISCOVERY_PAGES: readonly [
  "https://x.com/?lang=en",
  "https://x.com/explore",
  "https://x.com/notifications",
  "https://x.com/settings/profile",
  "https://x.com/i/premium",
  "https://x.com/i/radar",
  "https://x.com/i/radar/new",
  "https://x.com/settings/subscriptions",
];
export declare const PREMIUM_PAGE_URL: "https://x.com/i/premium";
export declare const PREMIUM_ROUTES: readonly [
  "/i/premium",
  "/i/premium_sign_up",
  "/i/premium_cross_grade",
  "/i/premium_tier_switch",
  "/i/twitter_blue_sign_up",
  "/i/blue",
  "/i/verified-application",
  "/i/verified-invoice",
  "/i/verified-order-summary",
  "/i/verified-orgs-signup",
  "/i/verified-welcome",
  "/i/verified/settings",
  "/i/verifiedorganizations",
  "/settings/subscriptions",
  "/settings/creator-subscriptions",
  "/settings/verified",
];
export declare const PREMIUM_PRODUCT_SKUS: readonly [
  "BlueVerified",
  "BlueVerified3Months",
  "BlueVerified6Months",
  "BlueVerifiedPlus",
  "BlueVerifiedPlus3Months",
  "BlueVerifiedPlus6Months",
  "PremiumBasic",
];
export declare const PREMIUM_GRAPHQL_OPS: readonly [
  "Upsells",
  "Viewer",
  "UserByScreenName",
  "UserCreatorSubscriptions",
  "CreatorSubscriptionsTimeline",
  "UserCreatorSubscribers",
  "SuperFollowers",
  "BlueVerifiedFollowers",
  "UserArticlesTweets",
  "UsersVerifiedAvatars",
  "EnableVerifiedPhoneLabel",
  "DisableVerifiedPhoneLabel",
];
/** High-level CLI / SDK coverage (typed helpers exist on XClient). */
export declare const X_SDK_COVERAGE: readonly [
  "post",
  "reply",
  "delete",
  "note",
  "like",
  "unlike",
  "retweet",
  "unretweet",
  "bookmark",
  "unbookmark",
  "pin",
  "unpin",
  "follow",
  "unfollow",
  "block",
  "unblock",
  "mute",
  "unmute",
  "user",
  "timeline",
  "dm",
  "graphql",
  "read",
  "thread",
  "search",
  "userTweets",
  "home",
  "likes",
  "bookmarks",
  "mentions",
  "following",
  "followers",
  "listTimeline",
  "lists",
  "news",
  "uploadMedia",
  "premium",
  "whoami",
];
export declare const X_API_ENDPOINTS: {
  readonly graphql: "https://x.com/i/api/graphql/{queryId}/{operationName}";
  readonly graphql_post: "https://x.com/i/api/graphql/{queryId}/{OperationName}";
  readonly rest_v1_1: "https://x.com/i/api/1.1/";
  readonly api_v2: "https://api.x.com/";
  readonly bearer_note: "Static web Bearer in bundle (not personal OAuth)";
};
export declare const X_REST_V1_1: readonly [
  "friendships/create.json",
  "friendships/destroy.json",
  "blocks/create.json",
  "blocks/destroy.json",
  "mutes/users/create.json",
  "mutes/users/destroy.json",
  "favorites/create.json",
  "dm/new2.json",
  "account/verify_credentials.json",
];
export declare const PREMIUM_PAYMENT_HOSTS: readonly [
  "https://pay.x.com",
  "https://pay.twitter.com",
  "https://money.x.com",
  "https://money-dev.x.com",
  "https://money-staging.x.com",
  "https://payments-prod.x.com",
  "https://payments-staging.x.com",
  "https://payments-dev.x.com",
];
export declare const X_CDN: {
  readonly bundles: "https://abs.twimg.com/responsive-web/client-web/";
  readonly media: "https://pbs.twimg.com";
  readonly video: "https://video.twimg.com";
  readonly ton: "https://ton.x.com";
};
/** URLs for bxc recon (profile max recommended for SPA routes). */
export declare const X_RECON_URLS: readonly [
  "https://x.com",
  "https://x.com/home",
  "https://x.com/i/premium",
  "https://x.com/i/radar/new",
  "https://x.com/explore",
  "https://x.com/settings/subscriptions",
  "https://x.com/i/radar",
  "https://x.com/i/radar/new",
  ...(
    | "https://pay.x.com"
    | "https://pay.twitter.com"
    | "https://money.x.com"
    | "https://money-dev.x.com"
    | "https://money-staging.x.com"
    | "https://payments-prod.x.com"
    | "https://payments-staging.x.com"
    | "https://payments-dev.x.com"
  )[],
];
