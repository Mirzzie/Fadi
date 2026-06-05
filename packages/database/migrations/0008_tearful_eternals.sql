ALTER TABLE "career_profiles" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "intent" text DEFAULT 'career' NOT NULL;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "role_cluster" jsonb;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "career_profiles_user_active_idx" ON "career_profiles" USING btree ("user_id","is_active");