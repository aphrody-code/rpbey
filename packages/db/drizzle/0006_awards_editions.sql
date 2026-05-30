-- 0006_awards_editions.sql
-- Éditions des Beyblade Awards (vidéo de résultats + visibilité) + drapeau de
-- publication sur sondages/tier lists (édition à venir cachée pour préparation admin).
-- Idempotent.

ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "isPublished" boolean DEFAULT true NOT NULL;
ALTER TABLE "tier_lists" ADD COLUMN IF NOT EXISTS "isPublished" boolean DEFAULT true NOT NULL;

CREATE TABLE IF NOT EXISTS "awards_editions" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"videoUrl" text,
	"videoId" text,
	"pollCategory" text NOT NULL,
	"isPublished" boolean DEFAULT false NOT NULL,
	"isVotingOpen" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "awards_editions_year_key" ON "awards_editions" USING btree ("year" int4_ops);
CREATE UNIQUE INDEX IF NOT EXISTS "awards_editions_slug_key" ON "awards_editions" USING btree ("slug" text_ops);
