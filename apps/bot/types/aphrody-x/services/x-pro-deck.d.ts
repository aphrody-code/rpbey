import type { XClient } from "../core/client";
export interface XProDeckColumn {
  rest_id: string;
  pathname: string;
  width?: string;
  media_preview?: string;
  latest?: boolean;
  hide_header?: boolean;
}
export interface XProDeckConfig {
  title?: string;
  icon?: string;
  is_pinned?: boolean;
}
export interface XProDeck {
  rest_id: string;
  config?: XProDeckConfig;
  deck_columns_v2?: XProDeckColumn[];
}
export interface XProAccountSync {
  active_deck_id?: string;
  composer_expanded?: boolean;
  default_column_width?: string;
  default_media_preview?: string;
  navbar_expanded?: boolean;
}
export interface ViewerAccountSyncResult {
  decks: XProDeck[];
  accountsync_client_config?: XProAccountSync;
  accountsync_onboarding_state?: Record<string, unknown>;
  raw: unknown;
}
export declare function parseViewerAccountSync(json: unknown): ViewerAccountSyncResult;
export declare function viewerAccountSync(client: XClient): Promise<ViewerAccountSyncResult>;
export declare function getDeck(client: XClient, deckId: string): Promise<XProDeck | null>;
export declare function createDeck(
  client: XClient,
  name: string,
  columns?: Array<{
    pathname: string;
    width?: string;
  }>,
): Promise<string | null>;
export declare function updateDeck(
  client: XClient,
  deckId: string,
  config: XProDeckConfig,
): Promise<unknown>;
export declare function removeDeck(client: XClient, deckId: string): Promise<unknown>;
export declare function reorderDecks(client: XClient, deckIds: string[]): Promise<unknown>;
export declare function createColumn(
  client: XClient,
  deckId: string,
  column: {
    pathname: string;
    width?: string;
    media_preview?: string;
  },
): Promise<unknown>;
export declare function updateColumn(
  client: XClient,
  deckId: string,
  columnId: string,
  column: Partial<XProDeckColumn>,
): Promise<unknown>;
export declare function removeColumn(
  client: XClient,
  deckId: string,
  columnId: string,
): Promise<unknown>;
export declare function reorderColumns(
  client: XClient,
  deckId: string,
  columnIds: string[],
): Promise<unknown>;
export declare function importClientSyncColumns(client: XClient): Promise<unknown>;
export declare function probeXProAccess(client: XClient): Promise<{
  ok: boolean;
  deck_count: number;
  active_deck_id?: string;
  graphql_ops: readonly string[];
  error?: string;
}>;
