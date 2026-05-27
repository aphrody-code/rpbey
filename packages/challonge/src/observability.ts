/**
 * Observability — JSON-structured event logger.
 *
 * Emits one JSON line per event on stderr, compatible with vector / Loki /
 * Datadog Agent. Disabled by default; enable via `RPB_CHALLONGE_OBSERVE=1`
 * or by calling `setObservabilityEnabled(true)`.
 *
 * Designed for the bxc migration shadow-mode rollout :
 *   - transport.fetch        — every BxcTransport.fetch() call
 *   - transport.cache.hit    — LRU cache hit
 *   - transport.cache.miss   — LRU cache miss
 *   - scraper.scrape.start   — ChallongeScraper.scrape() entered
 *   - scraper.scrape.end     — ChallongeScraper.scrape() done (with status)
 *   - cookie.reload          — cookie jar re-read from disk
 *   - cookie.expired         — cookie jar TTL exceeded (cf_clearance)
 *   - shadow.diff            — shadow-mode primary vs secondary divergence
 */

export type ObservabilityEvent =
	| "transport.fetch"
	| "transport.cache.hit"
	| "transport.cache.miss"
	| "scraper.scrape.start"
	| "scraper.scrape.end"
	| "cookie.reload"
	| "cookie.expired"
	| "shadow.diff"
	| (string & { readonly __brand?: "ObservabilityEvent" });

let _enabled = process.env.RPB_CHALLONGE_OBSERVE === "1";

/** Toggle observability emission. Returns previous value. */
export function setObservabilityEnabled(enabled: boolean): boolean {
	const prev = _enabled;
	_enabled = enabled;
	return prev;
}

/** Whether events are currently emitted. */
export function isObservabilityEnabled(): boolean {
	return _enabled;
}

/**
 * Record one observability event. No-op when disabled.
 *
 * Outputs one JSON line on stderr :
 *   {"ts":"2026-05-10T18:00:00.000Z","event":"transport.fetch","slug":"B_TS5",...}
 */
export function recordEvent(
	event: ObservabilityEvent,
	fields: Record<string, unknown> = {},
): void {
	if (!_enabled) return;
	const payload = {
		ts: new Date().toISOString(),
		event,
		...fields,
	};
	try {
		const line = JSON.stringify(payload);
		Bun.stderr.write(line + "\n");
	} catch {
		// Cyclic structure or BigInt — fall back to a safe message.
		Bun.stderr.write(
			`{"ts":"${new Date().toISOString()}","event":"${event}","error":"non-serialisable fields"}\n`,
		);
	}
}

/**
 * Helper for measuring + recording an async block.
 *
 * @example
 *   await withObserve("transport.fetch", { url }, async () => {
 *     return transport.fetch(url);
 *   });
 */
export async function withObserve<T>(
	event: ObservabilityEvent,
	fields: Record<string, unknown>,
	fn: () => Promise<T>,
): Promise<T> {
	const t0 = performance.now();
	try {
		const result = await fn();
		recordEvent(event, {
			...fields,
			durationMs: performance.now() - t0,
			ok: true,
		});
		return result;
	} catch (err) {
		recordEvent(event, {
			...fields,
			durationMs: performance.now() - t0,
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
