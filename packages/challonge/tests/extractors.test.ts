/**
 * Fixture-driven tests for src/extractors/react-props.ts
 *
 * All fixtures are real BTS4 pages captured offline — no network calls.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { extractReactRoots, getReactRoot, readDataAttrs } from "../src/extractors/react-props";

// ─── Fixture loading ──────────────────────────────────────────────────────────

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

let logHtml: string;
let rootHtml: string;
let participantsHtml: string;

beforeAll(async () => {
  [logHtml, rootHtml, participantsHtml] = await Promise.all([
    Bun.file(FIXTURES + "bts4_log.html").text(),
    Bun.file(FIXTURES + "bts4_root.html").text(),
    Bun.file(FIXTURES + "bts4_participants.html").text(),
  ]);
});

// ─── extractReactRoots ────────────────────────────────────────────────────────

describe("extractReactRoots", () => {
  test("bts4_log.html — finds exactly one LogEntriesController root", () => {
    const roots = extractReactRoots(logHtml);
    expect(roots).toHaveLength(1);
    expect(roots[0].className).toBe("LogEntriesController");
  });

  test("bts4_log.html — LogEntriesController props are an empty object (SSR behaviour)", () => {
    const roots = extractReactRoots(logHtml);
    // Challonge SSR sends {} on /log; lock this in so any regression is explicit.
    expect(roots[0].props).toEqual({});
  });

  test("bts4_root.html — finds exactly one TournamentController root", () => {
    const roots = extractReactRoots(rootHtml);
    expect(roots).toHaveLength(1);
    expect(roots[0].className).toBe("TournamentController");
  });

  test("bts4_root.html — TournamentController has expected prop keys", () => {
    const roots = extractReactRoots<{
      initialView: string;
      allowRoundCollapsing: boolean;
      waitForIntegrationData: boolean;
    }>(rootHtml);
    const root = roots[0];
    expect(root.props).not.toBeNull();
    expect(root.props).toHaveProperty("initialView");
    expect(root.props).toHaveProperty("allowRoundCollapsing");
    expect(root.props).toHaveProperty("waitForIntegrationData");
  });

  test("returns empty array for HTML with no react roots", () => {
    const roots = extractReactRoots("<html><body><p>no components</p></body></html>");
    expect(roots).toHaveLength(0);
  });
});

// ─── getReactRoot ─────────────────────────────────────────────────────────────

describe("getReactRoot", () => {
  test("returns the matching root by className", () => {
    const root = getReactRoot(logHtml, "LogEntriesController");
    expect(root).not.toBeNull();
    expect(root!.className).toBe("LogEntriesController");
  });

  test("returns null when className is not present", () => {
    const root = getReactRoot(logHtml, "StandingsController");
    expect(root).toBeNull();
  });

  test("bts4_root.html TournamentController initialView is a non-empty string", () => {
    const root = getReactRoot<{ initialView: string }>(rootHtml, "TournamentController");
    expect(root).not.toBeNull();
    expect(typeof root!.props?.initialView).toBe("string");
    expect(root!.props!.initialView.length).toBeGreaterThan(0);
  });
});

// ─── readDataAttrs ────────────────────────────────────────────────────────────

describe("readDataAttrs", () => {
  test("bts4_participants.html — #participant-management returns expected keys", () => {
    const attrs = readDataAttrs(participantsHtml, "#participant-management");
    // These keys are present in the real BTS4 participants page.
    expect(Object.keys(attrs)).toContain("tournament");
    expect(Object.keys(attrs)).toContain("rankings");
    expect(Object.keys(attrs)).toContain("locale");
    expect(Object.keys(attrs)).toContain("has-ads");
    expect(Object.keys(attrs)).toContain("is-locked");
  });

  test("bts4_participants.html — data-locale is 'fr'", () => {
    const attrs = readDataAttrs(participantsHtml, "#participant-management");
    expect(attrs["locale"]).toBe("fr");
  });

  test("bts4_participants.html — data-tournament is parseable JSON", () => {
    const attrs = readDataAttrs(participantsHtml, "#participant-management");
    expect(() => JSON.parse(attrs["tournament"]!)).not.toThrow();
    const t = JSON.parse(attrs["tournament"]!);
    expect(t.id).toBe(17779621);
  });

  test("returns empty object when selector finds no element", () => {
    const attrs = readDataAttrs(participantsHtml, "#does-not-exist");
    expect(attrs).toEqual({});
  });

  test("returns empty object when no data-* attrs exist on the matched element", () => {
    const attrs = readDataAttrs("<html><body><div id='x'></div></body></html>", "#x");
    expect(attrs).toEqual({});
  });
});

// ─── Entity decoding (synthetic HTML) ────────────────────────────────────────

describe("entity decoding", () => {
  test("decodes HTML-entity-encoded JSON in data-react-props", () => {
    // Challonge encodes props as &quot; entities around JSON strings.
    const synthetic = `<div data-react-class="X" ` + `data-react-props="{&quot;a&quot;:1}"></div>`;
    const roots = extractReactRoots<{ a: number }>(synthetic);
    expect(roots).toHaveLength(1);
    expect(roots[0].className).toBe("X");
    expect(roots[0].props).toEqual({ a: 1 });
  });

  test("handles deeply nested entity-encoded JSON", () => {
    // props = { "foo": "bar&baz" }  → data-react-props="{&quot;foo&quot;:&quot;bar&amp;baz&quot;}"
    const synthetic =
      `<div data-react-class="Y" ` +
      `data-react-props="{&quot;foo&quot;:&quot;bar&amp;baz&quot;}"></div>`;
    const roots = extractReactRoots<{ foo: string }>(synthetic);
    expect(roots[0].props?.foo).toBe("bar&baz");
  });

  test("props are null when data-react-props is malformed JSON", () => {
    const synthetic = `<div data-react-class="Z" data-react-props="{bad json}"></div>`;
    const roots = extractReactRoots(synthetic);
    expect(roots[0].props).toBeNull();
  });

  test("rawProps is preserved exactly (pre-decode)", () => {
    const synthetic = `<div data-react-class="W" data-react-props="{&quot;a&quot;:1}"></div>`;
    const roots = extractReactRoots(synthetic);
    expect(roots[0].rawProps).toBe("{&quot;a&quot;:1}");
  });
});
