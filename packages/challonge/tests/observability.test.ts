/**
 * Observability tests — verify JSON event logger emits/skips correctly.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
	recordEvent,
	withObserve,
	setObservabilityEnabled,
	isObservabilityEnabled,
} from "../src/observability";

describe("observability", () => {
	const originalWrite = process.stderr.write.bind(process.stderr);
	let captured: string[] = [];
	let prevEnabled = false;

	beforeEach(() => {
		captured = [];
		// Capture stderr writes
		process.stderr.write = ((chunk: string | Uint8Array) => {
			const s =
				typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
			captured.push(s);
			return true;
		}) as typeof process.stderr.write;
		prevEnabled = setObservabilityEnabled(true);
	});

	afterEach(() => {
		process.stderr.write = originalWrite;
		setObservabilityEnabled(prevEnabled);
	});

	test("recordEvent emits one JSON line on stderr when enabled", () => {
		recordEvent("transport.fetch", { url: "https://example.com", status: 200 });
		expect(captured).toHaveLength(1);
		const parsed = JSON.parse(captured[0]!.trim());
		expect(parsed.event).toBe("transport.fetch");
		expect(parsed.url).toBe("https://example.com");
		expect(parsed.status).toBe(200);
		expect(typeof parsed.ts).toBe("string");
	});

	test("recordEvent is no-op when disabled", () => {
		setObservabilityEnabled(false);
		recordEvent("transport.fetch", { url: "https://example.com" });
		expect(captured).toHaveLength(0);
	});

	test("isObservabilityEnabled reflects current state", () => {
		expect(isObservabilityEnabled()).toBe(true);
		setObservabilityEnabled(false);
		expect(isObservabilityEnabled()).toBe(false);
	});

	test("withObserve records duration + ok for resolved promise", async () => {
		const result = await withObserve(
			"transport.fetch",
			{ url: "x" },
			async () => {
				await Bun.sleep(5);
				return 42;
			},
		);
		expect(result).toBe(42);
		expect(captured).toHaveLength(1);
		const parsed = JSON.parse(captured[0]!.trim());
		expect(parsed.ok).toBe(true);
		expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("withObserve records error for rejected promise", async () => {
		await expect(
			withObserve("transport.fetch", { url: "x" }, async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		expect(captured).toHaveLength(1);
		const parsed = JSON.parse(captured[0]!.trim());
		expect(parsed.ok).toBe(false);
		expect(parsed.error).toBe("boom");
	});

	test("recordEvent handles non-serialisable fields gracefully", () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		recordEvent("transport.fetch", cyclic);
		expect(captured).toHaveLength(1);
		const line = captured[0]!.trim();
		expect(line).toContain("non-serialisable");
	});
});
