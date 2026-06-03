import type { Operation } from "../config/catalog";
export declare const CREATE_TWEET_FEATURES_KNOWN_GOOD: {
    interactive_text_enabled: boolean;
    longform_notetweets_inline_media_enabled: boolean;
    longform_notetweets_rich_text_read_enabled: boolean;
    longform_notetweets_consumption_enabled: boolean;
    tweet_awards_web_tipping_enabled: boolean;
    freedom_of_speech_not_reach_fetch_enabled: boolean;
    standardized_nudges_misinfo: boolean;
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: boolean;
    rweb_video_timestamps_enabled: boolean;
    longform_notetweets_prompts_enabled: boolean;
    creator_subscriptions_tweet_preview_api_enabled: boolean;
    c9s_tweet_anatomy_moderator_badge_enabled: boolean;
    articles_preview_enabled: boolean;
    rweb_tipjar_consumption_enabled: boolean;
    responsive_web_graphql_exclude_directive_enabled: boolean;
    verified_phone_label_enabled: boolean;
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: boolean;
    responsive_web_graphql_timeline_navigation_enabled: boolean;
    responsive_web_enhance_cards_enabled: boolean;
};
export declare const DEFAULT_FEATURES: Record<string, boolean | number | string>;
/** Build the feature-flag subset for a given operation. */
export declare function featuresFor(op: Operation): Record<string, boolean | number | string>;
