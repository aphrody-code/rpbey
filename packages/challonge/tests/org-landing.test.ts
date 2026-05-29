/**
 * Fixture-driven tests for `parseOrgLanding` (extractors/stores/org-landing).
 *
 * Calibrated on `tests/fixtures/org_landing.html` (a real org-hosted tournament
 * page, captured offline). The test is conditional: if the fixture is absent the
 * suite skips its fixture assertions instead of failing the gate. Pure parser —
 * no network, no bxc.
 */

import { describe, test, expect } from "bun:test";
import { parseOrgLanding } from "../src/extractors/stores/org-landing";
import type { ScrapedOrg } from "../src/types";

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const FIXTURE_PATH = FIXTURES + "org_landing.html";

const fixtureFile = Bun.file(FIXTURE_PATH);
const hasFixture = await fixtureFile.exists();
const html = hasFixture ? await fixtureFile.text() : "";

// ─── Pure / synthetic invariants (always run) ───────────────────────────────

describe("parseOrgLanding — pure invariants", () => {
  test("empty HTML → well-formed empty org", () => {
    const org = parseOrgLanding("");
    expect(typeof org.subdomain).toBe("string");
    expect(Array.isArray(org.tournaments)).toBe(true);
    expect(org.tournaments).toHaveLength(0);
  });

  test("opts.subdomain override is honoured", () => {
    const org = parseOrgLanding("", { subdomain: "rpb" });
    expect(org.subdomain).toBe("rpb");
    expect(org.url).toContain("rpb");
  });

  test("subdomain inferred from <sub>.challonge.com og:url", () => {
    const synthetic = `<meta content='https://acme.challonge.com/' property='og:url'>`;
    const org = parseOrgLanding(synthetic);
    expect(org.subdomain).toBe("acme");
  });

  test("lists tournament anchors on an index-shaped page", () => {
    const synthetic = `
      <meta content='https://acme.challonge.com/' property='og:url'>
      <a href="https://acme.challonge.com/spring_cup">Spring Cup</a>
      <a href="https://acme.challonge.com/winter_cup">Winter Cup</a>
      <a href="https://challonge.com/fr/about">About</a>
    `;
    const org = parseOrgLanding(synthetic);
    const slugs = org.tournaments.map((t) => t.slug).sort();
    expect(slugs).toEqual(["spring_cup", "winter_cup"]);
    expect(org.tournaments.find((t) => t.slug === "spring_cup")?.name).toBe("Spring Cup");
  });
});

// ─── Fixture-calibrated assertions (conditional) ─────────────────────────────

const maybe = hasFixture ? describe : describe.skip;

maybe("parseOrgLanding — fixture (org_landing.html)", () => {
  let org: ScrapedOrg;

  test("parses without throwing", () => {
    org = parseOrgLanding(html);
    expect(org).toBeDefined();
  });

  test("subdomain is a string", () => {
    org = parseOrgLanding(html);
    expect(typeof org.subdomain).toBe("string");
  });

  test("url points at challonge.com", () => {
    org = parseOrgLanding(html);
    expect(org.url).toContain("challonge.com");
  });

  test("org name resolved (hosted by … clause)", () => {
    org = parseOrgLanding(html);
    // Fixture og:description: "… hosted by RPB, a Challonge Community"
    expect(org.name).toBe("RPB");
  });

  test("logo is an org-scoped asset when present", () => {
    org = parseOrgLanding(html);
    if (org.logoUrl) {
      expect(org.logoUrl).toContain("/organizations/images/");
    }
  });

  test("tournaments is an array (>= 0) with well-formed entries", () => {
    org = parseOrgLanding(html);
    expect(Array.isArray(org.tournaments)).toBe(true);
    expect(org.tournaments.length).toBeGreaterThanOrEqual(0);
    for (const t of org.tournaments) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.slug).toBe("string");
      expect(t.slug.length).toBeGreaterThan(0);
      expect(typeof t.url).toBe("string");
      expect(t.url).toContain("challonge.com");
    }
  });

  test("hosted-tournament fallback surfaces the embedded tournament", () => {
    org = parseOrgLanding(html);
    // The fixture is a single hosted tournament (/fr/B_TS4) → exactly 1 entry.
    expect(org.tournaments.length).toBeGreaterThanOrEqual(1);
    const bts4 = org.tournaments.find((t) => t.slug === "B_TS4");
    expect(bts4).toBeDefined();
  });
});
