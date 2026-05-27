/**
 * GET /api/og/tournament/[slug]
 *
 * Genere une image OG / share-card pour un tournoi Challonge en plusieurs
 * formats (PNG/WebP/AVIF) avec content-negotiation `Accept`.
 *
 * Query params :
 *   - `w`, `h`        : dimensions (default 1200x630)
 *   - `transport`     : `auto | api | htmlrewriter` (passe a convertChallongeToBrackets)
 *   - `theme`         : `light | dark` (default `dark`)
 *   - `format`        : override content-negotiation (`png|webp|avif`)
 *
 * Cache : `public, s-maxage=300, stale-while-revalidate=86400`.
 * ETag  : FNV-1a sur `(slug, theme, w, h, format, fetchedAt)`.
 *
 * Erreur fetch Challonge : renvoie une image fallback 200 OK + warning header
 * `x-og-error`. Aucun 500 n'est emis pour ce endpoint (degrade gracieusement).
 */

import { NextResponse, type NextRequest } from "next/server";

import { convertChallongeToBrackets } from "@/server/actions/brackets";
import {
	DEFAULT_HEIGHT,
	DEFAULT_WIDTH,
	renderTournamentCardEncoded,
	renderTournamentError,
	type ChallongeSource,
} from "@/lib/og/tournament-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Theme = "light" | "dark";
type Format = "png" | "webp" | "avif";
type Transport = "auto" | "api" | "htmlrewriter";

const FORMAT_MIME: Record<Format, string> = {
	png: "image/png",
	webp: "image/webp",
	avif: "image/avif",
};

function isTheme(v: string | null): v is Theme {
	return v === "light" || v === "dark";
}

function isFormat(v: string | null): v is Format {
	return v === "png" || v === "webp" || v === "avif";
}

function isTransport(v: string | null): v is Transport {
	return v === "auto" || v === "api" || v === "htmlrewriter";
}

/** Choix du format selon le header `Accept`. AVIF > WebP > PNG. */
function pickFormatFromAccept(accept: string | null): Format {
	if (!accept) return "png";
	const a = accept.toLowerCase();
	if (a.includes("image/avif")) return "avif";
	if (a.includes("image/webp")) return "webp";
	return "png";
}

/** FNV-1a 32-bit. Sortie hex, ~7-8 char, suffisant pour ETag (collision ~10^-9). */
function fnv1a(input: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h.toString(16);
}

function clampDim(
	value: string | null,
	fallback: number,
	min: number,
	max: number,
): number {
	const n = value ? Number.parseInt(value, 10) : NaN;
	if (!Number.isFinite(n)) return fallback;
	return Math.max(min, Math.min(max, n));
}

/**
 * Construit la reponse Image avec headers cache + ETag.
 * Renvoie 304 si `If-None-Match` correspond.
 */
function buildImageResponse(
	req: NextRequest,
	buf: Buffer,
	mime: string,
	etag: string,
	extraHeaders: Record<string, string> = {},
): Response {
	const ifNoneMatch = req.headers.get("if-none-match");
	const headers: HeadersInit = {
		"Content-Type": mime,
		"Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
		ETag: etag,
		Vary: "Accept",
		...extraHeaders,
	};
	if (ifNoneMatch && ifNoneMatch === etag) {
		return new Response(null, { status: 304, headers });
	}
	return new Response(new Uint8Array(buf), { status: 200, headers });
}

interface RouteContext {
	params: Promise<{ slug: string }>;
}

export async function GET(
	req: NextRequest,
	ctx: RouteContext,
): Promise<Response> {
	const { slug: rawSlug } = await ctx.params;
	const slug = rawSlug?.trim();
	if (!slug) {
		return NextResponse.json({ error: "slug requis" }, { status: 400 });
	}

	const url = new URL(req.url);
	const sp = url.searchParams;

	const width = clampDim(sp.get("w"), DEFAULT_WIDTH, 320, 2400);
	const height = clampDim(sp.get("h"), DEFAULT_HEIGHT, 200, 1600);

	const themeRaw = sp.get("theme");
	const theme: Theme = isTheme(themeRaw) ? themeRaw : "dark";

	const transportRaw = sp.get("transport");
	const transport: Transport = isTransport(transportRaw)
		? transportRaw
		: "auto";

	const formatRaw = sp.get("format");
	const format: Format = isFormat(formatRaw)
		? formatRaw
		: pickFormatFromAccept(req.headers.get("accept"));
	const mime = FORMAT_MIME[format];

	// Fetch Challonge (cache 5 min cote server action).
	const result = await convertChallongeToBrackets(slug, { transport });

	if (!result.success) {
		const buf = await renderTournamentError({
			message: result.error,
			idOrSlug: slug,
			theme,
			width,
			height,
		});
		const etag = `W/"${fnv1a(`err:${slug}:${theme}:${width}x${height}:${format}`)}"`;
		return buildImageResponse(req, buf, FORMAT_MIME.png, etag, {
			"x-og-error": result.error.slice(0, 200),
			"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
		});
	}

	const source: ChallongeSource = result.source;

	const etagSeed = `${slug}:${theme}:${width}x${height}:${format}:${result.fetchedAt}:${source.matchesCount}`;
	const etag = `"${fnv1a(etagSeed)}"`;

	// Short-circuit si le client a deja la version
	if (req.headers.get("if-none-match") === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				"Content-Type": mime,
				"Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
				ETag: etag,
				Vary: "Accept",
			},
		});
	}

	const buf = await renderTournamentCardEncoded({
		data: result.data,
		source,
		theme,
		width,
		height,
		fetchedAt: result.fetchedAt,
		format,
	});

	return buildImageResponse(req, buf, mime, etag, {
		"x-og-transport": result.transport,
		"x-og-format": format,
		"Content-Disposition": `inline; filename="og-${slug}.${format}"`,
	});
}
