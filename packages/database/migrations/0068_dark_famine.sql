CREATE TABLE "practice_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid,
	"step_id" uuid,
	"run_label" text NOT NULL,
	"step_label" text NOT NULL,
	"assessment_kind" text NOT NULL,
	"assessment_id" text NOT NULL,
	"assessment_version" text NOT NULL,
	"verdict" text NOT NULL,
	"strength" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_ref_id" text NOT NULL,
	"observer_id" text NOT NULL,
	"observer_version" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_receipts_verdict_check" CHECK ("practice_receipts"."verdict" in ('pass', 'fail', 'unknown')),
	CONSTRAINT "practice_receipts_strength_check" CHECK ("practice_receipts"."strength" in ('self_reported', 'recorded', 'observed', 'verified'))
);
--> statement-breakpoint
ALTER TABLE "practice_receipts" ADD CONSTRAINT "practice_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_receipts" ADD CONSTRAINT "practice_receipts_run_id_project_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."project_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_receipts" ADD CONSTRAINT "practice_receipts_step_id_project_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."project_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_receipts_source_unique" ON "practice_receipts" USING btree ("user_id","source_kind","source_ref_id");--> statement-breakpoint
CREATE INDEX "practice_receipts_run_idx" ON "practice_receipts" USING btree ("user_id","run_id","observed_at");--> statement-breakpoint
CREATE INDEX "practice_receipts_step_idx" ON "practice_receipts" USING btree ("user_id","step_id","observed_at");