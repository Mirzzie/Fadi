ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "fact_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "is_canonical" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "rendering_for" text;--> statement-breakpoint
UPDATE "evidence_items" SET "fact_id" = "id" WHERE "fact_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_items_user_canonical_idx" ON "evidence_items" USING btree ("user_id","is_canonical");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_items_fact_idx" ON "evidence_items" USING btree ("fact_id");