/**
 * Re-export du scraper Challonge canonique (packages/rpb-challonge).
 * Ne JAMAIS dupliquer la logique ici — toute évolution va dans @rose-griffon/challonge.
 */
// Scraper puppeteer importé depuis son module direct (hors barrel) — sinon tout
// import du barrel évalue puppeteer-extra (crash `utils.isObject` Turbopack).
export { ChallongeScraper, type ChallongeScraperOptions } from "@rose-griffon/challonge/scraper";
export {
  type ScrapedLogEntry,
  type ScrapedMatch,
  type ScrapedParticipant,
  type ScrapedStanding,
  type ScrapedStation,
  type ScrapedTournament,
  type ScrapedTournamentMetadata,
  type SetScore,
  normalizeSets,
  setsToLegacyString,
  sumSetWinsForPlayer,
  sumSetWinsForPlayer1,
} from "@rose-griffon/challonge";
