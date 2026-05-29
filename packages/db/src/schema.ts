import {
	pgTable,
	varchar,
	timestamp,
	text,
	integer,
	index,
	uniqueIndex,
	foreignKey,
	primaryKey,
	doublePrecision,
	jsonb,
	boolean,
	pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const animeGeneration = pgEnum("AnimeGeneration", [
	"ORIGINAL",
	"METAL",
	"BURST",
	"X",
]);
export const beyType = pgEnum("BeyType", [
	"ATTACK",
	"DEFENSE",
	"STAMINA",
	"BALANCE",
]);
export const cardRarity = pgEnum("CardRarity", [
	"COMMON",
	"RARE",
	"SUPER_RARE",
	"LEGENDARY",
	"SECRET",
]);
export const cardType = pgEnum("CardType", ["PNG", "ARTIST"]);
export const episodeSourceType = pgEnum("EpisodeSourceType", [
	"YOUTUBE",
	"DAILYMOTION",
	"MP4",
	"HLS",
	"IFRAME",
]);
export const experienceLevel = pgEnum("ExperienceLevel", [
	"BEGINNER",
	"INTERMEDIATE",
	"ADVANCED",
	"EXPERT",
	"LEGEND",
]);
export const partType = pgEnum("PartType", [
	"BLADE",
	"RATCHET",
	"BIT",
	"LOCK_CHIP",
	"ASSIST_BLADE",
	"OVER_BLADE",
]);
export const productLine = pgEnum("ProductLine", ["BX", "UX", "CX"]);
export const productType = pgEnum("ProductType", [
	"STARTER",
	"BOOSTER",
	"RANDOM_BOOSTER",
	"SET",
	"DOUBLE_STARTER",
	"TOOL",
	"COLOR_CHOICE",
]);
export const tournamentStatus = pgEnum("TournamentStatus", [
	"UPCOMING",
	"REGISTRATION_OPEN",
	"REGISTRATION_CLOSED",
	"CHECKIN",
	"UNDERWAY",
	"COMPLETE",
	"CANCELLED",
	"ARCHIVED",
]);
export const transactionType = pgEnum("TransactionType", [
	"DAILY_CLAIM",
	"GACHA_PULL",
	"ADMIN_GIVE",
	"ADMIN_TAKE",
	"TOURNAMENT_REWARD",
	"SELL_CARD",
	"STREAK_BONUS",
	"MULTI_PULL",
	"BADGE_REWARD",
	"DUEL_REWARD",
]);
export const watchStatus = pgEnum("WatchStatus", [
	"NOT_STARTED",
	"IN_PROGRESS",
	"COMPLETED",
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", {
		withTimezone: true,
		mode: "string",
	}),
	startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
		.defaultNow()
		.notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const analyticsEvents = pgTable(
	"analytics_events",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		type: text().notNull(),
		path: text(),
		referrer: text(),
		sessionId: text(),
		userId: text(),
		meta: jsonb().$type<Record<string, unknown> | null>(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("analytics_events_createdAt_idx").using(
			"btree",
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		index("analytics_events_type_idx").using(
			"btree",
			table.type.asc().nullsLast().op("text_ops"),
		),
		index("analytics_events_path_idx").using(
			"btree",
			table.path.asc().nullsLast().op("text_ops"),
		),
		index("analytics_events_sessionId_idx").using(
			"btree",
			table.sessionId.asc().nullsLast().op("text_ops"),
		),
	],
);

export const beyblades = pgTable(
	"beyblades",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		code: text().notNull(),
		name: text().notNull(),
		nameEn: text(),
		nameFr: text(),
		bladeId: text().notNull(),
		ratchetId: text().notNull(),
		bitId: text().notNull(),
		beyType: beyType(),
		totalAttack: integer(),
		totalDefense: integer(),
		totalStamina: integer(),
		totalBurst: integer(),
		totalDash: integer(),
		totalWeight: doublePrecision(),
		imageUrl: text(),
		productId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("beyblades_beyType_idx").using(
			"btree",
			table.beyType.asc().nullsLast().op("enum_ops"),
		),
		uniqueIndex("beyblades_code_key").using(
			"btree",
			table.code.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.bitId],
			foreignColumns: [parts.id],
			name: "beyblades_bitId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.bladeId],
			foreignColumns: [parts.id],
			name: "beyblades_bladeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "beyblades_productId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.ratchetId],
			foreignColumns: [parts.id],
			name: "beyblades_ratchetId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const cardInventory = pgTable(
	"card_inventory",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		cardId: text().notNull(),
		count: integer().default(1).notNull(),
		obtainedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("card_inventory_userId_cardId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.cardId.asc().nullsLast().op("text_ops"),
		),
		index("card_inventory_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.cardId],
			foreignColumns: [gachaCards.id],
			name: "card_inventory_cardId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "card_inventory_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const beyLibraryParts = pgTable(
	"bey_library_parts",
	{
		id: text().primaryKey().notNull(),
		category: text().notNull(),
		name: text().notNull(),
		code: text().notNull(),
		type: text(),
		spin: text(),
		weight: doublePrecision(),
		specs: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
		imageUrl: text().notNull(),
		variantCount: integer().default(0).notNull(),
		variants: jsonb().$type<unknown[]>().default([]).notNull(),
		features: jsonb().$type<unknown[]>().default([]).notNull(),
		sourceUrl: text().notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("bey_library_parts_category_idx").using(
			"btree",
			table.category.asc().nullsLast().op("text_ops"),
		),
		index("bey_library_parts_type_idx").using(
			"btree",
			table.type.asc().nullsLast().op("text_ops"),
		),
	],
);

export const cardWishlists = pgTable(
	"card_wishlists",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		profileId: text().notNull(),
		cardId: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("card_wishlists_profileId_cardId_key").using(
			"btree",
			table.profileId.asc().nullsLast().op("text_ops"),
			table.cardId.asc().nullsLast().op("text_ops"),
		),
		index("card_wishlists_profileId_idx").using(
			"btree",
			table.profileId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.cardId],
			foreignColumns: [gachaCards.id],
			name: "card_wishlists_cardId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "card_wishlists_profileId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const botCommands = pgTable(
	"bot_commands",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		description: text().notNull(),
		response: text().notNull(),
		enabled: boolean().default(true).notNull(),
		aliases: text().array().default(sql`ARRAY[]::text[]`),
		cooldown: integer().default(0).notNull(),
		allowedRoles: text().array().default(sql`ARRAY[]::text[]`),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		uniqueIndex("bot_commands_name_key").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
	],
);

export const currencyTransactions = pgTable(
	"currency_transactions",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		amount: integer().notNull(),
		type: transactionType().notNull(),
		note: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("currency_transactions_createdAt_idx").using(
			"btree",
			table.createdAt.asc().nullsLast().op("timestamp_ops"),
		),
		uniqueIndex("currency_transactions_iap_note_uniq")
			.using("btree", table.note.asc().nullsLast().op("text_ops"))
			.where(sql`(note ~~ 'iap:%'::text)`),
		index("currency_transactions_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "currency_transactions_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const contentBlocks = pgTable(
	"content_blocks",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		slug: text().notNull(),
		title: text(),
		type: text().default("text").notNull(),
		content: text().notNull(),
		metadata: jsonb().$type<Record<string, unknown> | null>(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		uniqueIndex("content_blocks_slug_key").using(
			"btree",
			table.slug.asc().nullsLast().op("text_ops"),
		),
	],
);

export const accounts = pgTable(
	"accounts",
	{
		id: text().primaryKey().notNull(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text().notNull(),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: timestamp({ precision: 3, mode: "date" }),
		refreshTokenExpiresAt: timestamp({ precision: 3, mode: "date" }),
		scope: text(),
		password: text(),
		createdAt: timestamp({ precision: 3, mode: "date" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "date" })
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("accounts_providerId_accountId_key").using(
			"btree",
			table.providerId.asc().nullsLast().op("text_ops"),
			table.accountId.asc().nullsLast().op("text_ops"),
		),
		index("accounts_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const discordRoles = pgTable("discord_roles", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	color: text().notNull(),
	position: integer().notNull(),
	icon: text(),
	permissions: text().notNull(),
	managed: boolean().default(false).notNull(),
	hoist: boolean().default(false).notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
});

export const duelMatches = pgTable(
	"duel_matches",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		challengerId: text().notNull(),
		opponentId: text().notNull(),
		winnerId: text().notNull(),
		bet: integer().default(0).notNull(),
		score: text().notNull(),
		rounds: jsonb().$type<unknown[]>().default([]).notNull(),
		finishType: text().default("SPIN FINISH").notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("duel_matches_challengerId_idx").using(
			"btree",
			table.challengerId.asc().nullsLast().op("text_ops"),
		),
		index("duel_matches_opponentId_idx").using(
			"btree",
			table.opponentId.asc().nullsLast().op("text_ops"),
		),
	],
);

export const gachaAnnouncements = pgTable("gacha_announcements", {
	id: text().primaryKey().notNull(),
	authorId: text().notNull(),
	severity: text().default("info").notNull(),
	title: text().notNull(),
	body: text().notNull(),
	pinned: boolean().default(false).notNull(),
	publishedAt: timestamp({ mode: "string" }).defaultNow().notNull(),
	expiresAt: timestamp({ mode: "string" }),
	createdAt: timestamp({ mode: "string" }).defaultNow().notNull(),
});

export const deckItems = pgTable(
	"deck_items",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		position: integer().notNull(),
		deckId: text().notNull(),
		beyId: text(),
		bladeId: text(),
		ratchetId: text(),
		bitId: text(),
		assistBladeId: text(),
		lockChipId: text(),
		overBladeId: text(),
	},
	(table) => [
		index("deck_items_deckId_idx").using(
			"btree",
			table.deckId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("deck_items_deckId_position_key").using(
			"btree",
			table.deckId.asc().nullsLast().op("int4_ops"),
			table.position.asc().nullsLast().op("int4_ops"),
		),
		foreignKey({
			columns: [table.assistBladeId],
			foreignColumns: [parts.id],
			name: "deck_items_assistBladeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.beyId],
			foreignColumns: [beyblades.id],
			name: "deck_items_beyId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.bitId],
			foreignColumns: [parts.id],
			name: "deck_items_bitId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.bladeId],
			foreignColumns: [parts.id],
			name: "deck_items_bladeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.deckId],
			foreignColumns: [decks.id],
			name: "deck_items_deckId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.lockChipId],
			foreignColumns: [parts.id],
			name: "deck_items_lockChipId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.overBladeId],
			foreignColumns: [parts.id],
			name: "deck_items_overBladeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.ratchetId],
			foreignColumns: [parts.id],
			name: "deck_items_ratchetId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const decks = pgTable(
	"decks",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		isActive: boolean().default(false).notNull(),
		userId: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("decks_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "decks_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const gachaCards = pgTable(
	"gacha_cards",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		slug: text().notNull(),
		name: text().notNull(),
		nameJp: text(),
		series: text().notNull(),
		rarity: cardRarity().default("COMMON").notNull(),
		imageUrl: text(),
		beyblade: text(),
		description: text(),
		dropRate: doublePrecision().default(0).notNull(),
		isActive: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		def: integer().default(0).notNull(),
		element: text().default("NEUTRAL").notNull(),
		specialMove: text(),
		artistName: text(),
		cardType: cardType().default("PNG").notNull(),
		dropId: text(),
		att: integer().default(0).notNull(),
		end: integer().default(0).notNull(),
		equilibre: integer().default(0).notNull(),
	},
	(table) => [
		index("gacha_cards_dropId_idx").using(
			"btree",
			table.dropId.asc().nullsLast().op("text_ops"),
		),
		index("gacha_cards_rarity_idx").using(
			"btree",
			table.rarity.asc().nullsLast().op("enum_ops"),
		),
		index("gacha_cards_series_idx").using(
			"btree",
			table.series.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("gacha_cards_slug_key").using(
			"btree",
			table.slug.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.dropId],
			foreignColumns: [gachaDrops.id],
			name: "gacha_cards_dropId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const partInventory = pgTable(
	"part_inventory",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		partId: text().notNull(),
		count: integer().default(1).notNull(),
		obtainedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("part_inventory_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("part_inventory_userId_partId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.partId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.partId],
			foreignColumns: [parts.id],
			name: "part_inventory_partId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "part_inventory_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const legacyTournamentArchives = pgTable(
	"legacy_tournament_archives",
	{
		slug: text().primaryKey().notNull(),
		source: text().notNull(),
		payload: jsonb().$type<unknown>().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("legacy_tournament_archives_source_idx").using(
			"btree",
			table.source.asc().nullsLast().op("text_ops"),
		),
	],
);

export const pointAdjustments = pgTable(
	"point_adjustments",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		points: integer().notNull(),
		reason: text().notNull(),
		adminId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("point_adjustments_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.adminId],
			foreignColumns: [users.id],
			name: "point_adjustments_adminId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "point_adjustments_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const products = pgTable(
	"products",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		code: text().notNull(),
		name: text().notNull(),
		nameEn: text(),
		nameFr: text(),
		productType: productType().notNull(),
		productLine: productLine().notNull(),
		price: integer(),
		releaseDate: timestamp({ precision: 3, mode: "string" }),
		isLimited: boolean().default(false).notNull(),
		limitedNote: text(),
		imageUrl: text(),
		productUrl: text(),
		shopUrl: text(),
		includedParts: text().array(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		description: text(),
		hasbroCode: text(),
		nameHasbro: text(),
	},
	(table) => [
		uniqueIndex("products_code_key").using(
			"btree",
			table.code.asc().nullsLast().op("text_ops"),
		),
		index("products_productLine_idx").using(
			"btree",
			table.productLine.asc().nullsLast().op("enum_ops"),
		),
		index("products_productType_idx").using(
			"btree",
			table.productType.asc().nullsLast().op("enum_ops"),
		),
	],
);

export const rankingSeasons = pgTable(
	"ranking_seasons",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		slug: text().notNull(),
		startDate: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		endDate: timestamp({ precision: 3, mode: "string" }),
		isActive: boolean().default(true).notNull(),
	},
	(table) => [
		uniqueIndex("ranking_seasons_slug_key").using(
			"btree",
			table.slug.asc().nullsLast().op("text_ops"),
		),
	],
);

export const profiles = pgTable(
	"profiles",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		bladerName: text(),
		favoriteType: beyType(),
		experience: experienceLevel().default("BEGINNER").notNull(),
		bio: text(),
		wins: integer().default(0).notNull(),
		losses: integer().default(0).notNull(),
		tournamentWins: integer().default(0).notNull(),
		twitterHandle: text(),
		tiktokHandle: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		rankingPoints: integer().default(0).notNull(),
		challongeUsername: text(),
		deckBoxImage: text(),
		currency: integer().default(0).notNull(),
		lastDaily: timestamp({ precision: 3, mode: "string" }),
		dailyStreak: integer().default(0).notNull(),
		lastGiftSent: timestamp({ precision: 3, mode: "string" }),
		pityCount: integer().default(0).notNull(),
		duelBestStreak: integer().default(0).notNull(),
		duelLosses: integer().default(0).notNull(),
		duelRating: integer().default(1000).notNull(),
		duelStreak: integer().default(0).notNull(),
		duelWins: integer().default(0).notNull(),
	},
	(table) => [
		index("profiles_duelRating_idx").using(
			"btree",
			table.duelRating.asc().nullsLast().op("int4_ops"),
		),
		index("profiles_rankingPoints_idx").using(
			"btree",
			table.rankingPoints.asc().nullsLast().op("int4_ops"),
		),
		uniqueIndex("profiles_userId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const gachaDrops = pgTable(
	"gacha_drops",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		slug: text().notNull(),
		name: text().notNull(),
		theme: text().notNull(),
		season: integer().default(1).notNull(),
		maxCards: integer().default(32).notNull(),
		startDate: timestamp({ precision: 3, mode: "string" }).notNull(),
		endDate: timestamp({ precision: 3, mode: "string" }).notNull(),
		isActive: boolean().default(false).notNull(),
		imageUrl: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("gacha_drops_isActive_idx").using(
			"btree",
			table.isActive.asc().nullsLast().op("bool_ops"),
		),
		uniqueIndex("gacha_drops_slug_key").using(
			"btree",
			table.slug.asc().nullsLast().op("text_ops"),
		),
	],
);

export const rankingSystem = pgTable("ranking_system", {
	id: text()
		.primaryKey()
		.notNull()
		.$defaultFn(() => createId()),
	participation: integer().default(5).notNull(),
	firstPlace: integer().default(20).notNull(),
	secondPlace: integer().default(15).notNull(),
	thirdPlace: integer().default(10).notNull(),
	top8: integer().default(5).notNull(),
	matchWin: integer().default(2).notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
	matchWinLoser: integer().default(500).notNull(),
	matchWinWinner: integer().default(1000).notNull(),
});

export const parts = pgTable(
	"parts",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		externalId: text().notNull(),
		name: text().notNull(),
		nameJp: text(),
		type: partType().notNull(),
		beyType: beyType(),
		weight: doublePrecision(),
		attack: text(),
		defense: text(),
		stamina: text(),
		burst: text(),
		dash: text(),
		height: integer(),
		protrusions: integer(),
		gearRatio: text(),
		shaftWidth: text(),
		tipType: text(),
		releaseDate: timestamp({ precision: 3, mode: "string" }),
		imageUrl: text(),
		rarity: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		modelUrl: text(),
		textureUrl: text(),
		spinDirection: text(),
		system: text(),
	},
	(table) => [
		index("parts_beyType_idx").using(
			"btree",
			table.beyType.asc().nullsLast().op("enum_ops"),
		),
		uniqueIndex("parts_externalId_key").using(
			"btree",
			table.externalId.asc().nullsLast().op("text_ops"),
		),
		index("parts_type_idx").using(
			"btree",
			table.type.asc().nullsLast().op("enum_ops"),
		),
	],
);

export const gachaFriendships = pgTable(
	"gacha_friendships",
	{
		userId: text().notNull(),
		friendId: text().notNull(),
		status: text().default("pending").notNull(),
		createdAt: timestamp({ mode: "string" }).defaultNow().notNull(),
		updatedAt: timestamp({ mode: "string" })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		primaryKey({
			columns: [table.userId, table.friendId],
			name: "gacha_friendships_pkey",
		}),
		foreignKey({
			columns: [table.friendId],
			foreignColumns: [users.id],
			name: "gacha_friendships_friendId_users_id_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gacha_friendships_userId_users_id_fk",
		}).onDelete("cascade"),
	],
);

export const reminders = pgTable(
	"reminders",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		discordId: text().notNull(),
		channelId: text().notNull(),
		message: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
		fired: boolean().default(false).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("reminders_discordId_idx").using(
			"btree",
			table.discordId.asc().nullsLast().op("text_ops"),
		),
		index("reminders_expiresAt_idx").using(
			"btree",
			table.expiresAt.asc().nullsLast().op("timestamp_ops"),
		),
	],
);

export const satrRankings = pgTable(
	"satr_rankings",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		rank: integer().notNull(),
		playerName: text().notNull(),
		score: integer().notNull(),
		wins: integer().notNull(),
		participation: integer().notNull(),
		winRate: text().notNull(),
		pointsAverage: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		losses: integer().default(0).notNull(),
		season: integer().default(2).notNull(),
	},
	(table) => [
		index("satr_rankings_playerName_idx").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("satr_rankings_score_idx").using(
			"btree",
			table.score.asc().nullsLast().op("int4_ops"),
		),
		index("satr_rankings_season_idx").using(
			"btree",
			table.season.asc().nullsLast().op("int4_ops"),
		),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: text().primaryKey().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "date" }).notNull(),
		token: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "date" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "date" })
			.notNull()
			.$onUpdate(() => new Date()),
		ipAddress: text(),
		userAgent: text(),
		userId: text().notNull(),
		impersonatedBy: text(),
	},
	(table) => [
		uniqueIndex("sessions_token_key").using(
			"btree",
			table.token.asc().nullsLast().op("text_ops"),
		),
		index("sessions_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const tickets = pgTable(
	"tickets",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		channelId: text().notNull(),
		userId: text().notNull(),
		type: text().notNull(),
		status: text().default("OPEN").notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		closedAt: timestamp({ precision: 3, mode: "string" }),
	},
	(table) => [
		uniqueIndex("tickets_channelId_key").using(
			"btree",
			table.channelId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "tickets_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const staffMembers = pgTable("staff_members", {
	id: text()
		.primaryKey()
		.notNull()
		.$defaultFn(() => createId()),
	name: text().notNull(),
	role: text().notNull(),
	teamId: text().notNull(),
	imageUrl: text(),
	discordId: text(),
	displayIndex: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: "string" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
	accountCreatedAt: timestamp({ precision: 3, mode: "string" }),
	activities: jsonb().$type<unknown[]>().default([]),
	globalName: text(),
	joinedAt: timestamp({ precision: 3, mode: "string" }),
	nickname: text(),
	premiumSince: timestamp({ precision: 3, mode: "string" }),
	roles: jsonb().$type<unknown[]>().default([]),
	serverAvatar: text(),
	status: text(),
});

export const discordChannels = pgTable("discord_channels", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	parentId: text(),
	position: integer().notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
});

export const stardustBladers = pgTable(
	"stardust_bladers",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		totalWins: integer().default(0).notNull(),
		totalLosses: integer().default(0).notNull(),
		tournamentWins: integer().default(0).notNull(),
		tournamentsCount: integer().default(0).notNull(),
		history: jsonb().$type<unknown>().notNull(),
		linkedUserId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("stardust_bladers_name_idx").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("stardust_bladers_name_key").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
	],
);

export const stardustRankings = pgTable(
	"stardust_rankings",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		rank: integer().notNull(),
		playerName: text().notNull(),
		score: integer().notNull(),
		wins: integer().notNull(),
		losses: integer().default(0).notNull(),
		participation: integer().notNull(),
		winRate: text().notNull(),
		pointsAverage: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("stardust_rankings_playerName_idx").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("stardust_rankings_score_idx").using(
			"btree",
			table.score.asc().nullsLast().op("int4_ops"),
		),
	],
);

export const streamStates = pgTable("stream_states", {
	key: text().primaryKey().notNull(),
	payload: jsonb().$type<unknown>().notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
});

export const tournamentMatches = pgTable(
	"tournament_matches",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		tournamentId: text().notNull(),
		challongeMatchId: text(),
		round: integer().notNull(),
		player1Id: text(),
		player2Id: text(),
		winnerId: text(),
		score: text(),
		state: text().default("pending").notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		player1Name: text(),
		player2Name: text(),
		winnerName: text(),
	},
	(table) => [
		uniqueIndex("tournament_matches_tournamentId_challongeMatchId_key").using(
			"btree",
			table.tournamentId.asc().nullsLast().op("text_ops"),
			table.challongeMatchId.asc().nullsLast().op("text_ops"),
		),
		index("tournament_matches_tournamentId_idx").using(
			"btree",
			table.tournamentId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.player1Id],
			foreignColumns: [users.id],
			name: "tournament_matches_player1Id_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.player2Id],
			foreignColumns: [users.id],
			name: "tournament_matches_player2Id_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "tournament_matches_tournamentId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.winnerId],
			foreignColumns: [users.id],
			name: "tournament_matches_winnerId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const tournaments = pgTable(
	"tournaments",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		description: text(),
		date: timestamp({ precision: 3, mode: "string" }).notNull(),
		location: text(),
		format: text().default("3on3 Double Elimination").notNull(),
		maxPlayers: integer().default(64).notNull(),
		challongeId: text(),
		challongeUrl: text(),
		challongeState: text(),
		registrationStart: timestamp({ precision: 3, mode: "string" }),
		registrationEnd: timestamp({ precision: 3, mode: "string" }),
		announcementMessageId: text(),
		channelId: text(),
		status: tournamentStatus().default("UPCOMING").notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		weight: doublePrecision().default(1).notNull(),
		categoryId: text(),
		activityLog: jsonb().$type<unknown>(),
		standings: jsonb().$type<unknown>(),
		stations: jsonb().$type<unknown>(),
		posterUrl: text(),
		poolStructure: jsonb().$type<unknown>(),
		legacyExport: jsonb().$type<unknown>(),
	},
	(table) => [
		uniqueIndex("tournaments_challongeId_key").using(
			"btree",
			table.challongeId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.categoryId],
			foreignColumns: [tournamentCategories.id],
			name: "tournaments_categoryId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);

export const tournamentCategories = pgTable(
	"tournament_categories",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		multiplier: doublePrecision().default(1).notNull(),
		color: text(),
		logoUrl: text(),
	},
	(table) => [
		uniqueIndex("tournament_categories_name_key").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
	],
);

export const tournamentParticipants = pgTable(
	"tournament_participants",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		tournamentId: text().notNull(),
		userId: text(),
		challongeParticipantId: text(),
		deckId: text(),
		checkedIn: boolean().default(false).notNull(),
		seed: integer(),
		finalPlacement: integer(),
		wins: integer().default(0).notNull(),
		losses: integer().default(0).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		playerName: text(),
	},
	(table) => [
		index("tournament_participants_playerName_idx").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("tournament_participants_tournamentId_idx").using(
			"btree",
			table.tournamentId.asc().nullsLast().op("text_ops"),
		),
		index("tournament_participants_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.deckId],
			foreignColumns: [decks.id],
			name: "tournament_participants_deckId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
		foreignKey({
			columns: [table.tournamentId],
			foreignColumns: [tournaments.id],
			name: "tournament_participants_tournamentId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "tournament_participants_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const seasonEntries = pgTable(
	"season_entries",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		seasonId: text().notNull(),
		userId: text(),
		points: integer().notNull(),
		wins: integer().notNull(),
		losses: integer().notNull(),
		tournamentWins: integer().notNull(),
		rank: integer(),
		playerName: text(),
	},
	(table) => [
		index("season_entries_playerName_idx").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("season_entries_seasonId_idx").using(
			"btree",
			table.seasonId.asc().nullsLast().op("text_ops"),
		),
		index("season_entries_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.seasonId],
			foreignColumns: [rankingSeasons.id],
			name: "season_entries_seasonId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "season_entries_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const twoFactors = pgTable(
	"two_factors",
	{
		id: text().primaryKey().notNull(),
		secret: text().notNull(),
		backupCodes: text().notNull(),
		userId: text().notNull(),
	},
	(table) => [
		index("two_factors_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "two_factors_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const verifications = pgTable(
	"verifications",
	{
		id: text().primaryKey().notNull(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: timestamp({ precision: 3, mode: "date" }).notNull(),
		createdAt: timestamp({ precision: 3, mode: "date" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "date" })
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("verifications_identifier_idx").using(
			"btree",
			table.identifier.asc().nullsLast().op("text_ops"),
		),
	],
);

export const warnings = pgTable(
	"warnings",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		discordId: text().notNull(),
		moderator: text().notNull(),
		reason: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(table) => [
		index("warnings_discordId_idx").using(
			"btree",
			table.discordId.asc().nullsLast().op("text_ops"),
		),
	],
);

export const gachaAuditLog = pgTable("gacha_audit_log", {
	id: text().primaryKey().notNull(),
	userId: text(),
	action: text().notNull(),
	payload: jsonb().$type<unknown>(),
	ip: text(),
	userAgent: text(),
	createdAt: timestamp({ mode: "string" }).defaultNow().notNull(),
});

export const wbBladers = pgTable(
	"wb_bladers",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		totalWins: integer().default(0).notNull(),
		totalLosses: integer().default(0).notNull(),
		tournamentWins: integer().default(0).notNull(),
		tournamentsCount: integer().default(0).notNull(),
		history: jsonb().$type<unknown>().notNull(),
		linkedUserId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("wb_bladers_name_idx").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("wb_bladers_name_key").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
	],
);

export const wbRankings = pgTable(
	"wb_rankings",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		rank: integer().notNull(),
		playerName: text().notNull(),
		score: integer().notNull(),
		wins: integer().notNull(),
		losses: integer().default(0).notNull(),
		participation: integer().notNull(),
		winRate: text().notNull(),
		pointsAverage: text().notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		season: integer().default(2).notNull(),
	},
	(table) => [
		index("wb_rankings_playerName_idx").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("wb_rankings_score_idx").using(
			"btree",
			table.score.asc().nullsLast().op("int4_ops"),
		),
		index("wb_rankings_season_idx").using(
			"btree",
			table.season.asc().nullsLast().op("int4_ops"),
		),
	],
);

export const youtubeVideos = pgTable("youtube_videos", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	channelName: text().notNull(),
	channelId: text().notNull(),
	channelAvatar: text(),
	views: integer().notNull(),
	thumbnail: text().notNull(),
	url: text().notNull(),
	duration: text().notNull(),
	publishedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
	createdAt: timestamp({ precision: 3, mode: "string" })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updatedAt: timestamp({ precision: 3, mode: "string" })
		.notNull()
		.$onUpdate(() => new Date().toISOString()),
	isFeatured: boolean().default(true).notNull(),
});

export const users = pgTable(
	"users",
	{
		id: text().primaryKey().notNull(),
		name: text(),
		email: text().notNull(),
		emailVerified: boolean().default(false).notNull(),
		image: text(),
		createdAt: timestamp({ precision: 3, mode: "date" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "date" })
			.notNull()
			.$onUpdate(() => new Date()),
		discordId: text(),
		discordTag: text(),
		role: text().default("user"),
		banned: boolean().default(false),
		banReason: text(),
		banExpires: timestamp({ precision: 3, mode: "date" }),
		username: text(),
		displayUsername: text(),
		twoFactorEnabled: boolean().default(false).notNull(),
		activities: jsonb().$type<unknown[]>().default([]),
		globalName: text(),
		joinedAt: timestamp({ precision: 3, mode: "string" }),
		nickname: text(),
		premiumSince: timestamp({ precision: 3, mode: "string" }),
		roles: jsonb().$type<unknown[]>().default([]),
		serverAvatar: text(),
		status: text(),
		ipAddress: text(),
		lastIpAddress: text(),
	},
	(table) => [
		uniqueIndex("users_discordId_key").using(
			"btree",
			table.discordId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("users_email_key").using(
			"btree",
			table.email.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("users_username_key").using(
			"btree",
			table.username.asc().nullsLast().op("text_ops"),
		),
	],
);

export const globalRankings = pgTable(
	"global_rankings",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		playerName: text().notNull(),
		userId: text(),
		points: integer().default(0).notNull(),
		wins: integer().default(0).notNull(),
		losses: integer().default(0).notNull(),
		tournamentWins: integer().default(0).notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		avatarUrl: text(),
		tournamentsCount: integer().default(0).notNull(),
	},
	(table) => [
		uniqueIndex("global_rankings_playerName_key").using(
			"btree",
			table.playerName.asc().nullsLast().op("text_ops"),
		),
		index("global_rankings_points_idx").using(
			"btree",
			table.points.asc().nullsLast().op("int4_ops"),
		),
		uniqueIndex("global_rankings_userId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "global_rankings_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const animeEpisodeSources = pgTable(
	"anime_episode_sources",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		episodeId: text().notNull(),
		type: episodeSourceType().notNull(),
		url: text().notNull(),
		quality: text().default("720p").notNull(),
		language: text().default("VOSTFR").notNull(),
		priority: integer().default(0).notNull(),
		isActive: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("anime_episode_sources_episodeId_idx").using(
			"btree",
			table.episodeId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.episodeId],
			foreignColumns: [animeEpisodes.id],
			name: "anime_episode_sources_episodeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const satrBladers = pgTable(
	"satr_bladers",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		name: text().notNull(),
		totalWins: integer().default(0).notNull(),
		totalLosses: integer().default(0).notNull(),
		tournamentsCount: integer().default(0).notNull(),
		history: jsonb().$type<unknown>().notNull(),
		linkedUserId: text(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
		tournamentWins: integer().default(0).notNull(),
	},
	(table) => [
		index("satr_bladers_name_idx").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("satr_bladers_name_key").using(
			"btree",
			table.name.asc().nullsLast().op("text_ops"),
		),
	],
);

export const animeEpisodes = pgTable(
	"anime_episodes",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		seriesId: text().notNull(),
		number: integer().notNull(),
		title: text().notNull(),
		titleFr: text(),
		titleJp: text(),
		synopsis: text(),
		thumbnailUrl: text(),
		duration: integer().default(0).notNull(),
		isPublished: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("anime_episodes_seriesId_idx").using(
			"btree",
			table.seriesId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("anime_episodes_seriesId_number_key").using(
			"btree",
			table.seriesId.asc().nullsLast().op("int4_ops"),
			table.number.asc().nullsLast().op("int4_ops"),
		),
		foreignKey({
			columns: [table.seriesId],
			foreignColumns: [animeSeries.id],
			name: "anime_episodes_seriesId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

export const animeSeries = pgTable(
	"anime_series",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		slug: text().notNull(),
		title: text().notNull(),
		titleJp: text(),
		titleFr: text(),
		generation: animeGeneration().notNull(),
		synopsis: text(),
		posterUrl: text(),
		bannerUrl: text(),
		year: integer().notNull(),
		episodeCount: integer().default(0).notNull(),
		sortOrder: integer().default(0).notNull(),
		isPublished: boolean().default(true).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("anime_series_generation_idx").using(
			"btree",
			table.generation.asc().nullsLast().op("enum_ops"),
		),
		index("anime_series_isPublished_idx").using(
			"btree",
			table.isPublished.asc().nullsLast().op("bool_ops"),
		),
		uniqueIndex("anime_series_slug_key").using(
			"btree",
			table.slug.asc().nullsLast().op("text_ops"),
		),
	],
);

export const animeWatchProgress = pgTable(
	"anime_watch_progress",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		userId: text().notNull(),
		episodeId: text().notNull(),
		status: watchStatus().default("NOT_STARTED").notNull(),
		progressTime: integer().default(0).notNull(),
		completedAt: timestamp({ precision: 3, mode: "string" }),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("anime_watch_progress_episodeId_idx").using(
			"btree",
			table.episodeId.asc().nullsLast().op("text_ops"),
		),
		uniqueIndex("anime_watch_progress_userId_episodeId_key").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
			table.episodeId.asc().nullsLast().op("text_ops"),
		),
		index("anime_watch_progress_userId_idx").using(
			"btree",
			table.userId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.episodeId],
			foreignColumns: [animeEpisodes.id],
			name: "anime_watch_progress_episodeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "anime_watch_progress_userId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
	],
);

// Frames / captures d'anime (source: fancaps.net via cdn.rpbey.fr proxy).
// Galerie d'images par série/épisode, taggées personnages (dénormalisé — pas de
// table `characters` en DB ; noms canoniques = data/universe_characters.json).
// Usages : remplir le gacha (cartes persos non dessinés), backgrounds site/jeu,
// recherche « Google Images ». Timestamps mode:"string" (invariant non-auth).
export const animeFrames = pgTable(
	"anime_frames",
	{
		id: text()
			.primaryKey()
			.notNull()
			.$defaultFn(() => createId()),
		seriesId: text().notNull(),
		episodeId: text(),
		episodeNumber: integer(),
		source: text().default("fancaps").notNull(),
		sourceId: text().notNull(),
		sourceUrl: text(),
		imageUrl: text().notNull(),
		thumbUrl: text(),
		width: integer(),
		height: integer(),
		characterNames: jsonb().$type<string[]>().default([]).notNull(),
		tags: jsonb().$type<string[]>().default([]).notNull(),
		caption: text(),
		isNotable: boolean().default(false).notNull(),
		sortOrder: integer().default(0).notNull(),
		createdAt: timestamp({ precision: 3, mode: "string" })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp({ precision: 3, mode: "string" })
			.notNull()
			.$onUpdate(() => new Date().toISOString()),
	},
	(table) => [
		index("anime_frames_seriesId_idx").using(
			"btree",
			table.seriesId.asc().nullsLast().op("text_ops"),
		),
		index("anime_frames_episodeId_idx").using(
			"btree",
			table.episodeId.asc().nullsLast().op("text_ops"),
		),
		index("anime_frames_isNotable_idx").using(
			"btree",
			table.isNotable.asc().nullsLast().op("bool_ops"),
		),
		uniqueIndex("anime_frames_source_sourceId_key").using(
			"btree",
			table.source.asc().nullsLast().op("text_ops"),
			table.sourceId.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.seriesId],
			foreignColumns: [animeSeries.id],
			name: "anime_frames_seriesId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.episodeId],
			foreignColumns: [animeEpisodes.id],
			name: "anime_frames_episodeId_fkey",
		})
			.onUpdate("cascade")
			.onDelete("set null"),
	],
);
