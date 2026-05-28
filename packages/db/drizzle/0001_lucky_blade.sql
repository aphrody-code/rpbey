CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"path" text,
	"referrer" text,
	"sessionId" text,
	"userId" text,
	"meta" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "analytics_events_path_idx" ON "analytics_events" USING btree ("path" text_ops);--> statement-breakpoint
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events" USING btree ("sessionId" text_ops);
