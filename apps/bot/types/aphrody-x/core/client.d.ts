import { XSession } from "./session";
import { QueryIdStore } from "../config/query-ids";
import type { Tweet, TweetPage, UserPage } from "./parse";
import type { NewsItem, NewsOptions } from "../services/news";
export declare const WEB_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
export declare const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export declare const API_BASE = "https://x.com/i/api";
export interface RateLimit {
  limit: number;
  remaining: number;
  reset_epoch: number;
}
export interface TweetResult {
  id: string;
  text: string;
}
export interface UserInfo {
  id: string;
  name: string;
  screen_name: string;
  followers_count?: number;
  friends_count?: number;
}
export interface ListInfo {
  id: string;
  name: string;
  member_count?: number;
  subscriber_count?: number;
  mode?: string;
}
export interface TimelineTweet {
  id: string;
  text: string;
}
/** Construct default headers for X private API authentication. */
export declare function authHeaders(
  session: XSession,
  clientUuid: string,
  clientDeviceId: string,
): Record<string, string>;
export declare class XClient {
  session: XSession;
  clientUuid: string;
  clientDeviceId: string;
  queryIds: QueryIdStore;
  lastRateLimit: RateLimit | null;
  constructor(session: XSession, queryIds?: QueryIdStore);
  transactionId(): string;
  /** Run any HTTP request pre-populated with X auth headers. Keeps cookies updated and retries transient issues. */
  request(url: string, init?: RequestInit): Promise<Response>;
  captureRateLimit(headers: Headers): void;
  private resolveQueryId;
  /** Generic GraphQL operation invoker with automatic 404/414 recovery. */
  graphql(opName: string, variables: any, extraFeatures?: any): Promise<any>;
  private graphqlSend;
  private graphqlSendQueryPost;
  private handleApiResponse;
  /** graphql() but transparently waits out rate limit windows. */
  graphqlWaiting(
    opName: string,
    variables: any,
    extraFeatures?: any,
    maxWaitMs?: number,
  ): Promise<any>;
  createTweet(text: string, replyTo?: string): Promise<TweetResult>;
  createTweetWithMedia(text: string, replyTo?: string, mediaIds?: string[]): Promise<TweetResult>;
  createTweetRest(text: string, replyTo?: string): Promise<TweetResult>;
  deleteTweet(id: string): Promise<void>;
  like(tweetId: string): Promise<void>;
  unlike(tweetId: string): Promise<void>;
  retweet(tweetId: string): Promise<void>;
  unretweet(tweetId: string): Promise<void>;
  bookmark(tweetId: string): Promise<void>;
  unbookmark(tweetId: string): Promise<void>;
  pinTweet(tweetId: string): Promise<void>;
  unpinTweet(tweetId: string): Promise<void>;
  noteTweet(tweetText: string | null, noteText: string): Promise<TweetResult>;
  follow(userId: string): Promise<void>;
  unfollow(userId: string): Promise<void>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  mute(userId: string): Promise<void>;
  unmute(userId: string): Promise<void>;
  userByScreenName(handle: string): Promise<UserInfo>;
  homeTimeline(count: number): Promise<TimelineTweet[]>;
  sendDm(recipientId: string, text: string): Promise<void>;
  timelineTweets(op: string, variables: any, quoteDepth?: number): Promise<TweetPage>;
  timelineUsers(op: string, variables: any): Promise<UserPage>;
  userIdFor(handle: string): Promise<string>;
  getTweet(tweetId: string, quoteDepth?: number): Promise<Tweet | null>;
  thread(tweetId: string, cursor?: string, quoteDepth?: number): Promise<TweetPage>;
  tweetDetailRaw(tweetId: string, cursor?: string): Promise<any>;
  search(
    query: string,
    count: number,
    cursor?: string,
    product?: string,
    quoteDepth?: number,
  ): Promise<TweetPage>;
  userTweets(
    userId: string,
    count: number,
    cursor?: string,
    quoteDepth?: number,
  ): Promise<TweetPage>;
  home(count: number, cursor?: string, latest?: boolean, quoteDepth?: number): Promise<TweetPage>;
  likes(userId: string, count: number, cursor?: string, quoteDepth?: number): Promise<TweetPage>;
  bookmarks(count: number, cursor?: string, quoteDepth?: number): Promise<TweetPage>;
  following(userId: string, count: number, cursor?: string): Promise<UserPage>;
  followers(userId: string, count: number, cursor?: string): Promise<UserPage>;
  listTimeline(
    listId: string,
    count: number,
    cursor?: string,
    quoteDepth?: number,
  ): Promise<TweetPage>;
  lists(userId: string, memberOf: boolean, count: number): Promise<ListInfo[]>;
  whoami(): Promise<UserInfo>;
  uploadMedia(filePath: string, alt?: string): Promise<string>;
  getNews(count: number, options?: NewsOptions): Promise<NewsItem[]>;
}
