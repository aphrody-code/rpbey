import "server-only";
import crypto from "node:crypto";
import { db, schema, and, count, desc, gte, sql } from "@/lib/db";

/**
 * Real-time analytics core (server-only).
 *
 * Records pageviews + custom business events into the shared `analytics_events`
 * table and exposes aggregate queries for the admin dashboard. Privacy-first:
 * raw IPs are never stored, only a daily-rotating salted hash used to derive a
 * stable-ish anonymous session id when the client does not provide one.
 *
 * Invariant timestamp: `analytics_events.createdAt` is `mode:"string"` (non-auth
 * table) -> always write `new Date().toISOString()`, always wrap reads in
 * `new Date(x)` before any Date method.
 */

/** Canonical event types. `string` allows ad-hoc business events. */
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
 * Derive a privacy-preserving anonymous session id from request headers.
 * The hash rotates daily so it cannot be used for long-term tracking and the
 * raw IP / UA never touch the database.
 */
export function anonSessionId(ip: string | null, userAgent: string | null): string {
	const day = new Date().toISOString().slice(0, 10);
	return crypto
		.createHash("sha256")
		.update(`${ANON_SALT}:${day}:${ip ?? "?"}:${userAgent ?? "?"}`)
		.digest("hex")
		.slice(0, 24);
}

/** Best-effort client IP from standard proxy headers (never persisted raw). */
export function clientIpFromHeaders(h: Headers): string | null {
	const fwd = h.get("x-forwarded-for");
	if (fwd) return fwd.split(",")[0]?.trim() ?? null;
	return h.get("x-real-ip");
}

/**
 * Persist one event. Fire-and-forget friendly: never throws, swallows DB errors
 * so instrumentation can never break the calling action / request.
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

/** Aggregate snapshot for the admin dashboard. */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
	const now = Date.now();
	const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const todayIso = startOfToday.toISOString();
	const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60_000).toISOString();

	const [
		liveRows,
		pvTodayRows,
		pv7dRows,
		evTodayRows,
		topPagesRows,
		topRefRows,
		recentRows,
	] = await Promise.all([
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
		db
			.select({ value: count() })
			.from(ev)
			.where(gte(ev.createdAt, todayIso)),
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

function eqType(type: string) {
	return sql`${ev.type} = ${type}`;
}

function refNotEmpty() {
	return sql`${ev.referrer} IS NOT NULL AND ${ev.referrer} <> ''`;
}
