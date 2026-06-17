CREATE TABLE "referral_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"company" text NOT NULL,
	"role_title" text,
	"contact_name" text,
	"contact_role" text,
	"relationship" text DEFAULT 'cold' NOT NULL,
	"channel" text,
	"status" text DEFAULT 'identified' NOT NULL,
	"outreach_draft" text,
	"notes" text,
	"asked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_targets" ADD CONSTRAINT "referral_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_targets" ADD CONSTRAINT "referral_targets_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_targets_user_id_idx" ON "referral_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_targets_user_status_idx" ON "referral_targets" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "referral_targets_application_id_idx" ON "referral_targets" USING btree ("application_id");