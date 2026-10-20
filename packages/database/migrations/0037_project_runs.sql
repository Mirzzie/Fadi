CREATE TABLE "project_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"commitment_id" uuid,
	"title" text NOT NULL,
	"detail" text,
	"resource_id" uuid,
	"resource_label" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"verify" text,
	"produces" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"artifact" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_runs" ADD CONSTRAINT "project_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_runs" ADD CONSTRAINT "project_runs_resource_id_lab_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."lab_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_run_id_project_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."project_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_runs_user_idx" ON "project_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "project_steps_run_idx" ON "project_steps" USING btree ("run_id","ordinal");