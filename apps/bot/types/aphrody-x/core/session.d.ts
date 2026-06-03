export interface XSessionData {
  auth_token: string;
  ct0: string;
  handle?: string;
  transaction_id?: string;
}
export declare class XSession implements XSessionData {
  auth_token: string;
  ct0: string;
  handle?: string;
  transaction_id?: string;
  filePath?: string;
  constructor(data: XSessionData);
  /** Load credentials from ~/.aphrody/x-session.json */
  static load(): XSession;
  /** Save the updated session back to disk using Bun.write */
  save(): Promise<void>;
  /** Load credentials from environment variables X_AUTH_TOKEN and X_CT0 */
  static fromEnv(): XSession;
  /** Try loading from file first, then environment */
  static loadOrEnv(): XSession;
  /** Parse from cookie string, e.g. "auth_token=abc; ct0=xyz" */
  static fromCookieString(str: string): XSession;
  /** Format as cookie header value */
  cookieHeader(): string;
  private validate;
}
