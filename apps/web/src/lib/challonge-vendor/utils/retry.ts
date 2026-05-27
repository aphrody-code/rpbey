/**
 * Retry helpers — exponential backoff with jitter, AbortSignal support.
 */

export interface RetryOptions {
  /** Max attempts including the first one. Default 4. */
  attempts?: number;
  /** Initial delay in ms. Default 500. */
  baseDelayMs?: number;
  /** Cap on delay between retries (ms). Default 15_000. */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff. Default 2. */
  factor?: number;
  /** Random jitter ratio (0..1). 0.3 = ±30%. Default 0.3. */
  jitter?: number;
  /** Predicate: should we retry on this error? Default: always retry. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional logger. */
  onAttempt?: (attempt: number, err?: unknown) => void;
  /** Cancel mid-retry. */
  signal?: AbortSignal;
}

const DEFAULTS: Required<Omit<RetryOptions, "shouldRetry" | "onAttempt" | "signal">> = {
  attempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 15_000,
  factor: 2,
  jitter: 0.3,
};

export class AbortError extends Error {
  constructor(message = "Aborted") {
    super(message);
    this.name = "AbortError";
  }
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) throw new AbortError();
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { attempts, baseDelayMs, maxDelayMs, factor, jitter } = { ...DEFAULTS, ...options };
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (options.signal?.aborted) throw new AbortError();
    try {
      options.onAttempt?.(attempt);
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !shouldRetry(err, attempt)) {
        throw err;
      }
      const exp = Math.min(maxDelayMs, baseDelayMs * factor ** (attempt - 1));
      const jitterMs = exp * jitter * (Math.random() * 2 - 1);
      const delay = Math.max(0, exp + jitterMs);
      options.onAttempt?.(attempt, err);
      await sleep(delay, options.signal);
    }
  }
  // Unreachable, but TypeScript requires it
  throw lastError;
}

/**
 * Same as retry but stops early if the error matches a "fatal" predicate
 * (e.g. 401 Unauthorized → no point retrying). 4xx other than 408/429 are fatal by default.
 */
export function isTransientHttpError(err: unknown): boolean {
  if (!err || typeof err !== "object") return true;
  const e = err as { status?: number; code?: string };
  if (typeof e.status === "number") {
    if (e.status === 408 || e.status === 429) return true;
    if (e.status >= 500) return true;
    return false;
  }
  if (e.code === "ECONNRESET" || e.code === "ETIMEDOUT" || e.code === "EAI_AGAIN") return true;
  return true;
}
