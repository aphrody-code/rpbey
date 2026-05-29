/**
 * Endpoints scraping Challonge (W2B refacto Vercel).
 *
 * Replique de :
 *  - `lib/scrapers/challonge-scraper` (POST `/api/scrape/challonge/:slug`)
 *  - `scripts/dump-challonge-log.ts` (GET `/api/scrape/challonge/:slug/log`)
 *  - `scripts/dump-challonge-module.ts` (GET `/api/scrape/challonge/:slug/module`)
 *
 * Phase 4 : uses dumpChallongeRaw from @rose-griffon/challonge workspace dep
 * instead of the stale services/challonge local duplicate.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { ChallongeScraper, dumpChallongeRaw } from "@rose-griffon/challonge";

import { logger } from "../../lib/logger.js";

import {
  errorResponse,
  extractSlug,
  jsonResponse,
  optionsHandler,
  readJsonBody,
  withAuth,
} from "./_helpers.js";

interface ScrapeChallongeBody {
  slug?: string;
  options?: {
    withStandings?: boolean;
    withStations?: boolean;
    withLog?: boolean;
    withParticipants?: boolean;
  };
}

const scrapeChallonge = withAuth<{ slug: string }>(async (req) => {
  const slugParam = extractSlug(req.params.slug);
  const { body, error } = await readJsonBody<ScrapeChallongeBody>(req);
  if (error) return error;

  const opts = body.options ?? {
    withStandings: true,
    withStations: true,
    withLog: true,
    withParticipants: true,
  };

  const scraper = new ChallongeScraper({
    log: (m: string) => logger.info({ slug: slugParam }, `[scrape] ${m}`),
  });
  try {
    const scraped = await scraper.scrape(slugParam, opts);
    return jsonResponse({
      ok: true,
      raw: scraped,
      parsed: {
        metadata: scraped.metadata,
        participantsCount: scraped.participants.length,
        matchesCount: scraped.matches.length,
        standingsCount: scraped.standings.length,
      },
    });
  } finally {
    await scraper.close().catch(() => {});
  }
});

const dumpLog = withAuth<{ slug: string }>(async (req) => {
  const slugParam = extractSlug(req.params.slug);

  const { html, store } = await dumpChallongeRaw(slugParam, "log");

  // Extract log entries from the parsed store.
  const logStore =
    (store["LogEntryListStore"] as Record<string, unknown> | null) ??
    (store["LogStore"] as Record<string, unknown> | null) ??
    (store["ActivityStore"] as Record<string, unknown> | null);
  const entries = Array.isArray(logStore?.["entries"])
    ? (logStore["entries"] as unknown[])
    : Array.isArray(logStore?.["log"])
      ? (logStore["log"] as unknown[])
      : [];

  const rows = {
    sel: entries.length > 0 ? "store:LogEntryListStore.entries" : null,
    html: [] as string[],
    text: entries.map((e) => {
      const entry = e as Record<string, unknown>;
      return String(entry["message"] ?? entry["description"] ?? entry["text"] ?? "");
    }),
  };

  // Persist dump on disk for audit (optional — ignore failure).
  try {
    const dumpDir = path.join(process.cwd(), "data/scrapes");
    await mkdir(dumpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await Bun.write(path.join(dumpDir, `${slugParam}_log_${stamp}.html`), html);
    await Bun.write(
      path.join(dumpDir, `${slugParam}_log_${stamp}.parsed.json`),
      JSON.stringify(rows, null, 2),
    );
  } catch (e) {
    logger.warn({ err: e }, "[log] dump failed");
  }

  return jsonResponse({
    ok: true,
    log: rows,
    htmlLength: html.length,
  });
});

const dumpModule = withAuth<{ slug: string }>(async (req) => {
  const slugParam = extractSlug(req.params.slug);

  const { html } = await dumpChallongeRaw(slugParam, "module");

  // Reconstruct inventory by regex on the raw HTML — same shape as before.
  const reactComponents = [...html.matchAll(/data-react-class="([^"]+)"/g)]
    .map((m) => m[1] as string)
    .filter(Boolean)
    .sort()
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  const classAttr = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) =>
    (m[1] as string).split(/\s+/).filter(Boolean),
  );
  const classSet = [...new Set(classAttr)].sort();

  const dataAttrNames = [
    ...new Set([...html.matchAll(/\s(data-[a-z][a-z0-9-]*)=/g)].map((m) => m[1] as string)),
  ].sort();

  const groupBracketRe = /group|bracket|round|match|stage|pool|final/i;
  const matchGameScoreRe = /match|game|score/i;

  const inventory = {
    reactComponents,
    classGroupBracket: classSet.filter((c) => groupBracketRe.test(c)),
    classMatch: classSet.filter((c) => matchGameScoreRe.test(c)),
    dataAttrs: dataAttrNames,
  };

  return jsonResponse({
    ok: true,
    module: { inventory, htmlLength: html.length },
  });
});

export function getScrapeRoutes() {
  return {
    "/api/scrape/challonge/:slug": {
      POST: scrapeChallonge,
      OPTIONS: optionsHandler,
    },
    "/api/scrape/challonge/:slug/log": {
      GET: dumpLog,
      OPTIONS: optionsHandler,
    },
    "/api/scrape/challonge/:slug/module": {
      GET: dumpModule,
      OPTIONS: optionsHandler,
    },
  };
}

// Export pour tests unitaires eventuels.
export { scrapeChallonge, dumpLog, dumpModule, errorResponse };
