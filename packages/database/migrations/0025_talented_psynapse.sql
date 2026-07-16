CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"site_id" uuid NOT NULL,
	"evidence_item_id" uuid,
	"section" text DEFAULT 'project' NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"date_range" text,
	"description" text,
	"bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tag" text,
	"url" text,
	"image_url" text,
	"gallery" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"career_profile_id" uuid,
	"handle" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"headline" text,
	"template" text DEFAULT 'noir-gold' NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resume_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_site_id_portfolio_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."portfolio_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_evidence_item_id_evidence_items_id_fk" FOREIGN KEY ("evidence_item_id") REFERENCES "public"."evidence_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_sites" ADD CONSTRAINT "portfolio_sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_sites" ADD CONSTRAINT "portfolio_sites_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_items_user_id_idx" ON "portfolio_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolio_items_site_id_idx" ON "portfolio_items" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "portfolio_items_site_section_idx" ON "portfolio_items" USING btree ("site_id","section");--> statement-breakpoint
CREATE INDEX "portfolio_items_evidence_item_idx" ON "portfolio_items" USING btree ("evidence_item_id");--> statement-breakpoint
CREATE INDEX "portfolio_sites_user_id_idx" ON "portfolio_sites" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_sites_handle_idx" ON "portfolio_sites" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "portfolio_sites_user_career_profile_idx" ON "portfolio_sites" USING btree ("user_id","career_profile_id");