import "server-only";
import crypto from "node:crypto";
import { and, count, db, desc, gte, schema, sql } from "@/lib/db";

/**
 * Data Access Layer — analytics d'événements (pageviews + événements métier).
 * SEUL endroit autorisé à importer `@rpbey/db` pour ce domaine. UI-agnostic.
 *
 * Migré depuis `lib/analytics.ts` (vague 5) : `lib/analytics.ts` reste une façade
 * qui ré-exporte d'ici, donc aucun appelant ne change mais le `db` quitte `lib/`.
 *
 * Privacy-first : l'IP brute n'est JAMAIS stockée, seul un hash salé tournant
 * chaque jour sert à dériver un id de session anonyme stable.
 *
 * Invariant timestamp : `analytics_events.createdAt` est `mode:"string"` (table
 * non-auth) -> écriture via `new Date().toISOString()`, lecture déjà en string ISO.
 */

/** Types d'événements canoniques. `string` autorise les événements métier ad-hoc. */
export type AnalyticsEventType =
  | "pageview"
  | "tournament_register"
  | "profile_claim"
  | "gacha_pull"
  | "deck_create"
  | (string & {});

export interface TrackInput {
  type: AnalyticsEventType;
  path?: string | null;
  referrer?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown> | null;
}

const ANON_SALT = process.env.ANALYTICS_SALT ?? "rpb-analytics";

/**
 * Dérive un id de session anonyme préservant la vie privée depuis les en-têtes.
 * Le hash tourne chaque jour (ne peut pas servir au tracking long-terme) et
 * l'IP brute / le UA ne touchent jamais la base.
 */
export function anonSessionId(ip: string | null, userAgent: string | null): string {
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${ANON_SALT}:${day}:${ip ?? "?"}:${userAgent ?? "?"}`)
    .digest("hex")
    .slice(0, 24);
}

/** Meilleure-estimation de l'IP client depuis les en-têtes proxy (jamais persistée brute). */
export function clientIpFromHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip");
}

/**
 * Persiste un événement. Best-effort (fire-and-forget) : ne lève jamais, avale
 * les erreurs DB pour que l'instrumentation ne casse jamais l'appelant.
 */
export async function recordEvent(input: TrackInput): Promise<void> {
  try {
    await db.insert(schema.analyticsEvents).values({
      type: input.type,
      path: input.path?.slice(0, 512) ?? null,
      referrer: input.referrer?.slice(0, 512) ?? null,
      sessionId: input.sessionId ?? null,
      userId: input.userId ?? null,
      meta: input.meta ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[analytics] recordEvent failed:", error);
  }
}

export interface AnalyticsSummary {
  liveVisitors: number;
  pageviewsToday: number;
  pageviews7d: number;
  eventsToday: number;
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; count: number }[];
  recentEvents: {
    id: string;
    type: string;
    path: string | null;
    userId: string | null;
    createdAt: string;
  }[];
}

const ev = schema.analyticsEvents;

function eqType(type: string) {
  return sql`${ev.type} = ${type}`;
}

function refNotEmpty() {
  return sql`${ev.referrer} IS NOT NULL AND ${ev.referrer} <> ''`;
}

/** Cliché agrégé pour le dashboard admin. */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60_000).toISOString();

  const [liveRows, pvTodayRows, pv7dRows, evTodayRows, topPagesRows, topRefRows, recentRows] =
    await Promise.all([
      db
        .select({ value: count(sql`DISTINCT ${ev.sessionId}`) })
        .from(ev)
        .where(gte(ev.createdAt, fiveMinAgo)),
      db
        .select({ value: count() })
        .from(ev)
        .where(and(eqType("pageview"), gte(ev.createdAt, todayIso))),
      db
        .select({ value: count() })
        .from(ev)
        .where(and(eqType("pageview"), gte(ev.createdAt, sevenDaysAgo))),
      db.select({ value: count() }).from(ev).where(gte(ev.createdAt, todayIso)),
      db
        .select({ path: ev.path, views: count() })
        .from(ev)
        .where(and(eqType("pageview"), gte(ev.createdAt, sevenDaysAgo)))
        .groupBy(ev.path)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ referrer: ev.referrer, c: count() })
        .from(ev)
        .where(and(eqType("pageview"), gte(ev.createdAt, sevenDaysAgo), refNotEmpty()))
        .groupBy(ev.referrer)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({
          id: ev.id,
          type: ev.type,
          path: ev.path,
          userId: ev.userId,
          createdAt: ev.createdAt,
        })
        .from(ev)
        .orderBy(desc(ev.createdAt))
        .limit(30),
    ]);

  return {
    liveVisitors: liveRows[0]?.value ?? 0,
    pageviewsToday: pvTodayRows[0]?.value ?? 0,
    pageviews7d: pv7dRows[0]?.value ?? 0,
    eventsToday: evTodayRows[0]?.value ?? 0,
    topPages: topPagesRows
      .filter((r) => r.path)
      .map((r) => ({ path: r.path as string, views: r.views })),
    topReferrers: topRefRows
      .filter((r) => r.referrer)
      .map((r) => ({ referrer: r.referrer as string, count: r.c })),
    recentEvents: recentRows.map((r) => ({
      id: r.id,
      type: r.type,
      path: r.path,
      userId: r.userId,
      createdAt: r.createdAt,
    })),
  };
}
