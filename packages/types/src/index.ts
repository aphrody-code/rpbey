import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { schema as DbSchema } from "@rpbey/db";

// Schéma référencé en type-only (`import type` + `typeof`) : effacé à la
// compilation, donc importer un type d'ici ne tire JAMAIS postgres.js dans un
// bundle client.
type Schema = typeof DbSchema;

// === Base model types (Drizzle), exported under their Prisma model names ===
export type User = InferSelectModel<Schema["users"]>;
export type Profile = InferSelectModel<Schema["profiles"]>;
export type Account = InferSelectModel<Schema["accounts"]>;
export type Session = InferSelectModel<Schema["sessions"]>;
export type TwoFactor = InferSelectModel<Schema["twoFactors"]>;
export type Verification = InferSelectModel<Schema["verifications"]>;
export type Part = InferSelectModel<Schema["parts"]>;
export type Beyblade = InferSelectModel<Schema["beyblades"]>;
export type Deck = InferSelectModel<Schema["decks"]>;
export type DeckItem = InferSelectModel<Schema["deckItems"]>;
export type Tournament = InferSelectModel<Schema["tournaments"]>;
export type TournamentCategory = InferSelectModel<Schema["tournamentCategories"]>;
export type TournamentParticipant = InferSelectModel<Schema["tournamentParticipants"]>;
export type TournamentMatch = InferSelectModel<Schema["tournamentMatches"]>;
export type StaffMember = InferSelectModel<Schema["staffMembers"]>;
export type ContentBlock = InferSelectModel<Schema["contentBlocks"]>;
export type Product = InferSelectModel<Schema["products"]>;
export type BotCommand = InferSelectModel<Schema["botCommands"]>;
export type DiscordRole = InferSelectModel<Schema["discordRoles"]>;
export type DiscordChannel = InferSelectModel<Schema["discordChannels"]>;
export type YouTubeVideo = InferSelectModel<Schema["youtubeVideos"]>;
export type SatrRanking = InferSelectModel<Schema["satrRankings"]>;
export type SatrBlader = InferSelectModel<Schema["satrBladers"]>;
export type WbRanking = InferSelectModel<Schema["wbRankings"]>;
export type WbBlader = InferSelectModel<Schema["wbBladers"]>;
export type StardustRanking = InferSelectModel<Schema["stardustRankings"]>;
export type StardustBlader = InferSelectModel<Schema["stardustBladers"]>;
export type DuelMatch = InferSelectModel<Schema["duelMatches"]>;
export type GachaDrop = InferSelectModel<Schema["gachaDrops"]>;
export type GachaCard = InferSelectModel<Schema["gachaCards"]>;
export type CardInventory = InferSelectModel<Schema["cardInventory"]>;
export type CardWishlist = InferSelectModel<Schema["cardWishlists"]>;
export type PartInventory = InferSelectModel<Schema["partInventory"]>;
export type CurrencyTransaction = InferSelectModel<Schema["currencyTransactions"]>;
export type AnimeSeries = InferSelectModel<Schema["animeSeries"]>;
export type AnimeEpisode = InferSelectModel<Schema["animeEpisodes"]>;
export type AnimeEpisodeSource = InferSelectModel<Schema["animeEpisodeSources"]>;
export type AnimeWatchProgress = InferSelectModel<Schema["animeWatchProgress"]>;
export type Warning = InferSelectModel<Schema["warnings"]>;
export type Reminder = InferSelectModel<Schema["reminders"]>;
export type BeyLibraryPart = InferSelectModel<Schema["beyLibraryParts"]>;
export type LegacyTournamentArchive = InferSelectModel<Schema["legacyTournamentArchives"]>;
export type StreamState = InferSelectModel<Schema["streamStates"]>;
export type PointAdjustment = InferSelectModel<Schema["pointAdjustments"]>;
export type RankingSeason = InferSelectModel<Schema["rankingSeasons"]>;
export type SeasonEntry = InferSelectModel<Schema["seasonEntries"]>;
export type GlobalRanking = InferSelectModel<Schema["globalRankings"]>;
export type RankingSystem = InferSelectModel<Schema["rankingSystem"]>;

