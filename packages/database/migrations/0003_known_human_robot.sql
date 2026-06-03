CREATE TABLE "momentum_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"momentum" integer DEFAULT 0 NOT NULL,
	"peak_momentum" integer DEFAULT 0 NOT NULL,
	"last_action_at" timestamp with time zone,
	"cadence_target" integer,
	"cadence_period" text DEFAULT 'week' NOT NULL,
	"resting_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resilience_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"momentum_delta" integer DEFAULT 0 NOT NULL,
	"application_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "outcome" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "outcome_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "rejection_stage" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "rejection_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "quality_score" integer;--> statement-breakpoint
ALTER TABLE "momentum_states" ADD CONSTRAINT "momentum_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resilience_events" ADD CONSTRAINT "resilience_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resilience_events" ADD CONSTRAINT "resilience_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "momentum_states_user_id_idx" ON "momentum_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resilience_events_user_id_idx" ON "resilience_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resilience_events_kind_idx" ON "resilience_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "resilience_events_user_created_at_idx" ON "resilience_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "applications_outcome_idx" ON "applications" USING btree ("outcome");