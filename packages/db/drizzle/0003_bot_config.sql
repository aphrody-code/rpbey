CREATE TABLE IF NOT EXISTS "bot_config" (
	"guildId" text PRIMARY KEY NOT NULL,
	"channels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"roles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ownerIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moderation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"economy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cooldowns" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"leveling" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"welcome" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goodbye" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"panels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logging" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
