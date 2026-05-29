/**
 * Re-export du client Challonge WRITE canonique (packages/challonge).
 *
 * L'implémentation du client v2.1 OAuth (client_credentials) et la factory
 * singleton `getChallongeClient` vivent désormais dans
 * `@rose-griffon/challonge/write`. Ne JAMAIS dupliquer la logique ici — toute
 * évolution va dans le package partagé.
 *
 * Les consommateurs du bot (commands/Beyblade/*, lib/challonge-sync) importent
 * `getChallongeClient`. Les types JSON:API génériques sont réexportés sous leur
 * nom historique (Tournament/Participant/Match/ApiResponse/ChallongeConfig).
 */

export {
  ChallongeClient,
  getChallongeClient,
  type ChallongeConfig,
  type Tournament,
  type Participant,
  type Match,
  type ApiResponse,
} from "@rose-griffon/challonge/write";
