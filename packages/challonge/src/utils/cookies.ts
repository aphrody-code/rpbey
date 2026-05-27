/**
 * Cookie jar parsing + detection helpers.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface RawCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	expires?: string | null;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: string;
}

export interface PuppeteerCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	expires?: number;
	httpOnly: boolean;
	secure: boolean;
	sameSite: "Strict" | "Lax" | "None";
}

const COOKIE_CANDIDATES_FACTORY = (extra?: string): string[] =>
	[
		extra,
		process.env.CHALLONGE_COOKIE_PATH,
		resolve(process.cwd(), "storage/cookies/challonge_cookie.json"),
		resolve(process.cwd(), "../../storage/cookies/challonge_cookie.json"),
	].filter((p): p is string => Boolean(p));

export function resolveDefaultCookiePath(extra?: string): string | null {
	for (const p of COOKIE_CANDIDATES_FACTORY(extra)) {
		if (existsSync(p)) return p;
	}
	return null;
}

function normalizeSameSite(s?: string): "Strict" | "Lax" | "None" {
	if (s === "None") return "None";
	if (s === "Lax") return "Lax";
	return "Strict";
}

export function loadCookieJar(filePath: string): {
	raw: RawCookie[];
	forPuppeteer: PuppeteerCookie[];
	forFetch: string;
} {
	let raw: RawCookie[] = [];
	try {
		raw = JSON.parse(readFileSync(filePath, "utf-8"));
	} catch (err) {
		throw new Error(
			`Cannot read cookie jar at ${filePath}: ${(err as Error).message}`,
			{ cause: err },
		);
	}

	const challonge = raw.filter((c) => c.domain.includes("challonge.com"));

	const forPuppeteer: PuppeteerCookie[] = challonge.map((c) => {
		const cookie: PuppeteerCookie = {
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: c.path,
			httpOnly: !!c.httpOnly,
			secure: !!c.secure,
			sameSite: normalizeSameSite(c.sameSite),
		};
		if (c.expires && c.expires !== "Session") {
			const t = new Date(c.expires).getTime();
			if (Number.isFinite(t)) cookie.expires = Math.floor(t / 1000);
		}
		return cookie;
	});

	const forFetch = challonge.map((c) => `${c.name}=${c.value}`).join("; ");

	return { raw: challonge, forPuppeteer, forFetch };
}

/**
 * Returns true if the session cookie is missing or visibly invalid.
 * The Challonge session cookie has the shape `<base64>--<sig>--<sig2>`.
 */
export function isSessionCookieValid(jar: RawCookie[]): boolean {
	const session = jar.find((c) => c.name === "_challonge_session_production");
	if (!session?.value) return false;
	// Cheap structural check
	return session.value.includes("--") && session.value.length > 100;
}

/**
 * Returns true if cf_clearance is present (might still be IP-bound).
 */
export function hasCfClearance(jar: RawCookie[]): boolean {
	return jar.some((c) => c.name === "cf_clearance" && !!c.value);
}
