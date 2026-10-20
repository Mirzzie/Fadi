CREATE TABLE "practice_grader_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"eval_version" text NOT NULL,
	"releasable" boolean NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practice_grader_checks" ADD CONSTRAINT "practice_grader_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_grader_checks_lookup_idx" ON "practice_grader_checks" USING btree ("user_id","provider","model","eval_version","created_at");