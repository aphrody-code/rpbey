/**
 * Chargement des fonts Inter pour le rendu OG via `next/og` ImageResponse.
 *
 * `next/og` (Satori) ne lit pas les fichiers du disque tout seul : il faut
 * lui fournir des `ArrayBuffer`/`Buffer`. Les TTF sont stockes sous
 * `apps/rpb-dashboard/public/fonts/` et embedded via `outputFileTracingRoot`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

export interface SatoriFont {
	name: string;
	data: ArrayBuffer;
	weight: 400 | 500 | 600 | 700 | 800 | 900;
	style: "normal" | "italic";
}

interface FontDescriptor {
	file: string;
	name: string;
	weight: SatoriFont["weight"];
	style: SatoriFont["style"];
}

const INTER_FONTS: ReadonlyArray<FontDescriptor> = [
	{ file: "Inter-Medium.ttf", name: "Inter", weight: 500, style: "normal" },
	{ file: "Inter-SemiBold.ttf", name: "Inter", weight: 600, style: "normal" },
	{ file: "Inter-Bold.ttf", name: "Inter", weight: 700, style: "normal" },
	{ file: "Inter-ExtraBold.ttf", name: "Inter", weight: 800, style: "normal" },
	{
		file: "InterDisplay-Black.ttf",
		name: "Inter Display",
		weight: 900,
		style: "normal",
	},
];

let cachedInter: SatoriFont[] | null = null;

/**
 * Lit les TTF Inter une seule fois par process et les retourne au format
 * attendu par `ImageResponse({ fonts })`. Les fichiers manquants sont silencieux.
 */
export async function loadInterFonts(): Promise<SatoriFont[]> {
	if (cachedInter) return cachedInter;
	const out: SatoriFont[] = [];
	for (const f of INTER_FONTS) {
		try {
			const buf = await readFile(path.join(FONT_DIR, f.file));
			out.push({
				name: f.name,
				data: buf.buffer.slice(
					buf.byteOffset,
					buf.byteOffset + buf.byteLength,
				) as ArrayBuffer,
				weight: f.weight,
				style: f.style,
			});
		} catch {
			/* fallback silencieux */
		}
	}
	cachedInter = out;
	return out;
}

let cachedGoogleSans: SatoriFont[] | null = null;

/**
 * Charge Google Sans Flex Bold (single weight 700) — utilise par les cards
 * gacha/deck/combo/leaderboard/stardust qui partagent la meme DA.
 */
export async function loadGoogleSansFonts(): Promise<SatoriFont[]> {
	if (cachedGoogleSans) return cachedGoogleSans;
	const out: SatoriFont[] = [];
	const file = path.join(
		process.cwd(),
		"public",
		"Google_Sans_Flex",
		"static",
		"GoogleSansFlex_72pt-Bold.ttf",
	);
	try {
		const buf = await readFile(file);
		const data = buf.buffer.slice(
			buf.byteOffset,
			buf.byteOffset + buf.byteLength,
		) as ArrayBuffer;
		// On expose la meme font a plusieurs poids (Satori choisit le plus proche).
		out.push({ name: "GoogleSans", data, weight: 700, style: "normal" });
	} catch {
		/* fallback silencieux */
	}
	cachedGoogleSans = out;
	return out;
}