// === Enum unions (exported under their Prisma enum names) ===
export type BeyType = Schema["beyType"]["enumValues"][number];
export type PartType = Schema["partType"]["enumValues"][number];
export type CardRarity = Schema["cardRarity"]["enumValues"][number];
export type CardType = Schema["cardType"]["enumValues"][number];
export type TransactionType = Schema["transactionType"]["enumValues"][number];
export type TournamentStatus = Schema["tournamentStatus"]["enumValues"][number];
export type ProductType = Schema["productType"]["enumValues"][number];
export type ProductLine = Schema["productLine"]["enumValues"][number];
export type ExperienceLevel = Schema["experienceLevel"]["enumValues"][number];
export type AnimeGeneration = Schema["animeGeneration"]["enumValues"][number];
export type EpisodeSourceType = Schema["episodeSourceType"]["enumValues"][number];
export type WatchStatus = Schema["watchStatus"]["enumValues"][number];

// === Extended Types (relations resolved to Prisma-style field names) ===

// User with Profile
export type UserWithProfile = User & {
  profile: Profile | null;
};

// Full Beyblade with Parts
export type BeybladeWithParts = Beyblade & {
  blade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
};

// DeckItem with Parts
export type DeckItemWithParts = DeckItem & {
  bey: Beyblade | null;
  blade: Part | null;
  overBlade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
  lockChip: Part | null;
  assistBlade: Part | null;
};

// Deck with Items and their Parts
export type DeckWithItems = Deck & {
  items: DeckItemWithParts[];
};

// Match with Players
export type MatchWithPlayers = TournamentMatch & {
  player1: UserWithProfile | null;
  player2: UserWithProfile | null;
  winner: UserWithProfile | null;
  tournament: Tournament;
};

// Tournament with Participants and Matches
export type TournamentFull = Tournament & {
  participants: (TournamentParticipant & {
    user: UserWithProfile | null;
    deck: DeckWithItems | null;
  })[];
  matches: (TournamentMatch & {
    player1: UserWithProfile | null;
    player2: UserWithProfile | null;
    winner: UserWithProfile | null;
  })[];
};

// === Tables annexes (gacha annexe / modération / analytics) ===
export type AnalyticsEvent = InferSelectModel<Schema["analyticsEvents"]>;
export type GachaAnnouncement = InferSelectModel<Schema["gachaAnnouncements"]>;
export type GachaAuditLog = InferSelectModel<Schema["gachaAuditLog"]>;
export type GachaFriendship = InferSelectModel<Schema["gachaFriendships"]>;
export type Ticket = InferSelectModel<Schema["tickets"]>;

// === Insert types (payloads d'écriture pour la DAL / mutations API-first) ===
// `*Input` = forme acceptée par un INSERT Drizzle (colonnes à défaut/optionnelles
// rendues facultatives). À utiliser pour valider/typer les corps de mutation.
export type UserInput = InferInsertModel<Schema["users"]>;
export type ProfileInput = InferInsertModel<Schema["profiles"]>;
export type PartInput = InferInsertModel<Schema["parts"]>;
export type BeybladeInput = InferInsertModel<Schema["beyblades"]>;
export type DeckInput = InferInsertModel<Schema["decks"]>;
export type DeckItemInput = InferInsertModel<Schema["deckItems"]>;
export type TournamentInput = InferInsertModel<Schema["tournaments"]>;
export type TournamentCategoryInput = InferInsertModel<Schema["tournamentCategories"]>;
export type TournamentParticipantInput = InferInsertModel<Schema["tournamentParticipants"]>;
export type TournamentMatchInput = InferInsertModel<Schema["tournamentMatches"]>;
export type StaffMemberInput = InferInsertModel<Schema["staffMembers"]>;
export type ContentBlockInput = InferInsertModel<Schema["contentBlocks"]>;
export type ProductInput = InferInsertModel<Schema["products"]>;
export type AnimeSeriesInput = InferInsertModel<Schema["animeSeries"]>;
export type AnimeEpisodeInput = InferInsertModel<Schema["animeEpisodes"]>;
export type AnimeEpisodeSourceInput = InferInsertModel<Schema["animeEpisodeSources"]>;
export type GachaCardInput = InferInsertModel<Schema["gachaCards"]>;
export type CardInventoryInput = InferInsertModel<Schema["cardInventory"]>;
export type CurrencyTransactionInput = InferInsertModel<Schema["currencyTransactions"]>;
export type WarningInput = InferInsertModel<Schema["warnings"]>;
export type ReminderInput = InferInsertModel<Schema["reminders"]>;
export type TicketInput = InferInsertModel<Schema["tickets"]>;
export type StreamStateInput = InferInsertModel<Schema["streamStates"]>;
export type BeyLibraryPartInput = InferInsertModel<Schema["beyLibraryParts"]>;
