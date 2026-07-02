CREATE TABLE "learning_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"career_profile_id" uuid,
	"gap" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'project' NOT NULL,
	"search_query" text,
	"status" text DEFAULT 'committed' NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_commitments" ADD CONSTRAINT "learning_commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_commitments" ADD CONSTRAINT "learning_commitments_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_commitments" ADD CONSTRAINT "learning_commitments_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_commitments_user_id_idx" ON "learning_commitments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learning_commitments_user_status_idx" ON "learning_commitments" USING btree ("user_id","status");