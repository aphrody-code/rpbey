import { relations } from "drizzle-orm/relations";
import {
  parts,
  beyblades,
  products,
  gachaCards,
  cardInventory,
  users,
  cardWishlists,
  profiles,
  currencyTransactions,
  accounts,
  deckItems,
  decks,
  gachaDrops,
  partInventory,
  pointAdjustments,
  gachaFriendships,
  sessions,
  tickets,
  tournamentMatches,
  tournaments,
  tournamentCategories,
  tournamentParticipants,
  rankingSeasons,
  seasonEntries,
  twoFactors,
  globalRankings,
  animeEpisodes,
  animeEpisodeSources,
  animeSeries,
  animeWatchProgress,
  animeFrames,
  teams,
  teamMembers,
  teamInvites,
  teamMessages,
  polls,
  pollOptions,
  pollVotes,
  tierLists,
  tierListSubjects,
  tierListVotes,
  tierListPlacements,
} from "./schema";

export const beybladesRelations = relations(beyblades, ({ one, many }) => ({
  part_bitId: one(parts, {
    fields: [beyblades.bitId],
    references: [parts.id],
    relationName: "beyblades_bitId_parts_id",
  }),
  part_bladeId: one(parts, {
    fields: [beyblades.bladeId],
    references: [parts.id],
    relationName: "beyblades_bladeId_parts_id",
  }),
  product: one(products, {
    fields: [beyblades.productId],
    references: [products.id],
  }),
  part_ratchetId: one(parts, {
    fields: [beyblades.ratchetId],
    references: [parts.id],
    relationName: "beyblades_ratchetId_parts_id",
  }),
  deckItems: many(deckItems),
}));

export const partsRelations = relations(parts, ({ many }) => ({
  beyblades_bitId: many(beyblades, {
    relationName: "beyblades_bitId_parts_id",
  }),
  beyblades_bladeId: many(beyblades, {
    relationName: "beyblades_bladeId_parts_id",
  }),
  beyblades_ratchetId: many(beyblades, {
    relationName: "beyblades_ratchetId_parts_id",
  }),
  deckItems_assistBladeId: many(deckItems, {
    relationName: "deckItems_assistBladeId_parts_id",
  }),
  deckItems_bitId: many(deckItems, {
    relationName: "deckItems_bitId_parts_id",
  }),
  deckItems_bladeId: many(deckItems, {
    relationName: "deckItems_bladeId_parts_id",
  }),
  deckItems_lockChipId: many(deckItems, {
    relationName: "deckItems_lockChipId_parts_id",
  }),
  deckItems_overBladeId: many(deckItems, {
    relationName: "deckItems_overBladeId_parts_id",
  }),
  deckItems_ratchetId: many(deckItems, {
    relationName: "deckItems_ratchetId_parts_id",
  }),
  partInventories: many(partInventory),
}));

export const productsRelations = relations(products, ({ many }) => ({
  beyblades: many(beyblades),
}));

export const cardInventoryRelations = relations(cardInventory, ({ one }) => ({
  gachaCard: one(gachaCards, {
    fields: [cardInventory.cardId],
    references: [gachaCards.id],
  }),
  user: one(users, {
    fields: [cardInventory.userId],
    references: [users.id],
  }),
}));

