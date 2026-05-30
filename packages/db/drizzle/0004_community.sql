-- 0004_community.sql
-- Profils enrichis (personnalisation étendue) + système d'équipes communautaires
-- (teams / membres / invitations / chat). Toutes les colonnes timestamp sont en
-- mode "string" (ISO) côté Drizzle, cf. invariant @rpbey/db. Idempotent.

-- 1. Enrichissement de `profiles` -------------------------------------------------
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "displayName" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "pronouns" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bannerImage" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "region" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "postalCode" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "addressLine" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favoriteSeason" "AnimeGeneration";
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favoriteBeybladeId" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "favoriteDeckId" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "instagramHandle" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "youtubeHandle" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "twitchHandle" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "discordHandle" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "websiteUrl" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "accentColor" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "themePreference" text DEFAULT 'system' NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "profileVisibility" text DEFAULT 'PUBLIC' NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "showLocation" boolean DEFAULT false NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "showSocials" boolean DEFAULT true NOT NULL;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "onboardedAt" timestamp(3);

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_favoriteBeybladeId_fkey"
    FOREIGN KEY ("favoriteBeybladeId") REFERENCES "beyblades"("id")
    ON UPDATE cascade ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_favoriteDeckId_fkey"
    FOREIGN KEY ("favoriteDeckId") REFERENCES "decks"("id")
    ON UPDATE cascade ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Table `teams` ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"logoUrl" text,
	"bannerUrl" text,
	"description" text,
	"accentColor" text,
	"region" text,
	"captainId" text NOT NULL,
	"twitterHandle" text,
	"instagramHandle" text,
	"youtubeHandle" text,
	"twitchHandle" text,
	"discordInvite" text,
	"websiteUrl" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isRecruiting" boolean DEFAULT true NOT NULL,
	"memberCount" integer DEFAULT 1 NOT NULL,
	"totalPoints" integer DEFAULT 0 NOT NULL,
	"totalWins" integer DEFAULT 0 NOT NULL,
	"totalLosses" integer DEFAULT 0 NOT NULL,
	"totalTournamentWins" integer DEFAULT 0 NOT NULL,
	"foundedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_slug_key" ON "teams" USING btree ("slug" text_ops);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_tag_key" ON "teams" USING btree ("tag" text_ops);
CREATE INDEX IF NOT EXISTS "teams_captainId_idx" ON "teams" USING btree ("captainId" text_ops);
CREATE INDEX IF NOT EXISTS "teams_isPublic_idx" ON "teams" USING btree ("isPublic" bool_ops);
CREATE INDEX IF NOT EXISTS "teams_totalPoints_idx" ON "teams" USING btree ("totalPoints" int4_ops);
DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_captainId_fkey"
    FOREIGN KEY ("captainId") REFERENCES "users"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Table `team_members` ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"jerseyNumber" integer,
	"position" text,
	"joinedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Un blader n'appartient qu'à une seule équipe à la fois (clan unique).
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_userId_key" ON "team_members" USING btree ("userId" text_ops);
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_teamId_userId_key" ON "team_members" USING btree ("teamId" text_ops,"userId" text_ops);
CREATE INDEX IF NOT EXISTS "team_members_teamId_idx" ON "team_members" USING btree ("teamId" text_ops);
DO $$ BEGIN
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Table `team_invites` ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "team_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" text NOT NULL,
	"invitedById" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"respondedAt" timestamp(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_invites_teamId_userId_key" ON "team_invites" USING btree ("teamId" text_ops,"userId" text_ops);
CREATE INDEX IF NOT EXISTS "team_invites_userId_idx" ON "team_invites" USING btree ("userId" text_ops);
CREATE INDEX IF NOT EXISTS "team_invites_status_idx" ON "team_invites" USING btree ("status" text_ops);
DO $$ BEGIN
  ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id")
    ON UPDATE cascade ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Table `team_messages` (chat / partage d'équipe) ------------------------------
CREATE TABLE IF NOT EXISTS "team_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" text NOT NULL,
	"content" text NOT NULL,
	"kind" text DEFAULT 'TEXT' NOT NULL,
	"refId" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"editedAt" timestamp(3),
	"deletedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS "team_messages_teamId_createdAt_idx" ON "team_messages" USING btree ("teamId" text_ops,"createdAt" timestamp_ops);
DO $$ BEGIN
  ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "teams"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
