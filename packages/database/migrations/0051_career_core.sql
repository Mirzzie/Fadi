CREATE TABLE "career_record_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"source_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_source_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_kind" text NOT NULL,
	"source_key" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_record_versions" ADD CONSTRAINT "career_record_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_record_versions" ADD CONSTRAINT "career_record_versions_source_version_id_career_source_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."career_source_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_source_versions" ADD CONSTRAINT "career_source_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "career_record_version_key" ON "career_record_versions" USING btree ("user_id","fact_id","version");--> statement-breakpoint
CREATE INDEX "career_record_fact_idx" ON "career_record_versions" USING btree ("user_id","fact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "career_source_version_key" ON "career_source_versions" USING btree ("user_id","source_kind","source_key","version");--> statement-breakpoint
CREATE INDEX "career_source_hash_idx" ON "career_source_versions" USING btree ("user_id","content_hash");