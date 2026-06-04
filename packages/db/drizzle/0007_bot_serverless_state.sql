-- Bot serverless state (ex-Redis) — Cloud Run singleton (min=1/max=1).
-- L'état jadis stocké dans Redis (compteur de mentions + méta de scan) est
-- reback en Postgres Neon. Idempotent (`IF NOT EXISTS`) : les autres tables du
-- schéma préexistent déjà dans la base Frankfurt (migrées Prisma + drizzle-pull),
-- seules ces deux tables sont neuves. Drizzle-kit `generate` avait régénéré un
-- diff complet faute de snapshots 0002–0006 committés ; on ne garde que le delta réel.

CREATE TABLE IF NOT EXISTS "bot_mentions" (
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bot_mentions_pkey" PRIMARY KEY("from_id","to_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_scan_meta" (
	"k" text PRIMARY KEY NOT NULL,
	"v" text NOT NULL
);
