ALTER TABLE "career_profiles" ADD COLUMN "embedding" jsonb;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "embedding_basis" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "embedding" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "embedding_model" text;