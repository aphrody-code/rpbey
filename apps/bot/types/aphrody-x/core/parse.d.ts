import { type Author, type Tweet, type User } from "./schemas";
export { type Author, type Tweet, type User };
export interface TweetPage {
    tweets: Tweet[];
    next_cursor?: string;
}
export interface UserPage {
    users: User[];
    next_cursor?: string;
}
export declare class XError extends Error {
    code: number;
    status?: number;
    constructor(message: string, code: number, status?: number);
}
/** Extract structured X API errors from a response body and throw if present. */
export declare function checkApiErrors(body: any): void;
/** Parse a tweet_results.result node into a Tweet. */
export declare function parseTweetResult(result: any, quoteDepth?: number): Tweet | null;
/** Walk a timeline response and extract all tweets and the bottom cursor. */
export declare function walkTimelineTweets(root: any, quoteDepth?: number): TweetPage;
/** Parse a user_results.result node into a User. */
export declare function parseUserResult(result: any): User | null;
/** Walk a user list timeline and extract all users and the bottom cursor. */
export declare function walkTimelineUsers(root: any): UserPage;
/** Helper: find a single tweet by its id from a response tree. */
export declare function parseSingleTweet(root: any, tweetId: string): Tweet | null;
