/**
 * Unit tests for the Challonge v2.1 WRITE client (src/write.ts).
 *
 * Pure offline: globalThis.fetch is monkey-patched with a recording fake that
 * answers from a small route table. No network is touched. The original fetch
 * is restored in afterEach so test ordering / other suites are unaffected.
 *
 * Private methods (getOAuthToken / getHeaders / request) are exercised
 * indirectly through the public surface and asserted via the captured calls.
 */

import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import {
  ChallongeClient,
  getChallongeClient,
  type ApiResponse,
  type Match,
  type Participant,
  type Tournament,
} from "../src/write";

// ─── Fetch recorder ────────────────────────────────────────────────────────────

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const realFetch = globalThis.fetch;
let calls: RecordedCall[] = [];

function headersToObject(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  const h = new Headers(init);
  h.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Install a fake fetch driven by a route resolver. Each call is recorded
 * (url/method/headers/parsed-body) before the resolver decides the response.
 */
function installFetch(resolve: (call: RecordedCall) => Response): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = headersToObject(init?.headers);
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = { url, method, headers, body };
    calls.push(call);
    return resolve(call);
  }) as typeof fetch;
}

const TOKEN_PAYLOAD = {
  access_token: "tok-abc-123",
  token_type: "bearer",
  // created_at + expires_in → far in the future so the cache stays valid.
  created_at: Math.floor(Date.now() / 1000),
  expires_in: 7200,
};

/** Default resolver: OAuth token endpoint + generic JSON:API echo for the rest. */
function defaultResolver(call: RecordedCall): Response {
  if (call.url.endsWith("/oauth/token")) {
    return jsonResponse(TOKEN_PAYLOAD);
  }
  // Echo a plausible JSON:API envelope so parsing succeeds.
  return jsonResponse({
    data: { id: "1", type: "tournaments", attributes: {} },
  });
}

beforeEach(() => {
  calls = [];
  installFetch(defaultResolver);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function oauthClient(): ChallongeClient {
  return new ChallongeClient({
    clientId: "cid-test",
    clientSecret: "csecret-test",
    authType: "v2",
  });
}

// ─── getOAuthToken ───────────────────────────────────────────────────────────

describe("getOAuthToken (via OAuth flow)", () => {
  test("POSTs oauth/token with grant_type=client_credentials", async () => {
    const client = oauthClient();
    await client.listTournaments();

    const tokenCall = calls.find((c) => c.url.endsWith("/oauth/token"));
    expect(tokenCall).toBeDefined();
    expect(tokenCall!.method).toBe("POST");
    expect(tokenCall!.url).toBe("https://api.challonge.com/oauth/token");
    expect(tokenCall!.headers["content-type"]).toBe("application/x-www-form-urlencoded");

    const form = new URLSearchParams(tokenCall!.body as string);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("client_id")).toBe("cid-test");
    expect(form.get("client_secret")).toBe("csecret-test");
    expect(form.get("scope")).toContain("tournaments:write");
  });

  test("token is cached: a single oauth/token call across two requests", async () => {
    const client = oauthClient();
    await client.listTournaments();
    await client.listTournaments();

    const tokenCalls = calls.filter((c) => c.url.endsWith("/oauth/token"));
    expect(tokenCalls).toHaveLength(1);
  });

  test("throws when clientId/clientSecret missing in v2 mode", async () => {
    const client = new ChallongeClient({ authType: "v2" });
    await expect(client.listTournaments()).rejects.toThrow(
      "CHALLONGE_CLIENT_ID et CHALLONGE_CLIENT_SECRET requis pour OAuth 2.0",
    );
  });

  test("propagates an OAuth token error", async () => {
    installFetch((call) => {
      if (call.url.endsWith("/oauth/token")) {
        return new Response("bad creds", { status: 401 });
      }
      return defaultResolver(call);
    });
    const client = oauthClient();
    await expect(client.listTournaments()).rejects.toThrow("OAuth Token Error (401): bad creds");
  });
});

// ─── getHeaders ────────────────────────────────────────────────────────────────

describe("getHeaders", () => {
  test("v2: Authorization Bearer + Authorization-Type v2 + JSON:API content-type", async () => {
    const client = oauthClient();
    await client.listTournaments();

    const apiCall = calls.find((c) => c.url.startsWith("https://api.challonge.com/v2.1/"));
    expect(apiCall).toBeDefined();
    expect(apiCall!.headers["authorization"]).toBe("Bearer tok-abc-123");
    expect(apiCall!.headers["authorization-type"]).toBe("v2");
    expect(apiCall!.headers["content-type"]).toBe("application/vnd.api+json");
    expect(apiCall!.headers["accept"]).toBe("application/json");
  });

  test("v1: Authorization is the raw API key, Authorization-Type v1, no oauth call", async () => {
    const client = new ChallongeClient({
      apiKey: "raw-key-xyz",
      authType: "v1",
    });
    await client.listTournaments();

    expect(calls.find((c) => c.url.endsWith("/oauth/token"))).toBeUndefined();
    const apiCall = calls.find((c) => c.url.startsWith("https://api.challonge.com/v2.1/"));
    expect(apiCall).toBeDefined();
    expect(apiCall!.headers["authorization"]).toBe("raw-key-xyz");
    expect(apiCall!.headers["authorization-type"]).toBe("v1");
  });
});

// ─── listTournaments ─────────────────────────────────────────────────────────

describe("listTournaments", () => {
  test("GET /tournaments with no query when no params", async () => {
    const client = oauthClient();
    await client.listTournaments();

    const apiCall = calls.find((c) => c.url.includes("/v2.1/tournaments"));
    expect(apiCall!.method).toBe("GET");
    expect(apiCall!.url).toBe("https://api.challonge.com/v2.1/tournaments");
    expect(apiCall!.body).toBeUndefined();
  });

  test("encodes state/page/per_page into the query string", async () => {
    const client = oauthClient();
    await client.listTournaments({
      state: "in_progress",
      page: 2,
      per_page: 25,
    });

    const apiCall = calls.find((c) => c.url.includes("/v2.1/tournaments?"));
    expect(apiCall).toBeDefined();
    const u = new URL(apiCall!.url);
    expect(u.searchParams.get("state")).toBe("in_progress");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.get("per_page")).toBe("25");
  });

  test("parses the JSON:API envelope into ApiResponse<Tournament[]>", async () => {
    installFetch((call) => {
      if (call.url.endsWith("/oauth/token")) return jsonResponse(TOKEN_PAYLOAD);
      const payload: ApiResponse<Tournament[]> = {
        data: [
          {
            id: "42",
            type: "tournaments",
            attributes: {
              name: "RPB Cup",
              url: "rpb-cup",
              state: "pending",
              tournamentType: "double elimination",
              participantsCount: 8,
              startAt: null,
              completedAt: null,
              description: null,
              gameName: "Beyblade",
            },
          },
        ],
      };
      return jsonResponse(payload);
    });

    const client = oauthClient();
    const res = await client.listTournaments();
    expect(res.data).toHaveLength(1);
    expect(res.data[0]!.id).toBe("42");
    expect(res.data[0]!.attributes.name).toBe("RPB Cup");
  });
});

