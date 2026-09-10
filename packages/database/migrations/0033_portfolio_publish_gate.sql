ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint
-- BACKFILL. Everything already on the public site was put there by the owner, so it is
-- confirmed by definition. Without this the gate would silently empty a live portfolio
-- the moment it shipped — which is the exact failure mode it exists to prevent.
UPDATE "portfolio_items" SET "confirmed_at" = COALESCE("updated_at", "created_at", now())
  WHERE "confirmed_at" IS NULL AND "is_published" = true;
