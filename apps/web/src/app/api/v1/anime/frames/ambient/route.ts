import { type NextRequest, NextResponse } from "next/server";
import { loadJsonSafe } from "@/lib/data-cache";

export const runtime = "nodejs";

/**
 * GET /api/v1/anime/frames/ambient?series=<slug>&count=<n>
 *
 * Sert un échantillon léger de frames d'animé (juste les URLs + dimensions) pour les
 * FONDS D'AMBIANCE des pages (composant `FrameBackdrop`). Lit directement les JSON du
 * corpus `data/anime-frames/*.json` (les `imageUrl` y sont déjà exploitables : wikia HD
 * ou `cdn.rpbey.fr` re-hébergé) — donc indépendant de l'import DB lourd `anime_frames`.
 * Si la série demandée n'a pas de frames, repli sur un échantillon diversifié.
 */

interface RawFrame {
  imageUrl?: string | null;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

interface AmbientFrame {
  imageUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
}

// Fichiers du corpus (= slugs de série). Les plus fournis d'abord.
const SERIES_FILES = new Set([
  "beyblade-x",
  "metal-fight-beyblade",
  "metal-fight-beyblade-4d",
  "metal-fight-beyblade-baku",
  "beyblade-burst",
  "beyblade-burst-god",
  "beyblade-burst-chouzetsu",
  "beyblade-burst-superking",
  "beyblade-burst-gt",
  "beyblade-burst-db",
  "beyblade-burst-quadstrike",
  "beyblade-shogun-steel",
  "beyblade-g-revolution",
  "beyblade-v-force",
  "bakuten-shoot-beyblade",
]);

// Repli diversifié (séries riches, toutes générations).
const DIVERSE = ["beyblade-x", "metal-fight-beyblade", "beyblade-burst-chouzetsu"];

function normalize(json: unknown): RawFrame[] {
  if (Array.isArray(json)) return json as RawFrame[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.frames)) return o.frames as RawFrame[];
    if (Array.isArray(o.data)) return o.data as RawFrame[];
  }
  return [];
}

/** Échantillon réparti uniformément (diversité d'épisodes, pas les N premières). */
function strided<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]!);
  return out;
}

function clean(frames: RawFrame[]): AmbientFrame[] {
  const out: AmbientFrame[] = [];
  for (const f of frames) {
    if (!f.imageUrl) continue;
    // On privilégie le paysage (fond plein écran) quand les dimensions sont connues.
    if (f.width && f.height && f.width < f.height) continue;
    out.push({
      imageUrl: f.imageUrl,
      thumbUrl: f.thumbUrl ?? null,
      width: f.width ?? null,
      height: f.height ?? null,
    });
  }
  return out;
}

async function loadSeries(slug: string): Promise<AmbientFrame[]> {
  if (!SERIES_FILES.has(slug)) return [];
  const json = await loadJsonSafe<unknown>(`data/anime-frames/${slug}.json`);
  if (!json) return [];
  return clean(normalize(json));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const series = sp.get("series")?.trim().toLowerCase();
  const count = Math.min(60, Math.max(4, Number(sp.get("count") ?? "30") || 30));

  let frames: AmbientFrame[] = [];
  if (series) frames = await loadSeries(series);

  // Repli : échantillon diversifié si la série est vide / inconnue.
  if (frames.length === 0) {
    const lists = await Promise.all(DIVERSE.map((s) => loadSeries(s)));
    const per = Math.ceil(count / lists.length);
    frames = lists.flatMap((l) => strided(l, per));
  }

  const data = strided(frames, count);
  return NextResponse.json(
    { ok: true, data },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
