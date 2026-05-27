-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."AnimeGeneration" AS ENUM('ORIGINAL', 'METAL', 'BURST', 'X');--> statement-breakpoint
CREATE TYPE "public"."BeyType" AS ENUM('ATTACK', 'DEFENSE', 'STAMINA', 'BALANCE');--> statement-breakpoint
CREATE TYPE "public"."CardRarity" AS ENUM('COMMON', 'RARE', 'SUPER_RARE', 'LEGENDARY', 'SECRET');--> statement-breakpoint
CREATE TYPE "public"."CardType" AS ENUM('PNG', 'ARTIST');--> statement-breakpoint
CREATE TYPE "public"."EpisodeSourceType" AS ENUM('YOUTUBE', 'DAILYMOTION', 'MP4', 'HLS', 'IFRAME');--> statement-breakpoint
CREATE TYPE "public"."ExperienceLevel" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'LEGEND');--> statement-breakpoint
CREATE TYPE "public"."PartType" AS ENUM('BLADE', 'RATCHET', 'BIT', 'LOCK_CHIP', 'ASSIST_BLADE', 'OVER_BLADE');--> statement-breakpoint
CREATE TYPE "public"."ProductLine" AS ENUM('BX', 'UX', 'CX');--> statement-breakpoint
CREATE TYPE "public"."ProductType" AS ENUM('STARTER', 'BOOSTER', 'RANDOM_BOOSTER', 'SET', 'DOUBLE_STARTER', 'TOOL', 'COLOR_CHOICE');--> statement-breakpoint
CREATE TYPE "public"."TournamentStatus" AS ENUM('UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CHECKIN', 'UNDERWAY', 'COMPLETE', 'CANCELLED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."TransactionType" AS ENUM('DAILY_CLAIM', 'GACHA_PULL', 'ADMIN_GIVE', 'ADMIN_TAKE', 'TOURNAMENT_REWARD', 'SELL_CARD', 'STREAK_BONUS', 'MULTI_PULL', 'BADGE_REWARD', 'DUEL_REWARD');--> statement-breakpoint
CREATE TYPE "public"."WatchStatus" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beyblades" (
	"id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"nameEn" text,
	"nameFr" text,
	"bladeId" text NOT NULL,
	"ratchetId" text NOT NULL,
	"bitId" text NOT NULL,
	"beyType" "BeyType",
	"totalAttack" integer,
	"totalDefense" integer,
	"totalStamina" integer,
	"totalBurst" integer,
	"totalDash" integer,
	"totalWeight" double precision,
	"imageUrl" text,
	"productId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_inventory" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"cardId" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"obtainedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bey_library_parts" (
	"id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"type" text,
	"spin" text,
	"weight" double precision,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"imageUrl" text NOT NULL,
	"variantCount" integer DEFAULT 0 NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sourceUrl" text NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_wishlists" (
	"id" text NOT NULL,
	"profileId" text NOT NULL,
	"cardId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_commands" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"response" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"aliases" text[] DEFAULT '{"RAY"}',
	"cooldown" integer DEFAULT 0 NOT NULL,
	"allowedRoles" text[] DEFAULT '{"RAY"}',
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_transactions" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"amount" integer NOT NULL,
	"type" "TransactionType" NOT NULL,
	"note" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_blocks" (
	"id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text,
	"type" text DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"password" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_roles" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"position" integer NOT NULL,
	"icon" text,
	"permissions" text NOT NULL,
	"managed" boolean DEFAULT false NOT NULL,
	"hoist" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duel_matches" (
	"id" text NOT NULL,
	"challengerId" text NOT NULL,
	"opponentId" text NOT NULL,
	"winnerId" text NOT NULL,
	"bet" integer DEFAULT 0 NOT NULL,
	"score" text NOT NULL,
	"rounds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"finishType" text DEFAULT 'SPIN FINISH' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_announcements" (
	"id" text NOT NULL,
	"authorId" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_items" (
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"deckId" text NOT NULL,
	"beyId" text,
	"bladeId" text,
	"ratchetId" text,
	"bitId" text,
	"assistBladeId" text,
	"lockChipId" text,
	"overBladeId" text
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_cards" (
	"id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"nameJp" text,
	"series" text NOT NULL,
	"rarity" "CardRarity" DEFAULT 'COMMON' NOT NULL,
	"imageUrl" text,
	"beyblade" text,
	"description" text,
	"dropRate" double precision DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"def" integer DEFAULT 0 NOT NULL,
	"element" text DEFAULT 'NEUTRAL' NOT NULL,
	"specialMove" text,
	"artistName" text,
	"cardType" "CardType" DEFAULT 'PNG' NOT NULL,
	"dropId" text,
	"att" integer DEFAULT 0 NOT NULL,
	"end" integer DEFAULT 0 NOT NULL,
	"equilibre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_inventory" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"partId" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"obtainedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_tournament_archives" (
	"slug" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_adjustments" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"adminId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"nameEn" text,
	"nameFr" text,
	"productType" "ProductType" NOT NULL,
	"productLine" "ProductLine" NOT NULL,
	"price" integer,
	"releaseDate" timestamp(3),
	"isLimited" boolean DEFAULT false NOT NULL,
	"limitedNote" text,
	"imageUrl" text,
	"productUrl" text,
	"shopUrl" text,
	"includedParts" text[],
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"description" text,
	"hasbroCode" text,
	"nameHasbro" text
);
--> statement-breakpoint
CREATE TABLE "ranking_seasons" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"startDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"endDate" timestamp(3),
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"bladerName" text,
	"favoriteType" "BeyType",
	"experience" "ExperienceLevel" DEFAULT 'BEGINNER' NOT NULL,
	"bio" text,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"tournamentWins" integer DEFAULT 0 NOT NULL,
	"twitterHandle" text,
	"tiktokHandle" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"rankingPoints" integer DEFAULT 0 NOT NULL,
	"challongeUsername" text,
	"deckBoxImage" text,
	"currency" integer DEFAULT 0 NOT NULL,
	"lastDaily" timestamp(3),
	"dailyStreak" integer DEFAULT 0 NOT NULL,
	"lastGiftSent" timestamp(3),
	"pityCount" integer DEFAULT 0 NOT NULL,
	"duelBestStreak" integer DEFAULT 0 NOT NULL,
	"duelLosses" integer DEFAULT 0 NOT NULL,
	"duelRating" integer DEFAULT 1000 NOT NULL,
	"duelStreak" integer DEFAULT 0 NOT NULL,
	"duelWins" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_drops" (
	"id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"maxCards" integer DEFAULT 32 NOT NULL,
	"startDate" timestamp(3) NOT NULL,
	"endDate" timestamp(3) NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"imageUrl" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_system" (
	"id" text NOT NULL,
	"participation" integer DEFAULT 5 NOT NULL,
	"firstPlace" integer DEFAULT 20 NOT NULL,
	"secondPlace" integer DEFAULT 15 NOT NULL,
	"thirdPlace" integer DEFAULT 10 NOT NULL,
	"top8" integer DEFAULT 5 NOT NULL,
	"matchWin" integer DEFAULT 2 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"matchWinLoser" integer DEFAULT 500 NOT NULL,
	"matchWinWinner" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" text NOT NULL,
	"externalId" text NOT NULL,
	"name" text NOT NULL,
	"nameJp" text,
	"type" "PartType" NOT NULL,
	"beyType" "BeyType",
	"weight" double precision,
	"attack" text,
	"defense" text,
	"stamina" text,
	"burst" text,
	"dash" text,
	"height" integer,
	"protrusions" integer,
	"gearRatio" text,
	"shaftWidth" text,
	"tipType" text,
	"releaseDate" timestamp(3),
	"imageUrl" text,
	"rarity" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"modelUrl" text,
	"textureUrl" text,
	"spinDirection" text,
	"system" text
);
--> statement-breakpoint
CREATE TABLE "gacha_friendships" (
	"userId" text NOT NULL,
	"friendId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text NOT NULL,
	"discordId" text NOT NULL,
	"channelId" text NOT NULL,
	"message" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"fired" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satr_rankings" (
	"id" text NOT NULL,
	"rank" integer NOT NULL,
	"playerName" text NOT NULL,
	"score" integer NOT NULL,
	"wins" integer NOT NULL,
	"participation" integer NOT NULL,
	"winRate" text NOT NULL,
	"pointsAverage" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"season" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text NOT NULL,
	"channelId" text NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"closedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"teamId" text NOT NULL,
	"imageUrl" text,
	"discordId" text,
	"displayIndex" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"accountCreatedAt" timestamp(3),
	"activities" jsonb DEFAULT '[]'::jsonb,
	"globalName" text,
	"joinedAt" timestamp(3),
	"nickname" text,
	"premiumSince" timestamp(3),
	"roles" jsonb DEFAULT '[]'::jsonb,
	"serverAvatar" text,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "discord_channels" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parentId" text,
	"position" integer NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stardust_bladers" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"totalWins" integer DEFAULT 0 NOT NULL,
	"totalLosses" integer DEFAULT 0 NOT NULL,
	"tournamentWins" integer DEFAULT 0 NOT NULL,
	"tournamentsCount" integer DEFAULT 0 NOT NULL,
	"history" jsonb NOT NULL,
	"linkedUserId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stardust_rankings" (
	"id" text NOT NULL,
	"rank" integer NOT NULL,
	"playerName" text NOT NULL,
	"score" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"participation" integer NOT NULL,
	"winRate" text NOT NULL,
	"pointsAverage" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_states" (
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" text NOT NULL,
	"tournamentId" text NOT NULL,
	"challongeMatchId" text,
	"round" integer NOT NULL,
	"player1Id" text,
	"player2Id" text,
	"winnerId" text,
	"score" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"player1Name" text,
	"player2Name" text,
	"winnerName" text
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"date" timestamp(3) NOT NULL,
	"location" text,
	"format" text DEFAULT '3on3 Double Elimination' NOT NULL,
	"maxPlayers" integer DEFAULT 64 NOT NULL,
	"challongeId" text,
	"challongeUrl" text,
	"challongeState" text,
	"registrationStart" timestamp(3),
	"registrationEnd" timestamp(3),
	"announcementMessageId" text,
	"channelId" text,
	"status" "TournamentStatus" DEFAULT 'UPCOMING' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"categoryId" text,
	"activityLog" jsonb,
	"standings" jsonb,
	"stations" jsonb,
	"posterUrl" text,
	"poolStructure" jsonb,
	"legacyExport" jsonb
);
--> statement-breakpoint
CREATE TABLE "tournament_categories" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"multiplier" double precision DEFAULT 1 NOT NULL,
	"color" text,
	"logoUrl" text
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" text NOT NULL,
	"tournamentId" text NOT NULL,
	"userId" text,
	"challongeParticipantId" text,
	"deckId" text,
	"checkedIn" boolean DEFAULT false NOT NULL,
	"seed" integer,
	"finalPlacement" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"playerName" text
);
--> statement-breakpoint
CREATE TABLE "season_entries" (
	"id" text NOT NULL,
	"seasonId" text NOT NULL,
	"userId" text,
	"points" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"tournamentWins" integer NOT NULL,
	"rank" integer,
	"playerName" text
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" text NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" text NOT NULL,
	"discordId" text NOT NULL,
	"moderator" text NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gacha_audit_log" (
	"id" text NOT NULL,
	"userId" text,
	"action" text NOT NULL,
	"payload" jsonb,
	"ip" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wb_bladers" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"totalWins" integer DEFAULT 0 NOT NULL,
	"totalLosses" integer DEFAULT 0 NOT NULL,
	"tournamentWins" integer DEFAULT 0 NOT NULL,
	"tournamentsCount" integer DEFAULT 0 NOT NULL,
	"history" jsonb NOT NULL,
	"linkedUserId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wb_rankings" (
	"id" text NOT NULL,
	"rank" integer NOT NULL,
	"playerName" text NOT NULL,
	"score" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"participation" integer NOT NULL,
	"winRate" text NOT NULL,
	"pointsAverage" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"season" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_videos" (
	"id" text NOT NULL,
	"title" text NOT NULL,
	"channelName" text NOT NULL,
	"channelId" text NOT NULL,
	"channelAvatar" text,
	"views" integer NOT NULL,
	"thumbnail" text NOT NULL,
	"url" text NOT NULL,
	"duration" text NOT NULL,
	"publishedAt" timestamp(3) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isFeatured" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"discordId" text,
	"discordTag" text,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp(3),
	"username" text,
	"displayUsername" text,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"activities" jsonb DEFAULT '[]'::jsonb,
	"globalName" text,
	"joinedAt" timestamp(3),
	"nickname" text,
	"premiumSince" timestamp(3),
	"roles" jsonb DEFAULT '[]'::jsonb,
	"serverAvatar" text,
	"status" text,
	"ipAddress" text,
	"lastIpAddress" text
);
--> statement-breakpoint
CREATE TABLE "global_rankings" (
	"id" text NOT NULL,
	"playerName" text NOT NULL,
	"userId" text,
	"points" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"tournamentWins" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"avatarUrl" text,
	"tournamentsCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_episode_sources" (
	"id" text NOT NULL,
	"episodeId" text NOT NULL,
	"type" "EpisodeSourceType" NOT NULL,
	"url" text NOT NULL,
	"quality" text DEFAULT '720p' NOT NULL,
	"language" text DEFAULT 'VOSTFR' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satr_bladers" (
	"id" text NOT NULL,
	"name" text NOT NULL,
	"totalWins" integer DEFAULT 0 NOT NULL,
	"totalLosses" integer DEFAULT 0 NOT NULL,
	"tournamentsCount" integer DEFAULT 0 NOT NULL,
	"history" jsonb NOT NULL,
	"linkedUserId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"tournamentWins" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_episodes" (
	"id" text NOT NULL,
	"seriesId" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"titleFr" text,
	"titleJp" text,
	"synopsis" text,
	"thumbnailUrl" text,
	"duration" integer DEFAULT 0 NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_series" (
	"id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"titleJp" text,
	"titleFr" text,
	"generation" "AnimeGeneration" NOT NULL,
	"synopsis" text,
	"posterUrl" text,
	"bannerUrl" text,
	"year" integer NOT NULL,
	"episodeCount" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_watch_progress" (
	"id" text NOT NULL,
	"userId" text NOT NULL,
	"episodeId" text NOT NULL,
	"status" "WatchStatus" DEFAULT 'NOT_STARTED' NOT NULL,
	"progressTime" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beyblades" ADD CONSTRAINT "beyblades_bitId_fkey" FOREIGN KEY ("bitId") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "beyblades" ADD CONSTRAINT "beyblades_bladeId_fkey" FOREIGN KEY ("bladeId") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "beyblades" ADD CONSTRAINT "beyblades_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "beyblades" ADD CONSTRAINT "beyblades_ratchetId_fkey" FOREIGN KEY ("ratchetId") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."gacha_cards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_wishlists" ADD CONSTRAINT "card_wishlists_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."gacha_cards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_wishlists" ADD CONSTRAINT "card_wishlists_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "currency_transactions" ADD CONSTRAINT "currency_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_assistBladeId_fkey" FOREIGN KEY ("assistBladeId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_beyId_fkey" FOREIGN KEY ("beyId") REFERENCES "public"."beyblades"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_bitId_fkey" FOREIGN KEY ("bitId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_bladeId_fkey" FOREIGN KEY ("bladeId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_lockChipId_fkey" FOREIGN KEY ("lockChipId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_overBladeId_fkey" FOREIGN KEY ("overBladeId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_ratchetId_fkey" FOREIGN KEY ("ratchetId") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "gacha_cards" ADD CONSTRAINT "gacha_cards_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "public"."gacha_drops"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "part_inventory" ADD CONSTRAINT "part_inventory_partId_fkey" FOREIGN KEY ("partId") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "part_inventory" ADD CONSTRAINT "part_inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "gacha_friendships" ADD CONSTRAINT "gacha_friendships_friendId_users_id_fk" FOREIGN KEY ("friendId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gacha_friendships" ADD CONSTRAINT "gacha_friendships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."tournament_categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "season_entries" ADD CONSTRAINT "season_entries_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."ranking_seasons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "season_entries" ADD CONSTRAINT "season_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "global_rankings" ADD CONSTRAINT "global_rankings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "anime_episode_sources" ADD CONSTRAINT "anime_episode_sources_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "public"."anime_episodes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "anime_episodes" ADD CONSTRAINT "anime_episodes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "public"."anime_series"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "anime_watch_progress" ADD CONSTRAINT "anime_watch_progress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "public"."anime_episodes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "anime_watch_progress" ADD CONSTRAINT "anime_watch_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "beyblades_beyType_idx" ON "beyblades" USING btree ("beyType" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "beyblades_code_key" ON "beyblades" USING btree ("code" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "card_inventory_userId_cardId_key" ON "card_inventory" USING btree ("userId" text_ops,"cardId" text_ops);--> statement-breakpoint
CREATE INDEX "card_inventory_userId_idx" ON "card_inventory" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "bey_library_parts_category_idx" ON "bey_library_parts" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "bey_library_parts_type_idx" ON "bey_library_parts" USING btree ("type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "card_wishlists_profileId_cardId_key" ON "card_wishlists" USING btree ("profileId" text_ops,"cardId" text_ops);--> statement-breakpoint
CREATE INDEX "card_wishlists_profileId_idx" ON "card_wishlists" USING btree ("profileId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "bot_commands_name_key" ON "bot_commands" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "currency_transactions_createdAt_idx" ON "currency_transactions" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "currency_transactions_iap_note_uniq" ON "currency_transactions" USING btree ("note" text_ops) WHERE (note ~~ 'iap:%'::text);--> statement-breakpoint
CREATE INDEX "currency_transactions_userId_idx" ON "currency_transactions" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "content_blocks_slug_key" ON "content_blocks" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts" USING btree ("providerId" text_ops,"accountId" text_ops);--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "duel_matches_challengerId_idx" ON "duel_matches" USING btree ("challengerId" text_ops);--> statement-breakpoint
CREATE INDEX "duel_matches_opponentId_idx" ON "duel_matches" USING btree ("opponentId" text_ops);--> statement-breakpoint
CREATE INDEX "deck_items_deckId_idx" ON "deck_items" USING btree ("deckId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "deck_items_deckId_position_key" ON "deck_items" USING btree ("deckId" int4_ops,"position" int4_ops);--> statement-breakpoint
CREATE INDEX "decks_userId_idx" ON "decks" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "gacha_cards_dropId_idx" ON "gacha_cards" USING btree ("dropId" text_ops);--> statement-breakpoint
CREATE INDEX "gacha_cards_rarity_idx" ON "gacha_cards" USING btree ("rarity" enum_ops);--> statement-breakpoint
CREATE INDEX "gacha_cards_series_idx" ON "gacha_cards" USING btree ("series" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "gacha_cards_slug_key" ON "gacha_cards" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "part_inventory_userId_idx" ON "part_inventory" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "part_inventory_userId_partId_key" ON "part_inventory" USING btree ("userId" text_ops,"partId" text_ops);--> statement-breakpoint
CREATE INDEX "legacy_tournament_archives_source_idx" ON "legacy_tournament_archives" USING btree ("source" text_ops);--> statement-breakpoint
CREATE INDEX "point_adjustments_userId_idx" ON "point_adjustments" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_key" ON "products" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "products_productLine_idx" ON "products" USING btree ("productLine" enum_ops);--> statement-breakpoint
CREATE INDEX "products_productType_idx" ON "products" USING btree ("productType" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_seasons_slug_key" ON "ranking_seasons" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "profiles_duelRating_idx" ON "profiles" USING btree ("duelRating" int4_ops);--> statement-breakpoint
CREATE INDEX "profiles_rankingPoints_idx" ON "profiles" USING btree ("rankingPoints" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "gacha_drops_isActive_idx" ON "gacha_drops" USING btree ("isActive" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "gacha_drops_slug_key" ON "gacha_drops" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "parts_beyType_idx" ON "parts" USING btree ("beyType" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "parts_externalId_key" ON "parts" USING btree ("externalId" text_ops);--> statement-breakpoint
CREATE INDEX "parts_type_idx" ON "parts" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "reminders_discordId_idx" ON "reminders" USING btree ("discordId" text_ops);--> statement-breakpoint
CREATE INDEX "reminders_expiresAt_idx" ON "reminders" USING btree ("expiresAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "satr_rankings_playerName_idx" ON "satr_rankings" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "satr_rankings_score_idx" ON "satr_rankings" USING btree ("score" int4_ops);--> statement-breakpoint
CREATE INDEX "satr_rankings_season_idx" ON "satr_rankings" USING btree ("season" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_channelId_key" ON "tickets" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE INDEX "stardust_bladers_name_idx" ON "stardust_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "stardust_bladers_name_key" ON "stardust_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "stardust_rankings_playerName_idx" ON "stardust_rankings" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "stardust_rankings_score_idx" ON "stardust_rankings" USING btree ("score" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_matches_tournamentId_challongeMatchId_key" ON "tournament_matches" USING btree ("tournamentId" text_ops,"challongeMatchId" text_ops);--> statement-breakpoint
CREATE INDEX "tournament_matches_tournamentId_idx" ON "tournament_matches" USING btree ("tournamentId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_challongeId_key" ON "tournaments" USING btree ("challongeId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_categories_name_key" ON "tournament_categories" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "tournament_participants_playerName_idx" ON "tournament_participants" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "tournament_participants_tournamentId_idx" ON "tournament_participants" USING btree ("tournamentId" text_ops);--> statement-breakpoint
CREATE INDEX "tournament_participants_userId_idx" ON "tournament_participants" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "season_entries_playerName_idx" ON "season_entries" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "season_entries_seasonId_idx" ON "season_entries" USING btree ("seasonId" text_ops);--> statement-breakpoint
CREATE INDEX "season_entries_userId_idx" ON "season_entries" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "two_factors_userId_idx" ON "two_factors" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "warnings_discordId_idx" ON "warnings" USING btree ("discordId" text_ops);--> statement-breakpoint
CREATE INDEX "wb_bladers_name_idx" ON "wb_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "wb_bladers_name_key" ON "wb_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "wb_rankings_playerName_idx" ON "wb_rankings" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "wb_rankings_score_idx" ON "wb_rankings" USING btree ("score" int4_ops);--> statement-breakpoint
CREATE INDEX "wb_rankings_season_idx" ON "wb_rankings" USING btree ("season" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_discordId_key" ON "users" USING btree ("discordId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree ("username" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "global_rankings_playerName_key" ON "global_rankings" USING btree ("playerName" text_ops);--> statement-breakpoint
CREATE INDEX "global_rankings_points_idx" ON "global_rankings" USING btree ("points" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "global_rankings_userId_key" ON "global_rankings" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "anime_episode_sources_episodeId_idx" ON "anime_episode_sources" USING btree ("episodeId" text_ops);--> statement-breakpoint
CREATE INDEX "satr_bladers_name_idx" ON "satr_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "satr_bladers_name_key" ON "satr_bladers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "anime_episodes_seriesId_idx" ON "anime_episodes" USING btree ("seriesId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "anime_episodes_seriesId_number_key" ON "anime_episodes" USING btree ("seriesId" int4_ops,"number" int4_ops);--> statement-breakpoint
CREATE INDEX "anime_series_generation_idx" ON "anime_series" USING btree ("generation" enum_ops);--> statement-breakpoint
CREATE INDEX "anime_series_isPublished_idx" ON "anime_series" USING btree ("isPublished" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "anime_series_slug_key" ON "anime_series" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "anime_watch_progress_episodeId_idx" ON "anime_watch_progress" USING btree ("episodeId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "anime_watch_progress_userId_episodeId_key" ON "anime_watch_progress" USING btree ("userId" text_ops,"episodeId" text_ops);--> statement-breakpoint
CREATE INDEX "anime_watch_progress_userId_idx" ON "anime_watch_progress" USING btree ("userId" text_ops);
*/