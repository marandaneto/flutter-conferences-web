ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "is_admin" = TRUE
  WHERE "github_login" IN (
    SELECT "github_login" FROM "invites" WHERE "accepted_at" IS NOT NULL
  );
