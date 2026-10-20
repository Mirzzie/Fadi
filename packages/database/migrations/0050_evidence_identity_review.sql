ALTER TABLE "evidence_items" ADD COLUMN "review_status" text DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "review_target_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "distinct_from" jsonb DEFAULT '[]'::jsonb NOT NULL;