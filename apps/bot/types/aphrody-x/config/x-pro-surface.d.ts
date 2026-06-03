/** X Pro (Gryphon / TweetDeck successor) — pro.x.com decks surface. */
export declare const X_PRO_HOST: "https://pro.x.com";
export declare const X_PRO_DECK_URL: (deckId: string) => `https://pro.x.com/i/decks/${string}`;
export declare const X_PRO_DECKS_NEW: "https://pro.x.com/i/decks/new";
export declare const X_PRO_DECKS_MANAGE: "https://pro.x.com/i/decks/manage";
export declare const GRYPHON_BUNDLE_BASE: "https://abs.twimg.com/gryphon-client/client-web/";
export declare const X_PRO_ROUTES: readonly ["/i/decks", "/i/decks/new", "/i/decks/manage", "/i/columns/picker", "/i/columns/populate_deck", "/i/tweetdeck_release_notes"];
export declare const GRYPHON_GRAPHQL_OPS: readonly ["ViewerAccountSync", "CreateDeck", "UpdateDeck", "RemoveDeck", "ReorderDecks", "CreateColumn", "UpdateColumn", "RemoveColumn", "ReorderColumns", "GryphonImportClientSyncColumns", "GryphonDeleteAccountSync", "UpdateGryphonOnboardingState"];
export declare const X_PRO_COLUMN_TIMELINE_OPS: readonly ["GenericTimelineById", "HomeTimeline", "HomeLatestTimeline", "SearchTimeline", "PinnedTimelines"];
export declare const X_PRO_RECON_URLS: readonly ["https://pro.x.com", "https://pro.x.com/i/decks/new", `https://pro.x.com/i/decks/${string}`];
