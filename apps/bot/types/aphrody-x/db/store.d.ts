import { Database } from "bun:sqlite";
import type { Tweet, User } from "../core/parse";
export declare const edge: {
  readonly AUTHORED: "authored";
  readonly LIKED: "liked";
  readonly BOOKMARKED: "bookmarked";
  readonly TIMELINE: "timeline";
  readonly MENTION: "mention";
};
export interface StoredTweet {
  id: string;
  author_username: string;
  author_name: string;
  text: string;
  created_at?: string;
  like_count: number;
}
export interface Stats {
  path: string;
  tweets: number;
  users: number;
  edges: number;
  follows: number;
  by_kind: [string, number][];
}
export interface Digest {
  top_authors: [string, number][];
  top_tweets: StoredTweet[];
}
export declare class Store {
  db: Database;
  private path;
  constructor(path?: string);
  static defaultPath(): string;
  private migrate;
  upsertTweet(t: Tweet): void;
  addEdge(account: string, kind: string, tweetId: string): void;
  upsertUser(u: User): void;
  addFollow(account: string, direction: string, u: User): void;
  search(query: string, limit: number): StoredTweet[];
  stats(): Stats;
  exportTweets(): any[];
  digest(top: number): Digest;
  mutuals(account: string): string[];
  nonMutualFollowing(account: string): string[];
  close(): void;
}
