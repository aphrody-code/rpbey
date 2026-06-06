"use server";

import { unstable_cache as cache } from "next/cache";
import { ChallongeApi } from "@rose-griffon/challonge/api";
import {
  fetchAndParseAsScrapedTournament,
  fetchPublicTournamentJson,
} from "@rose-griffon/challonge/htmlrewriter";

import { challongeToViewerData } from "@/lib/brackets/challonge";
import type { ViewerData } from "@/lib/brackets/types";

export type ChallongeTransport = "api" | "htmlrewriter" | "auto";

const CACHE_TAG = "brackets-challonge";

export interface ChallongeImportResult {
  success: true;
  data: ViewerData;
  transport: ChallongeTransport;
  source: {
    idOrSlug: string;
    challongeId: number | null;
    name: string;
    url: string;
    state: string | null;
    type: string | null;
    participantsCount: number;
    matchesCount: number;
  };
  fetchedAt: string;
}

export interface ChallongeImportError {
  success: false;
  error: string;
  transport?: ChallongeTransport;
  code?: string | number;
}

let apiSingleton: ChallongeApi | null = null;
function getApi(): ChallongeApi {
  if (!apiSingleton) {
    apiSingleton = new ChallongeApi();
  }
  return apiSingleton;
}

async function fetchViaApi(idOrSlug: string): Promise<ChallongeImportResult> {
  const api = getApi();
  const tournament = await api.get(idOrSlug, {
    includeParticipants: true,
    includeMatches: true,
  });
  const canonical = api.toCanonical(tournament);
  const data = challongeToViewerData(canonical);

  return {
    success: true,
    data,
    transport: "api",
    source: {
      idOrSlug,
      challongeId: canonical.metadata.id,
      name: canonical.metadata.name,
      url: canonical.metadata.url,
      state: canonical.metadata.state,
      type: canonical.metadata.type,
      participantsCount: canonical.participants.length,
      matchesCount: canonical.matches.length,
    },
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchViaHtmlRewriter(idOrSlug: string): Promise<ChallongeImportResult> {
  // 1) On tente d'abord `/{slug}.json` — si Challonge expose ce JSON public
  //    (cas frequent pour les tournois publics), on a directement les matches
  //    + participants natifs (utile pour double-elim ou le module HTML est vide).
  let challongeId: number | null = null;
  let realState: string | null = null;
  let jsonTournamentType: string | null = null;
  try {
    const json = await fetchPublicTournamentJson(idOrSlug);
    if (json && typeof json === "object" && "tournament" in json) {
      const t = (
        json as {
          tournament?: {
            id?: number;
            state?: string;
            tournament_type?: string;
          };
        }
      ).tournament;
      challongeId = t?.id ?? null;
      realState = t?.state ?? null;
      jsonTournamentType = t?.tournament_type ?? null;
    }
  } catch {
    /* best-effort */
  }

  // 2) Parse module HTML (round-robin standings + match-history).
  const scraped = await fetchAndParseAsScrapedTournament(idOrSlug);
  if (challongeId) scraped.metadata.id = challongeId;
  if (realState) scraped.metadata.state = realState;
  if (jsonTournamentType) scraped.metadata.type = jsonTournamentType;

  const data = challongeToViewerData(scraped);

  return {
    success: true,
    data,
    transport: "htmlrewriter",
    source: {
      idOrSlug,
      challongeId,
      name: scraped.metadata.name,
      url: scraped.metadata.url,
      state: scraped.metadata.state ?? null,
      type: scraped.metadata.type,
      participantsCount: scraped.participants.length,
      matchesCount: scraped.matches.length,
    },
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchViaTransport(
  idOrSlug: string,
  transport: ChallongeTransport,
): Promise<ChallongeImportResult> {
  if (transport === "api") return fetchViaApi(idOrSlug);
  if (transport === "htmlrewriter") return fetchViaHtmlRewriter(idOrSlug);
  // auto: API si clé dispo, sinon HTMLRewriter
  if (process.env.CHALLONGE_API_KEY) {
    try {
      return await fetchViaApi(idOrSlug);
    } catch (err) {
      console.warn(
        `[brackets] API transport failed (${err instanceof Error ? err.message : err}), falling back to htmlrewriter`,
      );
      return fetchViaHtmlRewriter(idOrSlug);
    }
  }
  return fetchViaHtmlRewriter(idOrSlug);
}

const fetchCachedAuto = cache(
  (idOrSlug: string): Promise<ChallongeImportResult> => fetchViaTransport(idOrSlug, "auto"),
  ["challonge-to-brackets-auto"],
  { revalidate: 300, tags: [CACHE_TAG] },
);
const fetchCachedApi = cache(
  (idOrSlug: string): Promise<ChallongeImportResult> => fetchViaTransport(idOrSlug, "api"),
  ["challonge-to-brackets-api"],
  { revalidate: 300, tags: [CACHE_TAG] },
);
const fetchCachedHtml = cache(
  (idOrSlug: string): Promise<ChallongeImportResult> => fetchViaTransport(idOrSlug, "htmlrewriter"),
  ["challonge-to-brackets-htmlrewriter"],
  { revalidate: 300, tags: [CACHE_TAG] },
);

/**
 * Convertit un tournoi Challonge en `ViewerData` natif `@rose-griffon/challonge-core`.
 *
 * Accepte un id numerique (ex. `"17779621"`), un slug (`"T_SS1"`) ou un
 * slug avec subdomaine (`"rpbey-foo"`).
 *
 * Transports :
 *   - `"api"`         → API v1 Challonge (necessite `CHALLONGE_API_KEY`).
 *   - `"htmlrewriter"`→ scrape HTML public via `Bun.HTMLRewriter` (zero dep, public seulement).
 *   - `"auto"` (default) → API si cle dispo, sinon fallback HTMLRewriter.
 *
 * Cache 5 min cote serveur (revalidate=300, tag `brackets-challonge`).
 *
 * @example
 *   const result = await convertChallongeToBrackets("T_SS1");
 *   if (result.success) {
 *     return <BracketsViewer data={result.data} />;
 *   }
 */
export async function convertChallongeToBrackets(
  idOrSlug: string,
  options: { skipCache?: boolean; transport?: ChallongeTransport } = {},
): Promise<ChallongeImportResult | ChallongeImportError> {
  const slug = idOrSlug?.trim();
  const transport: ChallongeTransport = options.transport ?? "auto";
  if (!slug) {
    return {
      success: false,
      error: "idOrSlug requis (id Challonge ou slug d'URL)",
      transport,
    };
  }
  if (transport === "api" && !process.env.CHALLONGE_API_KEY) {
    return {
      success: false,
      error: "CHALLONGE_API_KEY manquant (transport='api' force)",
      code: "MISSING_API_KEY",
      transport,
    };
  }

  try {
    if (options.skipCache) return await fetchViaTransport(slug, transport);
    if (transport === "api") return await fetchCachedApi(slug);
    if (transport === "htmlrewriter") return await fetchCachedHtml(slug);
    return await fetchCachedAuto(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      (err as { status?: number; code?: string })?.status ?? (err as { code?: string })?.code;
    return {
      success: false,
      error: message,
      transport,
      ...(code ? { code } : {}),
    };
  }
}

/**
 * Variante non-cachee — utile pour debug ou refresh manuel cote admin.
 */
export async function refreshChallongeBrackets(
  idOrSlug: string,
  transport: ChallongeTransport = "auto",
): Promise<ChallongeImportResult | ChallongeImportError> {
  return convertChallongeToBrackets(idOrSlug, { skipCache: true, transport });
}
