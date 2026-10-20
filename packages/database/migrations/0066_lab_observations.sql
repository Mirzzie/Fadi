CREATE TABLE "lab_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"predicate_id" text NOT NULL,
	"predicate_version" integer NOT NULL,
	"params_key" text DEFAULT '' NOT NULL,
	"verdict" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observer_version" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_observations" ADD CONSTRAINT "lab_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_observations_subject_predicate_idx" ON "lab_observations" USING btree ("user_id","subject","predicate_id","params_key");