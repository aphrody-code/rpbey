/**
 * Wrapper rpb-dashboard autour du transport HTMLRewriter promu dans
 * `@rose-griffon/challonge/htmlrewriter`. Ajoute la conversion `ScrapedTournament` →
 * `ViewerData` (specifique au viewer rpbey).
 *
 * Pour la logique d'extraction HTML, voir le package :
 *   packages/rpb-challonge/src/transports/htmlrewriter.ts
 */

import {
  fetchAndParseAsScrapedTournament,
  fetchAndParseModule as fetchAndParseModuleFromPackage,
  parseModuleToScrapedTournament,
  type FetchAndParseOptions,
  type HtmlRewriterModuleData,
} from "@/lib/challonge-vendor/transports/htmlrewriter";
import type { ScrapedTournament } from "@/lib/challonge-vendor/types";

import { challongeToViewerData } from "./challonge";
import type { ViewerData } from "./types";

export {
  fetchAndParseAsScrapedTournament,
  parseModuleToScrapedTournament,
  type FetchAndParseOptions,
  type HtmlRewriterModuleData,
};

/**
 * Re-export local pour conserver l'API historique du dashboard.
 * @deprecated Préférer `import { fetchAndParseModule } from '@/lib/challonge-vendor/transports/htmlrewriter'`.
 */
export const fetchAndParseModule = fetchAndParseModuleFromPackage;

/**
 * Compatibilite : ancienne signature qui retournait un object dashboard-spec.
 * On re-derive depuis la forme canonique du package.
 */
export interface ChallongeHtmlRewriterResult {
  tournamentSlug: string;
  tournamentName: string | null;
  tournamentType: string | null;
  groupsCount: number;
  participantsCount: number;
  matchesCount: number;
}

/**
 * One-shot : fetch + parse + projette directement en `ViewerData` consomme par
 * `<BracketsViewer>`.
 */
export async function fetchAndConvertToViewerData(
  slug: string,
  options: FetchAndParseOptions = {},
): Promise<{
  data: ViewerData;
  result: ChallongeHtmlRewriterResult;
  raw: ScrapedTournament;
}> {
  const raw = await fetchAndParseAsScrapedTournament(slug, options);
  const data = challongeToViewerData(raw);

  const moduleData = raw.raw as HtmlRewriterModuleData;
  const result: ChallongeHtmlRewriterResult = {
    tournamentSlug: slug,
    tournamentName: raw.metadata.name,
    tournamentType: raw.metadata.type,
    groupsCount: moduleData?.groups?.length ?? 0,
    participantsCount: raw.participants.length,
    matchesCount: raw.matches.length,
  };

  return { data, result, raw };
}

/**
 * Variante back-compat — pour le code existant qui attendait
 * `htmlRewriterResultToViewerData(result)`. Convertit la donnee module en
 * ViewerData via la projection canonique.
 */
export function htmlRewriterResultToViewerData(moduleData: HtmlRewriterModuleData): ViewerData {
  const scraped = parseModuleToScrapedTournament(moduleData);
  return challongeToViewerData(scraped);
}
