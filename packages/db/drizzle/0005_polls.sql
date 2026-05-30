-- 0005_polls.sql
-- Sondages (vote type Google Forms) + tier lists communautaires.
-- Toutes les colonnes timestamp en mode "string" (ISO). Idempotent.

-- 1. Sondages -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "polls" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'SINGLE' NOT NULL,
	"category" text,
	"season" "AnimeGeneration",
	"imageUrl" text,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"isClosed" boolean DEFAULT false NOT NULL,
	"totalVotes" integer DEFAULT 0 NOT NULL,
	"createdById" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "polls_slug_key" ON "polls" USING btree ("slug" text_ops);
CREATE INDEX IF NOT EXISTS "polls_isFeatured_idx" ON "polls" USING btree ("isFeatured" bool_ops);
CREATE INDEX IF NOT EXISTS "polls_season_idx" ON "polls" USING btree ("season");
DO $$ BEGIN
  ALTER TABLE "polls" ADD CONSTRAINT "polls_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON UPDATE cascade ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "poll_options" (
	"id" text PRIMARY KEY NOT NULL,
	"pollId" text NOT NULL,
	"label" text NOT NULL,
	"imageUrl" text,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"voteCount" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "poll_options_pollId_idx" ON "poll_options" USING btree ("pollId" text_ops);
DO $$ BEGIN
  ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey"
    FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "poll_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"pollId" text NOT NULL,
	"optionId" text NOT NULL,
	"userId" text,
	"anonId" text,
	"rating" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- Anti-doublon : un (poll, votant, option) au plus. Le choix simple remplace côté app.
CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_user_unique" ON "poll_votes" USING btree ("pollId" text_ops,"userId" text_ops,"optionId" text_ops) WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_anon_unique" ON "poll_votes" USING btree ("pollId" text_ops,"anonId" text_ops,"optionId" text_ops) WHERE "anonId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "poll_votes_pollId_idx" ON "poll_votes" USING btree ("pollId" text_ops);
DO $$ BEGIN
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey"
    FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tier lists -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tier_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'BEY' NOT NULL,
	"season" "AnimeGeneration",
	"imageUrl" text,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"totalSubmissions" integer DEFAULT 0 NOT NULL,
	"createdById" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tier_lists_slug_key" ON "tier_lists" USING btree ("slug" text_ops);
CREATE INDEX IF NOT EXISTS "tier_lists_kind_idx" ON "tier_lists" USING btree ("kind" text_ops);
CREATE INDEX IF NOT EXISTS "tier_lists_season_idx" ON "tier_lists" USING btree ("season");
DO $$ BEGIN
  ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON UPDATE cascade ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "tier_list_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"tierListId" text NOT NULL,
	"label" text NOT NULL,
	"imageUrl" text,
	"refType" text,
	"refId" text,
	"displayOrder" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "tier_list_subjects_tierListId_idx" ON "tier_list_subjects" USING btree ("tierListId" text_ops);
DO $$ BEGIN
  ALTER TABLE "tier_list_subjects" ADD CONSTRAINT "tier_list_subjects_tierListId_fkey"
    FOREIGN KEY ("tierListId") REFERENCES "tier_lists"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Une soumission = le placement complet d'un votant pour une tier list.
CREATE TABLE IF NOT EXISTS "tier_list_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"tierListId" text NOT NULL,
	"userId" text,
	"anonId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tier_list_votes_user_unique" ON "tier_list_votes" USING btree ("tierListId" text_ops,"userId" text_ops) WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tier_list_votes_anon_unique" ON "tier_list_votes" USING btree ("tierListId" text_ops,"anonId" text_ops) WHERE "anonId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tier_list_votes_tierListId_idx" ON "tier_list_votes" USING btree ("tierListId" text_ops);
DO $$ BEGIN
  ALTER TABLE "tier_list_votes" ADD CONSTRAINT "tier_list_votes_tierListId_fkey"
    FOREIGN KEY ("tierListId") REFERENCES "tier_lists"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "tier_list_votes" ADD CONSTRAINT "tier_list_votes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Placement d'un sujet dans un tier (S/A/B/C/D/F) au sein d'une soumission.
CREATE TABLE IF NOT EXISTS "tier_list_placements" (
	"id" text PRIMARY KEY NOT NULL,
	"voteId" text NOT NULL,
	"subjectId" text NOT NULL,
	"tier" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "tier_list_placements_voteId_idx" ON "tier_list_placements" USING btree ("voteId" text_ops);
CREATE INDEX IF NOT EXISTS "tier_list_placements_subjectId_idx" ON "tier_list_placements" USING btree ("subjectId" text_ops);
DO $$ BEGIN
  ALTER TABLE "tier_list_placements" ADD CONSTRAINT "tier_list_placements_voteId_fkey"
    FOREIGN KEY ("voteId") REFERENCES "tier_list_votes"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "tier_list_placements" ADD CONSTRAINT "tier_list_placements_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "tier_list_subjects"("id") ON UPDATE cascade ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
