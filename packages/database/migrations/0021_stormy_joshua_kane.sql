ALTER TABLE "jobs" ADD COLUMN "liveness_state" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "liveness_checked_at" timestamp with time zone;