// ─── createTournament ──────────────────────────────────────────────────────────

describe("createTournament", () => {
  test("POSTs a JSON:API body with snake_case attributes and defaults", async () => {
    const client = oauthClient();
    await client.createTournament({ name: "Bey-Tamashii #5" });

    const apiCall = calls.find((c) => c.url.endsWith("/v2.1/tournaments") && c.method === "POST");
    expect(apiCall).toBeDefined();
    expect(apiCall!.url).toBe("https://api.challonge.com/v2.1/tournaments");

    const body = apiCall!.body as {
      data: { type: string; attributes: Record<string, unknown> };
    };
    expect(body.data.type).toBe("tournaments");
    expect(body.data.attributes.name).toBe("Bey-Tamashii #5");
    // Defaults applied by the client.
    expect(body.data.attributes.tournament_type).toBe("single elimination");
    expect(body.data.attributes.game_name).toBe("Beyblade");
    expect(body.data.attributes.open_signup).toBe(true);
  });

  test("forwards explicit options (tournamentType, gameName, signupCap, openSignup)", async () => {
    const client = oauthClient();
    await client.createTournament({
      name: "Swiss Open",
      tournamentType: "swiss",
      gameName: "Beyblade X",
      signupCap: 64,
      openSignup: false,
      description: "demo",
      startAt: "2026-06-01T18:00:00Z",
      url: "swiss-open",
    });

    const apiCall = calls.find((c) => c.url.endsWith("/v2.1/tournaments") && c.method === "POST");
    const attrs = (apiCall!.body as { data: { attributes: Record<string, unknown> } }).data
      .attributes;
    expect(attrs.tournament_type).toBe("swiss");
    expect(attrs.game_name).toBe("Beyblade X");
    expect(attrs.signup_cap).toBe(64);
    expect(attrs.open_signup).toBe(false);
    expect(attrs.description).toBe("demo");
    expect(attrs.start_at).toBe("2026-06-01T18:00:00Z");
    expect(attrs.url).toBe("swiss-open");
  });
});

// ─── updateMatch ─────────────────────────────────────────────────────────────

describe("updateMatch", () => {
  test("PUTs match scores with type 'matches' and snake_case attributes", async () => {
    installFetch((call) => {
      if (call.url.endsWith("/oauth/token")) return jsonResponse(TOKEN_PAYLOAD);
      const payload: ApiResponse<Match> = {
        data: {
          id: "999",
          type: "matches",
          attributes: {
            round: 1,
            state: "complete",
            player1Id: "p1",
            player2Id: "p2",
            winnerId: "p1",
            loserId: "p2",
            scores: "3-2",
            underwayAt: null,
          },
        },
      };
      return jsonResponse(payload);
    });

    const client = oauthClient();
    const res = await client.updateMatch("t-1", "m-99", {
      winnerId: "p1",
      scoresCsv: "3-2",
    });

    const apiCall = calls.find((c) => c.url.includes("/matches/m-99") && c.method === "PUT");
    expect(apiCall).toBeDefined();
    expect(apiCall!.url).toBe("https://api.challonge.com/v2.1/tournaments/t-1/matches/m-99");

    const body = apiCall!.body as {
      data: { type: string; attributes: Record<string, unknown> };
    };
    expect(body.data.type).toBe("matches");
    expect(body.data.attributes.winner_id).toBe("p1");
    expect(body.data.attributes.scores_csv).toBe("3-2");

    expect(res.data.attributes.winnerId).toBe("p1");
    expect(res.data.attributes.scores).toBe("3-2");
  });
});

