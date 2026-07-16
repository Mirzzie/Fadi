ALTER TABLE "applications" ADD COLUMN "career_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pipeline_scope" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD COLUMN "career_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_track_idx" ON "applications" USING btree ("user_id","career_profile_id");--> statement-breakpoint
CREATE INDEX "saved_jobs_user_track_idx" ON "saved_jobs" USING btree ("user_id","career_profile_id");