export const gachaCardsRelations = relations(gachaCards, ({ one, many }) => ({
  cardInventories: many(cardInventory),
  cardWishlists: many(cardWishlists),
  gachaDrop: one(gachaDrops, {
    fields: [gachaCards.dropId],
    references: [gachaDrops.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  cardInventories: many(cardInventory),
  currencyTransactions: many(currencyTransactions),
  accounts: many(accounts),
  decks: many(decks),
  partInventories: many(partInventory),
  pointAdjustments_adminId: many(pointAdjustments, {
    relationName: "pointAdjustments_adminId_users_id",
  }),
  pointAdjustments_userId: many(pointAdjustments, {
    relationName: "pointAdjustments_userId_users_id",
  }),
  profiles: many(profiles),
  gachaFriendships_friendId: many(gachaFriendships, {
    relationName: "gachaFriendships_friendId_users_id",
  }),
  gachaFriendships_userId: many(gachaFriendships, {
    relationName: "gachaFriendships_userId_users_id",
  }),
  sessions: many(sessions),
  tickets: many(tickets),
  tournamentMatches_player1Id: many(tournamentMatches, {
    relationName: "tournamentMatches_player1Id_users_id",
  }),
  tournamentMatches_player2Id: many(tournamentMatches, {
    relationName: "tournamentMatches_player2Id_users_id",
  }),
  tournamentMatches_winnerId: many(tournamentMatches, {
    relationName: "tournamentMatches_winnerId_users_id",
  }),
  tournamentParticipants: many(tournamentParticipants),
  seasonEntries: many(seasonEntries),
  twoFactors: many(twoFactors),
  globalRankings: many(globalRankings),
  animeWatchProgresses: many(animeWatchProgress),
  teamsCaptained: many(teams),
  teamMembership: many(teamMembers),
  teamInvites_userId: many(teamInvites, {
    relationName: "teamInvites_userId_users_id",
  }),
  teamInvites_invitedById: many(teamInvites, {
    relationName: "teamInvites_invitedById_users_id",
  }),
  teamMessages: many(teamMessages),
}));

export const cardWishlistsRelations = relations(cardWishlists, ({ one }) => ({
  gachaCard: one(gachaCards, {
    fields: [cardWishlists.cardId],
    references: [gachaCards.id],
  }),
  profile: one(profiles, {
    fields: [cardWishlists.profileId],
    references: [profiles.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  cardWishlists: many(cardWishlists),
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  favoriteBeyblade: one(beyblades, {
    fields: [profiles.favoriteBeybladeId],
    references: [beyblades.id],
  }),
  favoriteDeck: one(decks, {
    fields: [profiles.favoriteDeckId],
    references: [decks.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  captain: one(users, {
    fields: [teams.captainId],
    references: [users.id],
  }),
  members: many(teamMembers),
  invites: many(teamInvites),
  messages: many(teamMessages),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvites.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamInvites.userId],
    references: [users.id],
    relationName: "teamInvites_userId_users_id",
  }),
  invitedBy: one(users, {
    fields: [teamInvites.invitedById],
    references: [users.id],
    relationName: "teamInvites_invitedById_users_id",
  }),
}));

export const teamMessagesRelations = relations(teamMessages, ({ one }) => ({
  team: one(teams, {
    fields: [teamMessages.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMessages.userId],
    references: [users.id],
  }),
}));

export const currencyTransactionsRelations = relations(currencyTransactions, ({ one }) => ({
  user: one(users, {
    fields: [currencyTransactions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const deckItemsRelations = relations(deckItems, ({ one }) => ({
  part_assistBladeId: one(parts, {
    fields: [deckItems.assistBladeId],
    references: [parts.id],
    relationName: "deckItems_assistBladeId_parts_id",
  }),
  beyblade: one(beyblades, {
    fields: [deckItems.beyId],
    references: [beyblades.id],
  }),
  part_bitId: one(parts, {
    fields: [deckItems.bitId],
    references: [parts.id],
    relationName: "deckItems_bitId_parts_id",
  }),
  part_bladeId: one(parts, {
    fields: [deckItems.bladeId],
    references: [parts.id],
    relationName: "deckItems_bladeId_parts_id",
  }),
  deck: one(decks, {
    fields: [deckItems.deckId],
    references: [decks.id],
  }),
  part_lockChipId: one(parts, {
    fields: [deckItems.lockChipId],
    references: [parts.id],
    relationName: "deckItems_lockChipId_parts_id",
  }),
  part_overBladeId: one(parts, {
    fields: [deckItems.overBladeId],
    references: [parts.id],
    relationName: "deckItems_overBladeId_parts_id",
  }),
  part_ratchetId: one(parts, {
    fields: [deckItems.ratchetId],
    references: [parts.id],
    relationName: "deckItems_ratchetId_parts_id",
  }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  deckItems: many(deckItems),
  user: one(users, {
    fields: [decks.userId],
    references: [users.id],
  }),
  tournamentParticipants: many(tournamentParticipants),
}));

export const gachaDropsRelations = relations(gachaDrops, ({ many }) => ({
  gachaCards: many(gachaCards),
}));

export const partInventoryRelations = relations(partInventory, ({ one }) => ({
  part: one(parts, {
    fields: [partInventory.partId],
    references: [parts.id],
  }),
  user: one(users, {
    fields: [partInventory.userId],
    references: [users.id],
  }),
}));

export const pointAdjustmentsRelations = relations(pointAdjustments, ({ one }) => ({
  user_adminId: one(users, {
    fields: [pointAdjustments.adminId],
    references: [users.id],
    relationName: "pointAdjustments_adminId_users_id",
  }),
  user_userId: one(users, {
    fields: [pointAdjustments.userId],
    references: [users.id],
    relationName: "pointAdjustments_userId_users_id",
  }),
}));

export const gachaFriendshipsRelations = relations(gachaFriendships, ({ one }) => ({
  user_friendId: one(users, {
    fields: [gachaFriendships.friendId],
    references: [users.id],
    relationName: "gachaFriendships_friendId_users_id",
  }),
  user_userId: one(users, {
    fields: [gachaFriendships.userId],
    references: [users.id],
    relationName: "gachaFriendships_userId_users_id",
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  user: one(users, {
    fields: [tickets.userId],
    references: [users.id],
  }),
}));

export const tournamentMatchesRelations = relations(tournamentMatches, ({ one }) => ({
  user_player1Id: one(users, {
    fields: [tournamentMatches.player1Id],
    references: [users.id],
    relationName: "tournamentMatches_player1Id_users_id",
  }),
  user_player2Id: one(users, {
    fields: [tournamentMatches.player2Id],
    references: [users.id],
    relationName: "tournamentMatches_player2Id_users_id",
  }),
  tournament: one(tournaments, {
    fields: [tournamentMatches.tournamentId],
    references: [tournaments.id],
  }),
  user_winnerId: one(users, {
    fields: [tournamentMatches.winnerId],
    references: [users.id],
    relationName: "tournamentMatches_winnerId_users_id",
  }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  tournamentMatches: many(tournamentMatches),
  tournamentCategory: one(tournamentCategories, {
    fields: [tournaments.categoryId],
    references: [tournamentCategories.id],
  }),
  tournamentParticipants: many(tournamentParticipants),
}));

export const tournamentCategoriesRelations = relations(tournamentCategories, ({ many }) => ({
  tournaments: many(tournaments),
}));

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one }) => ({
  deck: one(decks, {
    fields: [tournamentParticipants.deckId],
    references: [decks.id],
  }),
  tournament: one(tournaments, {
    fields: [tournamentParticipants.tournamentId],
    references: [tournaments.id],
  }),
  user: one(users, {
    fields: [tournamentParticipants.userId],
    references: [users.id],
  }),
}));

export const seasonEntriesRelations = relations(seasonEntries, ({ one }) => ({
  rankingSeason: one(rankingSeasons, {
    fields: [seasonEntries.seasonId],
    references: [rankingSeasons.id],
  }),
  user: one(users, {
    fields: [seasonEntries.userId],
    references: [users.id],
  }),
}));

export const rankingSeasonsRelations = relations(rankingSeasons, ({ many }) => ({
  seasonEntries: many(seasonEntries),
}));

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}));

export const globalRankingsRelations = relations(globalRankings, ({ one }) => ({
  user: one(users, {
    fields: [globalRankings.userId],
    references: [users.id],
  }),
}));

export const animeEpisodeSourcesRelations = relations(animeEpisodeSources, ({ one }) => ({
  animeEpisode: one(animeEpisodes, {
    fields: [animeEpisodeSources.episodeId],
    references: [animeEpisodes.id],
  }),
}));

export const animeEpisodesRelations = relations(animeEpisodes, ({ one, many }) => ({
  animeEpisodeSources: many(animeEpisodeSources),
  animeSery: one(animeSeries, {
    fields: [animeEpisodes.seriesId],
    references: [animeSeries.id],
  }),
  animeWatchProgresses: many(animeWatchProgress),
  animeFrames: many(animeFrames),
}));

export const animeSeriesRelations = relations(animeSeries, ({ many }) => ({
  animeEpisodes: many(animeEpisodes),
  animeFrames: many(animeFrames),
}));

export const animeFramesRelations = relations(animeFrames, ({ one }) => ({
  animeSery: one(animeSeries, {
    fields: [animeFrames.seriesId],
    references: [animeSeries.id],
  }),
  animeEpisode: one(animeEpisodes, {
    fields: [animeFrames.episodeId],
    references: [animeEpisodes.id],
  }),
}));

export const animeWatchProgressRelations = relations(animeWatchProgress, ({ one }) => ({
  animeEpisode: one(animeEpisodes, {
    fields: [animeWatchProgress.episodeId],
    references: [animeEpisodes.id],
  }),
  user: one(users, {
    fields: [animeWatchProgress.userId],
    references: [users.id],
  }),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  options: many(pollOptions),
  votes: many(pollVotes),
  creator: one(users, {
    fields: [polls.createdById],
    references: [users.id],
  }),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id],
  }),
  option: one(pollOptions, {
    fields: [pollVotes.optionId],
    references: [pollOptions.id],
  }),
  user: one(users, {
    fields: [pollVotes.userId],
    references: [users.id],
  }),
}));

export const tierListsRelations = relations(tierLists, ({ many }) => ({
  subjects: many(tierListSubjects),
  votes: many(tierListVotes),
}));

export const tierListSubjectsRelations = relations(tierListSubjects, ({ one, many }) => ({
  tierList: one(tierLists, {
    fields: [tierListSubjects.tierListId],
    references: [tierLists.id],
  }),
  placements: many(tierListPlacements),
}));

export const tierListVotesRelations = relations(tierListVotes, ({ one, many }) => ({
  tierList: one(tierLists, {
    fields: [tierListVotes.tierListId],
    references: [tierLists.id],
  }),
  user: one(users, {
    fields: [tierListVotes.userId],
    references: [users.id],
  }),
  placements: many(tierListPlacements),
}));

export const tierListPlacementsRelations = relations(tierListPlacements, ({ one }) => ({
  vote: one(tierListVotes, {
    fields: [tierListPlacements.voteId],
    references: [tierListVotes.id],
  }),
  subject: one(tierListSubjects, {
    fields: [tierListPlacements.subjectId],
    references: [tierListSubjects.id],
  }),
}));
