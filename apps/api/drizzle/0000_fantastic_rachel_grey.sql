CREATE TABLE IF NOT EXISTS "conferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text NOT NULL,
	"location" text NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"event_status" text,
	"date_start" date NOT NULL,
	"date_end" date NOT NULL,
	"cfp_start" date,
	"cfp_end" date,
	"cfp_site" text,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"submitter_name" text,
	"submitter_email" text,
	"submission_note" text,
	"rejection_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conferences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conferences_moderation_idx" ON "conferences" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conferences_date_end_idx" ON "conferences" USING btree ("date_end");