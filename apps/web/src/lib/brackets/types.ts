/**
 * Re-export selectif des types `@rose-griffon/challonge-core`.
 * Centralise tous les types brackets utilises dans l'app rpb-dashboard.
 *
 * NOTE: Sépare les imports Core (server-safe) des imports Viewer (client-only)
 * pour éviter les erreurs "window is not defined" au build Vercel.
 */

// Core imports (Models, Manager)
import type {
  Group,
  Match,
  MatchGame,
  Participant,
  Round,
  Stage,
  CustomParticipant,
  IdSeeding,
  InputStage,
  Seed,
  Seeding,
  StageSettings,
  GrandFinalType,
  GroupType,
  Id,
  MatchResults,
  ParticipantResult,
  RankingFormula,
  RankingItem,
  Result,
  RoundRobinMode,
  SeedOrdering,
  StageType,
} from "@rose-griffon/challonge-core";

export { Status } from "@rose-griffon/challonge-core";

// Viewer imports (Client-only)
import type {
  Config,
  ConnectionType,
  MatchClickCallback,
  MatchWithMetadata,
  OriginHint,
  ParticipantImage,
  Placement,
  RoundNameInfo,
  Side,
  ViewerData,
} from "@rose-griffon/challonge-core/viewer";

export type {
  Group,
  Match,
  MatchGame,
  Participant,
  Round,
  Stage,
  CustomParticipant,
  IdSeeding,
  InputStage,
  Seed,
  Seeding,
  StageSettings,
  GrandFinalType,
  GroupType,
  Id,
  MatchResults,
  ParticipantResult,
  RankingFormula,
  RankingItem,
  Result,
  RoundRobinMode,
  SeedOrdering,
  StageType,
  Config,
  ConnectionType,
  MatchClickCallback,
  MatchWithMetadata,
  OriginHint,
  ParticipantImage,
  Placement,
  RoundNameInfo,
  Side,
  ViewerData,
};

/**
 * Theme du viewer (cf. SCSS M3 du fork rpbey).
 * - `light` / `dark` : impose data-theme sur le container racine.
 * - `auto` : laisse le viewer suivre `prefers-color-scheme`.
 */
export type BracketsTheme = "light" | "dark" | "auto";
