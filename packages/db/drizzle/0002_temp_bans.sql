CREATE TABLE "temp_bans" (
	"id" text PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"discordId" text NOT NULL,
	"discordTag" text NOT NULL,
	"moderatorId" text NOT NULL,
	"reason" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"unbannedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX "temp_bans_guildId_discordId_idx" ON "temp_bans" USING btree ("guildId" text_ops, "discordId" text_ops);--> statement-breakpoint
CREATE INDEX "temp_bans_expiresAt_idx" ON "temp_bans" USING btree ("expiresAt" timestamp_ops);