// ─── checkInParticipant ────────────────────────────────────────────────────────

describe("checkInParticipant", () => {
  test("PUTs checked_in:true on the participant", async () => {
    installFetch((call) => {
      if (call.url.endsWith("/oauth/token")) return jsonResponse(TOKEN_PAYLOAD);
      const payload: ApiResponse<Participant> = {
        data: {
          id: "p-7",
          type: "participants",
          attributes: {
            name: "Aphrody",
            seed: 1,
            active: true,
            checkedIn: true,
            groupPlayerIds: [],
          },
        },
      };
      return jsonResponse(payload);
    });

    const client = oauthClient();
    const res = await client.checkInParticipant("t-1", "p-7");

    const apiCall = calls.find((c) => c.url.includes("/participants/p-7") && c.method === "PUT");
    expect(apiCall).toBeDefined();
    expect(apiCall!.url).toBe("https://api.challonge.com/v2.1/tournaments/t-1/participants/p-7");
    const body = apiCall!.body as {
      data: { type: string; attributes: Record<string, unknown> };
    };
    expect(body.data.type).toBe("participants");
    expect(body.data.attributes.checked_in).toBe(true);

    expect(res.data.attributes.checkedIn).toBe(true);
  });

  test("undoCheckInParticipant PUTs checked_in:false", async () => {
    const client = oauthClient();
    await client.undoCheckInParticipant("t-1", "p-7");

    const apiCall = calls.find((c) => c.url.includes("/participants/p-7") && c.method === "PUT");
    const body = apiCall!.body as {
      data: { attributes: Record<string, unknown> };
    };
    expect(body.data.attributes.checked_in).toBe(false);
  });
});

// ─── bulkCreateParticipants ────────────────────────────────────────────────────

describe("bulkCreateParticipants", () => {
  test("POSTs an array of participant resources to bulk_add", async () => {
    const client = oauthClient();
    await client.bulkCreateParticipants("t-1", [
      { name: "A", seed: 1, misc: "111" },
      { name: "B", seed: 2 },
    ]);

    const apiCall = calls.find((c) => c.url.endsWith("/participants/bulk_add"));
    expect(apiCall).toBeDefined();
    expect(apiCall!.method).toBe("POST");
    const body = apiCall!.body as {
      data: Array<{ type: string; attributes: Record<string, unknown> }>;
    };
    expect(body.data).toHaveLength(2);
    expect(body.data[0]!.type).toBe("participants");
    expect(body.data[0]!.attributes.name).toBe("A");
    expect(body.data[0]!.attributes.misc).toBe("111");
    expect(body.data[1]!.attributes.name).toBe("B");
  });
});

// ─── error propagation on API calls ─────────────────────────────────────────────

describe("request error handling", () => {
  test("throws Challonge API Error with status + body on non-ok response", async () => {
    installFetch((call) => {
      if (call.url.endsWith("/oauth/token")) return jsonResponse(TOKEN_PAYLOAD);
      return new Response("not found", { status: 404 });
    });
    const client = oauthClient();
    await expect(client.getTournament("nope")).rejects.toThrow(
      "Challonge API Error (404): not found",
    );
  });
});

// ─── getChallongeClient factory ────────────────────────────────────────────────

describe("getChallongeClient factory", () => {
  const saved = {
    id: process.env.CHALLONGE_CLIENT_ID,
    secret: process.env.CHALLONGE_CLIENT_SECRET,
    key: process.env.CHALLONGE_API_KEY,
  };

  afterEach(() => {
    if (saved.id === undefined) delete process.env.CHALLONGE_CLIENT_ID;
    else process.env.CHALLONGE_CLIENT_ID = saved.id;
    if (saved.secret === undefined) delete process.env.CHALLONGE_CLIENT_SECRET;
    else process.env.CHALLONGE_CLIENT_SECRET = saved.secret;
    if (saved.key === undefined) delete process.env.CHALLONGE_API_KEY;
    else process.env.CHALLONGE_API_KEY = saved.key;
  });

  test("returns a ChallongeClient when OAuth creds are present", () => {
    process.env.CHALLONGE_CLIENT_ID = "factory-id";
    process.env.CHALLONGE_CLIENT_SECRET = "factory-secret";
    const client = getChallongeClient();
    expect(client).toBeInstanceOf(ChallongeClient);
    // Singleton: same instance on a second call.
    expect(getChallongeClient()).toBe(client);
  });
});
