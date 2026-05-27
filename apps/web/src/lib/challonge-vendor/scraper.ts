/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Challonge HTML scraper — Cloudflare-resilient.
 *
 * Improvements over v1:
 *  - Optional `rebrowser-puppeteer-core` to fix the `Runtime.enable` leak
 *    detected by Cloudflare/DataDome (toggled via env CHALLONGE_USE_REBROWSER).
 *  - Realistic headers (UA, Sec-CH-UA, Accept-Language) + viewport sized.
 *  - `waitForFunction` instead of magic `setTimeout`s.
 *  - Retry with exponential backoff on transient failures.
 *  - Cookie validity check before launch — fail fast on expired session.
 *  - Browser/page reuse for multi-tournament scrapes (no per-page launch).
 *  - Aggressive request blocking (images/fonts/ads) to speed up loads 5×.
 *  - Lazy-load only what's asked (skip /standings if `withStandings: false`).
 */

import type { Browser, CookieParam, Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { normalizeSets, setsToLegacyString, type SetScore } from "./scores";
import {
  isSessionCookieValid,
  loadCookieJar,
  resolveDefaultCookiePath,
  type PuppeteerCookie,
  type RawCookie,
} from "./utils/cookies";
import { isTransientHttpError, retry, sleep } from "./utils/retry";
import type {
  ScrapedLogEntry,
  ScrapedMatch,
  ScrapedParticipant,
  ScrapedStanding,
  ScrapedStation,
  ScrapedTournament,
} from "./types";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

(puppeteerExtra as any).use(StealthPlugin());

// ─── Public types ────────────────────────────────────────────────────────────

export type ChallongeScraperOptions =
  | string
  | {
      /** Absolute path to the Challonge cookie jar JSON. */
      cookiePath?: string;
      /** Override the User-Agent (default: modern Chrome 130). */
      userAgent?: string;
      /** Use rebrowser-puppeteer-core (recommended on hardened CF). */
      useRebrowser?: boolean;
      /** Headless mode. Default true. */
      headless?: boolean | "shell" | "new";
      /** Viewport size. Default 1920×1080. */
      viewport?: { width: number; height: number };
      /** Block images/fonts/ads to speed up loads. Default true. */
      blockResources?: boolean;
      /** Per-page navigation timeout (ms). Default 60_000. */
      navigationTimeoutMs?: number;
      /** Logger hook. */
      log?: (msg: string) => void;
    };

export interface ScrapeOptions {
  withStandings?: boolean;
  withStations?: boolean;
  withLog?: boolean;
  withParticipants?: boolean;
  signal?: AbortSignal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUIET_LOG: (msg: string) => void = () => {};

interface ResolvedOptions {
  cookiePath: string | null;
  userAgent: string;
  useRebrowser: boolean;
  headless: boolean | "shell" | "new";
  viewport: { width: number; height: number };
  blockResources: boolean;
  navigationTimeoutMs: number;
  log: (msg: string) => void;
}

function resolveOptions(opts: ChallongeScraperOptions = {}): ResolvedOptions {
  const o = typeof opts === "string" ? { cookiePath: opts } : opts;
  const cookiePath = o.cookiePath ?? resolveDefaultCookiePath();
  return {
    cookiePath,
    userAgent: o.userAgent ?? DEFAULT_USER_AGENT,
    useRebrowser: o.useRebrowser ?? process.env.CHALLONGE_USE_REBROWSER === "1",
    headless: o.headless ?? true,
    viewport: o.viewport ?? { width: 1920, height: 1080 },
    blockResources: o.blockResources ?? true,
    navigationTimeoutMs: o.navigationTimeoutMs ?? 60_000,
    log: o.log ?? QUIET_LOG,
  };
}

async function buildPuppeteer(useRebrowser: boolean): Promise<typeof puppeteerExtra> {
  if (!useRebrowser) return puppeteerExtra;
  try {
    const { addExtra } = await import("puppeteer-extra");
    const rebrowserMod = await import("rebrowser-puppeteer-core");
    const rebrowserPuppeteer = (rebrowserMod as any).default ?? rebrowserMod;
    const wrapped = (addExtra as any)(rebrowserPuppeteer);
    (wrapped as any).use(StealthPlugin());
    return wrapped as typeof puppeteerExtra;
  } catch (err) {
    console.warn(
      `⚠️  rebrowser-puppeteer-core not available, falling back to puppeteer-extra: ${(err as Error).message}`,
    );
    return puppeteerExtra;
  }
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

export class ChallongeScraper {
  private browser: Browser | null = null;
  private cookies: PuppeteerCookie[] = [];
  private rawCookies: RawCookie[] = [];
  private readonly opts: ResolvedOptions;

  constructor(options: ChallongeScraperOptions = {}) {
    this.opts = resolveOptions(options);
    if (this.opts.cookiePath) {
      const jar = loadCookieJar(this.opts.cookiePath);
      this.cookies = jar.forPuppeteer;
      this.rawCookies = jar.raw;
      this.opts.log(`✓ Loaded ${this.cookies.length} cookies from ${this.opts.cookiePath}`);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.browser) return;
    if (this.cookies.length > 0 && !isSessionCookieValid(this.rawCookies)) {
      throw new Error(
        "Challonge session cookie missing or malformed — refresh storage/cookies/challonge_cookie.json.",
      );
    }
    const puppeteer = await buildPuppeteer(this.opts.useRebrowser);
    this.browser = (await (puppeteer as any).launch({
      headless: this.opts.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-first-run",
        "--no-default-browser-check",
        `--window-size=${this.opts.viewport.width},${this.opts.viewport.height}`,
      ],
      defaultViewport: this.opts.viewport,
    })) as unknown as Browser;
    this.opts.log(
      `✓ Browser launched (${this.opts.useRebrowser ? "rebrowser" : "puppeteer-extra"}, headless=${String(this.opts.headless)})`,
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ── Page setup ───────────────────────────────────────────────────────────

  private async newPage(): Promise<Page> {
    if (!this.browser) await this.init();
    if (!this.browser) throw new Error("Browser failed to start.");
    const page = await this.browser.newPage();

    await page.setUserAgent(this.opts.userAgent);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
    });

    if (this.cookies.length > 0) {
      await page.setCookie(...(this.cookies as CookieParam[]));
    }

    if (this.opts.blockResources) {
      await page.setRequestInterception(true);
      page.on("request", (req: any) => {
        const t = req.resourceType();
        if (t === "image" || t === "media" || t === "font" || t === "stylesheet") {
          req.abort();
          return;
        }
        const url: string = req.url();
        if (
          url.includes("googletagmanager") ||
          url.includes("google-analytics") ||
          url.includes("doubleclick") ||
          url.includes("nitropay") ||
          url.includes("crwdcntrl") ||
          url.includes("amazon-adsystem")
        ) {
          req.abort();
          return;
        }
        req.continue();
      });
    }

    return page;
  }

  private async openPage(url: string, signal?: AbortSignal): Promise<Page> {
    return retry(
      async (attempt) => {
        const page = await this.newPage();
        try {
          this.opts.log(`→ GET ${url} (attempt ${attempt})`);
          const resp = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: this.opts.navigationTimeoutMs,
          });
          const status = resp?.status() ?? 0;
          if (status === 403 || status === 429 || status >= 500) {
            const title = await page.title().catch(() => "");
            await page.close().catch(() => {});
            const err = new Error(`HTTP ${status} on ${url} (title="${title}")`);
            (err as any).status = status;
            throw err;
          }
          return page;
        } catch (err) {
          await page.close().catch(() => {});
          throw err;
        }
      },
      {
        attempts: 3,
        baseDelayMs: 1500,
        maxDelayMs: 12_000,
        shouldRetry: (err) => isTransientHttpError(err),
        signal,
      },
    );
  }

  // ── Store extraction ─────────────────────────────────────────────────────

  private async extractStore(page: Page, key?: string): Promise<any> {
    return page.evaluate(`
      (function() {
        try {
          var s = window._initialStoreState;
          if (!s) return null;
          ${key ? `return s['${key}'] || null;` : "return s;"}
        } catch(e) { return null; }
      })()
    `);
  }

  private async waitForStore(page: Page, timeoutMs = 10_000): Promise<void> {
    try {
      await page.waitForFunction(
        () => {
          const s = (window as any)._initialStoreState;
          return s && (s.TournamentStore || s.tournamentStore);
        },
        { timeout: timeoutMs },
      );
    } catch {
      // Page might not have a store at all (e.g. /log) — that's OK, callers
      // will fall back to DOM scraping.
    }
  }

  // ── Main scrape ──────────────────────────────────────────────────────────

  async scrape(urlIdOrSlug: string, options: ScrapeOptions = {}): Promise<ScrapedTournament> {
    const {
      withStandings = true,
      withStations = true,
      withLog = true,
      withParticipants = true,
      signal,
    } = options;

    if (!this.browser) await this.init();

    const slug = urlIdOrSlug.replace("https://challonge.com/", "").replace(/^\//, "");
    const baseUrl = `https://challonge.com/${slug}`;
    this.opts.log(`🔍 Scraping ${slug}`);

    const storeData = await this.fetchStoreData(`${baseUrl}/module`, signal);

    const tasks: Array<Promise<unknown>> = [];
    let participantsPageData: any[] = [];
    let standings: ScrapedStanding[] = [];
    let stations: ScrapedStation[] = [];
    let log: ScrapedLogEntry[] = [];

    if (withParticipants) {
      tasks.push(
        this.fetchParticipants(`${baseUrl}/participants`, signal)
          .then((d) => {
            participantsPageData = d;
          })
          .catch((err) => this.opts.log(`⚠️  /participants: ${(err as Error).message}`)),
      );
    }
    if (withStandings) {
      tasks.push(
        this.fetchStandings(`${baseUrl}/standings`, signal)
          .then((d) => {
            standings = d;
          })
          .catch((err) => this.opts.log(`⚠️  /standings: ${(err as Error).message}`)),
      );
    }
    if (withStations) {
      tasks.push(
        this.fetchStations(`${baseUrl}/stations`, signal)
          .then((d) => {
            stations = d;
          })
          .catch((err) => this.opts.log(`⚠️  /stations: ${(err as Error).message}`)),
      );
    }
    if (withLog) {
      tasks.push(
        this.fetchLog(`${baseUrl}/log`, signal)
          .then((d) => {
            log = d;
          })
          .catch((err) => this.opts.log(`⚠️  /log: ${(err as Error).message}`)),
      );
    }
    await Promise.all(tasks);

    return this.processData(storeData, participantsPageData, standings, stations, log, baseUrl);
  }

  // ── Page fetchers ────────────────────────────────────────────────────────

  private async fetchStoreData(url: string, signal?: AbortSignal): Promise<any> {
    const page = await this.openPage(url, signal);
    try {
      await this.waitForStore(page);
      const data = await this.extractStore(page, "TournamentStore");
      if (!data) {
        const title = await page.title().catch(() => "");
        throw new Error(`Store not found (title="${title}"). Cloudflare or login wall.`);
      }
      return data;
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async fetchParticipants(url: string, signal?: AbortSignal): Promise<any[]> {
    const page = await this.openPage(url, signal);
    try {
      const intercepted: any[] = [];
      page.on("response", async (response: any) => {
        try {
          const resUrl: string = response.url();
          if (
            response.status() === 200 &&
            (resUrl.includes("/participants") || resUrl.includes("/tournament")) &&
            response.headers()["content-type"]?.includes("json")
          ) {
            const json = await response.json();
            const arr =
              json?.participants || json?.data?.participants || (Array.isArray(json) ? json : null);
            if (arr?.length) intercepted.push(...arr);
          }
        } catch {
          /* non-JSON body */
        }
      });

      // Wait for either the React/management container or the table to show up
      await page
        .waitForSelector("#participant-management, table tbody tr", {
          timeout: 15_000,
        })
        .catch(() => {});

      // Server-rendered data attributes
      const serverData = (await page.evaluate(`
        (function() {
          var el = document.getElementById('participant-management');
          if (!el) return null;
          var t = null, r = null;
          try { t = JSON.parse(el.getAttribute('data-tournament') || 'null'); } catch(e) {}
          try { r = JSON.parse(el.getAttribute('data-rankings') || 'null'); } catch(e) {}
          return { tournament: t, rankings: r };
        })()
      `)) as { tournament: any; rankings: any[] } | null;

      if (intercepted.length > 0) {
        return intercepted.map(normalizeParticipant);
      }

      // DOM fallback
      const reactParticipants = (await page.evaluate(`
        (function() {
          var c = document.getElementById('participant-management');
          if (!c) return [];
          var rows = Array.from(c.querySelectorAll('tr, [class*="participant"], [class*="Participant"], [role="row"], li'));
          if (rows.length === 0) return [];
          return rows.map(function(row, i) {
            var text = row.textContent.trim();
            if (!text || text.length < 2) return null;
            var link = row.querySelector('a[href*="/users/"]');
            var pUrl = link ? link.href : null;
            var u = null;
            if (pUrl) {
              var parts = pUrl.split('/users/');
              u = parts.length > 1 ? parts[1].split('/')[0].split('?')[0] : null;
            }
            var name = (link ? link.textContent : text.split('\\n')[0]).trim();
            name = name.replace(/✅/g, '').replace(/^\\d+\\.?\\s*/, '').trim();
            if (!name || name.length < 2) return null;
            var seedMatch = text.match(/^(\\d+)/);
            var seed = seedMatch ? parseInt(seedMatch[1], 10) : i + 1;
            return { display_name: name, seed: seed, challongeUsername: u, challongeProfileUrl: pUrl };
          }).filter(function(x) { return x && x.display_name; });
        })()
      `)) as any[];

      if (reactParticipants?.length > 0) return reactParticipants.map(normalizeParticipant);

      // Last resort: read the store
      const store = await this.extractStore(page);
      const candidates =
        store?.TournamentStore?.participants ||
        store?.TournamentStore?.tournament?.participants ||
        store?.ParticipantsStore?.participants ||
        (Array.isArray(store?.ParticipantsStore) ? store.ParticipantsStore : null);
      if (candidates?.length > 0) return candidates.map(normalizeParticipant);

      if (serverData?.rankings?.length) return serverData.rankings.map(normalizeParticipant);
      return [];
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async fetchStandings(url: string, signal?: AbortSignal): Promise<ScrapedStanding[]> {
    const page = await this.openPage(url, signal);
    try {
      await this.waitForStore(page, 4000);
      const store = await this.extractStore(page);
      const storeStandings = store?.StandingsStore?.standings || store?.TournamentStore?.standings;
      if (storeStandings?.length > 0) {
        return storeStandings.map((s: any, i: number) => ({
          rank: s.rank ?? s.final_rank ?? i + 1,
          name: (s.display_name || s.name || "").trim().replace("✅", ""),
          challongeUsername: s.username || s.challonge_username || null,
          challongeProfileUrl: s.username ? `https://challonge.com/users/${s.username}` : null,
          wins: s.wins ?? s.match_wins ?? 0,
          losses: s.losses ?? s.match_losses ?? 0,
          stats: s,
        }));
      }

      // DOM table fallback
      await page.waitForSelector("table tbody tr", { timeout: 5000 }).catch(() => {});

      const rows = (await page.evaluate(`
        (function() {
          var rows = Array.from(document.querySelectorAll('table tbody tr'));
          return rows.map(function(row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 2) return null;
            var rank = parseInt(cells[0].innerText.trim().replace('.', ''), 10);
            var nameCell = cells[1];
            var link = nameCell.querySelector('a[href*="/users/"]');
            var name = nameCell.innerText.trim().replace('✅', '');
            var pUrl = link ? link.href : null;
            var u = null;
            if (pUrl) {
              var parts = pUrl.split('/users/');
              u = parts.length > 1 ? parts[1].split('/')[0].split('?')[0] : null;
            }
            var wins = 0, losses = 0;
            for (var i = 2; i < cells.length; i++) {
              var t = cells[i].innerText.trim();
              var wl = t.match(/^(\\d+)\\s*[-–]\\s*(\\d+)$/);
              if (wl) { wins = parseInt(wl[1], 10); losses = parseInt(wl[2], 10); break; }
            }
            return { rank: rank, name: name, challongeUsername: u, challongeProfileUrl: pUrl, wins: wins, losses: losses };
          }).filter(function(x) { return x && x.name; });
        })()
      `)) as Array<Omit<ScrapedStanding, "stats">>;

      return rows.map((r) => ({ ...r, stats: { wins: r.wins, losses: r.losses } }));
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async fetchStations(url: string, signal?: AbortSignal): Promise<ScrapedStation[]> {
    const page = await this.openPage(url, signal);
    try {
      await this.waitForStore(page, 4000);
      const store = await this.extractStore(page);
      const storeStations = store?.StationsStore?.stations || store?.TournamentStore?.stations;
      if (storeStations?.length > 0) {
        return storeStations.map((s: any) => {
          const raw = s.current_match || s.match;
          const sets: SetScore[] = raw ? normalizeSets(raw.scores) : [];
          return {
            stationId: s.id ?? s.station_id ?? s.number,
            name: s.name || s.label || `Station ${s.number ?? s.id}`,
            currentMatch: raw
              ? {
                  matchId: raw.id,
                  identifier: raw.identifier || "",
                  round: raw.round || 0,
                  player1: raw.player1?.display_name || null,
                  player2: raw.player2?.display_name || null,
                  scores: setsToLegacyString(sets),
                  sets,
                  state: raw.state || "open",
                }
              : null,
            status:
              s.state === "active" || s.current_match
                ? "active"
                : s.state === "paused"
                  ? "paused"
                  : "idle",
          } satisfies ScrapedStation;
        });
      }
      return [];
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async fetchLog(url: string, signal?: AbortSignal): Promise<ScrapedLogEntry[]> {
    const page = await this.openPage(url, signal);
    try {
      await this.waitForStore(page, 4000);
      const store = await this.extractStore(page);
      const ls = store?.LogStore || store?.ActivityStore;
      const storeLog =
        ls?.entries ||
        ls?.log ||
        store?.TournamentStore?.log ||
        store?.TournamentStore?.activity_log;
      if (storeLog?.length > 0) {
        return storeLog.map((entry: any) => ({
          timestamp: entry.created_at || entry.timestamp || entry.date || "",
          type: entry.type || entry.action || entry.event_type || "unknown",
          message: entry.message || entry.description || entry.text || JSON.stringify(entry),
          raw: entry,
        }));
      }

      // Specific Challonge log table layout. The log lives in a table with
      // 3 columns: when | who | event. Fallback to that BEFORE generic DOM.
      await page
        .waitForSelector("main table tbody tr, .log-table tbody tr", { timeout: 5000 })
        .catch(() => {});

      const tableLog = (await page.evaluate(`
        (function() {
          var sels = [
            'main table tbody tr',
            '.log-table tbody tr',
            '[data-testid="log-row"]',
            '[class*="LogTable"] tbody tr',
            '[class*="Log"] tbody tr'
          ];
          var rows = [];
          for (var i = 0; i < sels.length; i++) {
            rows = Array.from(document.querySelectorAll(sels[i]));
            if (rows.length > 0) break;
          }
          if (rows.length === 0) return [];
          return rows.map(function(row) {
            var cells = Array.from(row.querySelectorAll('td'));
            if (cells.length === 0) {
              var text = row.textContent.trim();
              if (!text) return null;
              return { timestamp: '', type: 'activity', message: text };
            }
            var timeEl = row.querySelector('time, [class*="time"], [class*="timestamp"], [datetime]');
            var timestamp = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim()) : (cells[0] ? cells[0].textContent.trim() : '');
            var who = cells.length > 1 ? cells[1].textContent.trim() : '';
            var what = cells.length > 2 ? cells[2].textContent.trim() : (cells.length === 2 ? cells[1].textContent.trim() : '');
            return { timestamp: timestamp, type: 'activity', who: who, message: what };
          }).filter(function(x) { return x && x.message; });
        })()
      `)) as any[];

      if (tableLog?.length > 0) {
        const navWords =
          /^(Bracket|Register|Standings|Announcements|Log|Stations|Settings|Predictions|Embed|Reports?|Module)$/i;
        const filtered = tableLog.filter((e: any) => !navWords.test((e.message ?? "").trim()));
        return filtered.map((e: any) => ({ ...e, raw: null }));
      }

      return [];
    } finally {
      await page.close().catch(() => {});
    }
  }

  // ── Data processing ──────────────────────────────────────────────────────

  private processData(
    storeData: any,
    participantsPageData: any[],
    standings: ScrapedStanding[],
    stations: ScrapedStation[],
    log: ScrapedLogEntry[],
    url: string,
  ): ScrapedTournament {
    const t = storeData.tournament;
    const participantsMap = new Map<number, any>();

    if (participantsPageData.length > 0) {
      for (const p of participantsPageData) if (p.id) participantsMap.set(p.id, p);
    }

    const matches: any[] = [];
    if (storeData.matches_by_round) {
      Object.values(storeData.matches_by_round).forEach((round: any) => {
        round.forEach((m: any) => {
          matches.push(m);
          if (m.player1 && !participantsMap.has(m.player1.id)) {
            participantsMap.set(m.player1.id, m.player1);
          }
          if (m.player2 && !participantsMap.has(m.player2.id)) {
            participantsMap.set(m.player2.id, m.player2);
          }
        });
      });
    }

    if (participantsPageData.length > 0 && !participantsPageData[0]?.id) {
      let syntheticId = -1;
      for (const p of participantsPageData) {
        const name = (p.display_name || p.name || "").trim().replace("✅", "");
        const exists = Array.from(participantsMap.values()).some(
          (e) => (e.display_name || e.name || "").trim().replace("✅", "") === name,
        );
        if (!exists && name) {
          participantsMap.set(syntheticId--, {
            id: syntheticId,
            display_name: name,
            seed: p.seed || 0,
            challongeUsername: p.challongeUsername || null,
            challongeProfileUrl: p.challongeProfileUrl || null,
          });
        }
      }
    }

    const standingsByName = new Map<string, ScrapedStanding>();
    for (const s of standings) standingsByName.set(s.name, s);

    const participants: ScrapedParticipant[] = Array.from(participantsMap.values()).map((p) => {
      const name = (p.display_name || p.name || "").trim().replace("✅", "");
      const std = standingsByName.get(name);
      return {
        id: p.id,
        name,
        seed: p.seed ?? 0,
        challongeUsername:
          std?.challongeUsername ||
          p.challongeUsername ||
          p.username ||
          p.challonge_username ||
          undefined,
        challongeProfileUrl:
          std?.challongeProfileUrl ||
          p.challongeProfileUrl ||
          (p.username ? `https://challonge.com/users/${p.username}` : undefined),
        portraitUrl:
          p.portrait_url ||
          // Correct field; tolerate the legacy mistyped one too.
          p.attached_participatable_portrait_url ||
          p.attached_participant_portrait_url ||
          undefined,
        finalRank: std ? std.rank : (p.final_rank ?? undefined),
      };
    });

    // Sanity guard: when /standings returned rank=1 for everyone (tournament
    // not yet started), strip the rank so we don't pollute downstream points.
    const ranksSet = new Set(participants.map((p) => p.finalRank).filter((r) => r != null));
    if (
      ranksSet.size <= 2 &&
      participants.length > 8 &&
      (t.state === "pending" || t.state === "underway") &&
      !t.completed_at
    ) {
      for (const p of participants) p.finalRank = undefined;
    }

    const cleanMatches: ScrapedMatch[] = matches.map((m) => {
      const sets = normalizeSets(m.scores);
      return {
        id: m.id,
        identifier: m.identifier,
        round: m.round,
        player1Id: m.player1?.id ?? null,
        player2Id: m.player2?.id ?? null,
        winnerId: m.winner_id ?? null,
        loserId: m.loser_id ?? null,
        scores: setsToLegacyString(sets),
        sets,
        state: m.state,
      };
    });

    const toIso = (v: unknown): string | null => {
      if (typeof v !== "string" || v.length === 0) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    return {
      metadata: {
        id: t.id,
        name: t.name || "Tournoi Importé",
        url,
        state: t.state,
        type: t.tournament_type,
        participantsCount: participants.length,
        startedAt: toIso(t.started_at),
        completedAt: toIso(t.completed_at),
      },
      participants: participants.sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999)),
      matches: cleanMatches,
      standings,
      stations,
      log,
      raw: storeData,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeParticipant(p: any): any {
  const data = p.participant ?? p;
  return {
    id: data.id ?? null,
    display_name: data.display_name || data.name || data.username || "",
    seed: data.seed ?? 0,
    username: data.username || data.challonge_username || null,
    challongeUsername: data.username || data.challonge_username || null,
    challongeProfileUrl: data.username ? `https://challonge.com/users/${data.username}` : null,
    final_rank: data.final_rank ?? null,
    checked_in: data.checked_in ?? false,
    portrait_url:
      data.portrait_url ||
      data.attached_participatable_portrait_url ||
      data.attached_participant_portrait_url ||
      null,
  };
}

void sleep;
