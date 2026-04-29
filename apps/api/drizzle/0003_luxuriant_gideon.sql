CREATE TABLE IF NOT EXISTS "conference_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conference_id" uuid NOT NULL,
	"submitter_user_id" uuid,
	"proposed" jsonb NOT NULL,
	"submission_note" text,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conference_edits" ADD CONSTRAINT "conference_edits_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conference_edits" ADD CONSTRAINT "conference_edits_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edits_conference_idx" ON "conference_edits" USING btree ("conference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edits_moderation_idx" ON "conference_edits" USING btree ("moderation_status");