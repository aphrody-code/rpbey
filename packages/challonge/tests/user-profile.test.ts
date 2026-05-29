/**
 * user-profile extractor — golden test against the offline fixture.
 *
 * Loads `tests/fixtures/user_profile.html` (real Challonge `/users/{username}`
 * page captured offline, user `Vincent___`) and asserts `parseUserProfile`
 * returns a coherent `ScrapedUserProfile`.
 *
 * The whole suite is skipped when the fixture is absent (parity with the
 * libcurl/cookie smoke tests) so the gate never fails on a missing capture.
 *
 * No network — pure parse of a disk fixture.
 */

import { describe, test, expect } from "bun:test";
import { parseUserProfile } from "../src/extractors/stores/user-profile.ts";

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const FIXTURE = FIXTURES + "user_profile.html";

const hasFixture = await Bun.file(FIXTURE).exists();

describe.skipIf(!hasFixture)("parseUserProfile (fixture)", () => {
  test("returns username + at least one non-null field", async () => {
    const html = await Bun.file(FIXTURE).text();
    const profile = parseUserProfile(html);

    // Username always present (recovered from canonical links / display name).
    expect(profile.username.length).toBeGreaterThan(0);
    expect(profile.profileUrl).toContain("/users/");

    // At least one descriptive field is non-null.
    const nonNull = [
      profile.displayName,
      profile.avatarUrl,
      profile.location,
      profile.bio,
      profile.memberSince,
    ].filter((v) => v != null && v !== "");
    expect(nonNull.length).toBeGreaterThanOrEqual(1);
  });

  test("calibrated fields match the captured profile", async () => {
    const html = await Bun.file(FIXTURE).text();
    const profile = parseUserProfile(html);

    // Canonical-cased handle recovered from hreflang links.
    expect(profile.username).toBe("Vincent___");
    expect(profile.displayName).toBe("Vincent___");
    expect(profile.profileUrl).toBe("https://challonge.com/users/Vincent___");

    // Avatar is the Gravatar fallback (protocol normalized to https).
    expect(profile.avatarUrl).toMatch(/^https:\/\//);
    expect(profile.avatarUrl).toContain("gravatar.com");

    // "Member since October 2025" banner label → date portion captured.
    expect(profile.memberSince).toBe("October 2025");

    // Top Finishes medal tally: 1 gold, 0 silver, 0 bronze.
    expect(profile.medals).toEqual({ gold: 1, silver: 0, bronze: 0 });

    // Overview tab carries no per-tournament history list.
    expect(Array.isArray(profile.tournamentHistory)).toBe(true);
  });

  test("respects an explicit opts.username override", async () => {
    const html = await Bun.file(FIXTURE).text();
    const profile = parseUserProfile(html, { username: "Vincent___" });
    expect(profile.username).toBe("Vincent___");
    expect(profile.profileUrl).toBe("https://challonge.com/users/Vincent___");
  });
});

describe("parseUserProfile (defensive)", () => {
  test("empty HTML yields a safe all-null profile", () => {
    const profile = parseUserProfile("<html><body></body></html>", {
      username: "ghost",
    });
    expect(profile.username).toBe("ghost");
    expect(profile.displayName).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.medals).toEqual({ gold: 0, silver: 0, bronze: 0 });
    expect(profile.tournamentHistory).toEqual([]);
    expect(profile.profileUrl).toBe("https://challonge.com/users/ghost");
  });
});
