/**
 * Match-attachments tests for ChallongeApi (v1).
 *
 * Each test installs a fake `globalThis.fetch` that records the URL, method and
 * (form) body of every request, then returns a canned JSON response. No network
 * is touched. The original fetch is restored after each test.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { ChallongeApi, type MatchAttachment } from "../src/api";

// ─── Fake fetch harness ─────────────────────────────────────────────────────

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

const realFetch = globalThis.fetch;
let calls: RecordedCall[];
let nextResponse: () => Response;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  calls = [];
  nextResponse = () => jsonResponse({});
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = v;
      }
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return nextResponse();
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const api = new ChallongeApi({ apiKey: "fake-key", maxRetries: 1 });

const RAW = {
  id: 901,
  match_id: 555,
  user_id: 42,
  description: "good game",
  url: "https://youtu.be/abc",
  original_file_name: null,
  created_at: "2026-05-01T10:00:00-04:00",
  updated_at: "2026-05-01T10:05:00-04:00",
  asset_file_name: "bracket.png",
  asset_content_type: "image/png",
  asset_file_size: 12345,
  asset_url: "https://challonge.s3.amazonaws.com/bracket.png",
};

// ─── listAttachments ────────────────────────────────────────────────────────

describe("listAttachments", () => {
  test("GET to the attachments collection URL", async () => {
    nextResponse = () => jsonResponse([{ match_attachment: RAW }]);
    await api.listAttachments(123, 555);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/123/matches/555/attachments.json",
    );
    expect(calls[0]!.body).toBeUndefined();
  });

  test("unwraps { match_attachment } and maps to camelCase", async () => {
    nextResponse = () => jsonResponse([{ match_attachment: RAW }]);
    const out = await api.listAttachments(123, 555);
    expect(out).toHaveLength(1);
    const a: MatchAttachment = out[0]!;
    expect(a.id).toBe(901);
    expect(a.matchId).toBe(555);
    expect(a.userId).toBe(42);
    expect(a.description).toBe("good game");
    expect(a.url).toBe("https://youtu.be/abc");
    expect(a.originalFileName).toBeNull();
    expect(a.createdAt).toBe("2026-05-01T10:00:00-04:00");
    expect(a.updatedAt).toBe("2026-05-01T10:05:00-04:00");
    expect(a.assetFileName).toBe("bracket.png");
    expect(a.assetContentType).toBe("image/png");
    expect(a.assetFileSize).toBe(12345);
    expect(a.assetUrl).toBe("https://challonge.s3.amazonaws.com/bracket.png");
  });

  test("missing optional fields collapse to null", async () => {
    nextResponse = () => jsonResponse([{ match_attachment: { id: 1 } }]);
    const [a] = await api.listAttachments(1, 2);
    expect(a!.matchId).toBeNull();
    expect(a!.url).toBeNull();
    expect(a!.assetUrl).toBeNull();
    expect(a!.assetFileSize).toBeNull();
  });

  test("sends HTTP Basic auth header", async () => {
    nextResponse = () => jsonResponse([]);
    await api.listAttachments(1, 2);
    expect(calls[0]!.headers.Authorization).toBe("Basic " + btoa("api:fake-key"));
  });
});

// ─── getAttachment ──────────────────────────────────────────────────────────

describe("getAttachment", () => {
  test("GET to the attachment member URL", async () => {
    nextResponse = () => jsonResponse({ match_attachment: RAW });
    const a = await api.getAttachment(123, 555, 901);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/123/matches/555/attachments/901.json",
    );
    expect(calls[0]!.body).toBeUndefined();
    expect(a.id).toBe(901);
    expect(a.assetFileName).toBe("bracket.png");
  });
});

// ─── createAttachment ───────────────────────────────────────────────────────

describe("createAttachment", () => {
  test("POST to the collection URL with form-encoded match_attachment body", async () => {
    nextResponse = () => jsonResponse({ match_attachment: { ...RAW, id: 902 } });
    const a = await api.createAttachment(123, 555, {
      url: "https://youtu.be/xyz",
      description: "vod",
    });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/123/matches/555/attachments.json",
    );
    expect(calls[0]!.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("match_attachment[url]")).toBe("https://youtu.be/xyz");
    expect(params.get("match_attachment[description]")).toBe("vod");
    expect(params.has("match_attachment[asset_url]")).toBe(false);

    expect(a.id).toBe(902);
  });

  test("assetUrl maps to match_attachment[asset_url]", async () => {
    nextResponse = () => jsonResponse({ match_attachment: RAW });
    await api.createAttachment(1, 2, { assetUrl: "https://cdn/x.png" });
    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("match_attachment[asset_url]")).toBe("https://cdn/x.png");
    expect(params.has("match_attachment[url]")).toBe(false);
    expect(params.has("match_attachment[description]")).toBe(false);
  });

  test("empty data sends an empty body but still POSTs", async () => {
    nextResponse = () => jsonResponse({ match_attachment: { id: 5 } });
    await api.createAttachment(1, 2, {});
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.body).toBe("");
  });
});

// ─── updateAttachment ───────────────────────────────────────────────────────

describe("updateAttachment", () => {
  test("PUT to the member URL with only the supplied field", async () => {
    nextResponse = () => jsonResponse({ match_attachment: { ...RAW, description: "edited" } });
    const a = await api.updateAttachment(123, 555, 901, {
      description: "edited",
    });
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/123/matches/555/attachments/901.json",
    );
    expect(calls[0]!.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = new URLSearchParams(calls[0]!.body);
    expect(params.get("match_attachment[description]")).toBe("edited");
    expect(params.has("match_attachment[url]")).toBe(false);

    expect(a.description).toBe("edited");
  });
});

// ─── deleteAttachment ───────────────────────────────────────────────────────

describe("deleteAttachment", () => {
  test("DELETE to the member URL, no body, returns the echoed attachment", async () => {
    nextResponse = () => jsonResponse({ match_attachment: RAW });
    const a = await api.deleteAttachment(123, 555, 901);
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/123/matches/555/attachments/901.json",
    );
    expect(calls[0]!.body).toBeUndefined();
    expect(calls[0]!.headers["Content-Type"]).toBeUndefined();
    expect(a.id).toBe(901);
  });
});

// ─── string ids in the path ─────────────────────────────────────────────────

describe("string id args", () => {
  test("slug-style ids are interpolated verbatim", async () => {
    nextResponse = () => jsonResponse([]);
    await api.listAttachments("rpb-foo", "abc");
    expect(calls[0]!.url).toBe(
      "https://api.challonge.com/v1/tournaments/rpb-foo/matches/abc/attachments.json",
    );
  });
});
