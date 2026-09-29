CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"job_id" uuid,
	"career_profile_id" uuid,
	"role" text NOT NULL,
	"company" text,
	"stage" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"mode" text DEFAULT 'turn_based' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_sessions_stage_check" CHECK ("interview_sessions"."stage" in ('recruiter', 'hiring_manager', 'technical', 'behavioral')),
	CONSTRAINT "interview_sessions_mode_check" CHECK ("interview_sessions"."mode" in ('turn_based', 'realtime')),
	CONSTRAINT "interview_sessions_status_check" CHECK ("interview_sessions"."status" in ('active', 'completed', 'abandoned', 'failed')),
	CONSTRAINT "interview_sessions_duration_check" CHECK ("interview_sessions"."duration_minutes" in (10, 20))
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_sessions_user_status_idx" ON "interview_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "interview_sessions_application_idx" ON "interview_sessions" USING btree ("application_id");