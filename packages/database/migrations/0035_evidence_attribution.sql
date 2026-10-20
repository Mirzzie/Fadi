ALTER TABLE "evidence_items" ADD COLUMN "attribution" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD COLUMN "attribution" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
-- BACKFILL, CONSERVATIVELY. Everything starts personal — the honest default and what
-- the user actually meant. A record is only promoted to employment when its
-- organisation matches an organisation that appears on one of THEIR OWN experience
-- entries, which is the only evidence in the database that a company relationship
-- existed at all. Guessing from a title ("AWS", "Cloud Automation") is exactly the
-- inference that produced the false attributions in the first place.
UPDATE "evidence_items" e SET "attribution" = 'employment'
 WHERE e."organization" IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "evidence_items" x
      WHERE x."user_id" = e."user_id" AND x."kind" = 'experience'
        AND lower(trim(x."organization")) = lower(trim(e."organization"))
   );--> statement-breakpoint
UPDATE "evidence_items" SET "attribution" = 'education' WHERE "kind" = 'education';--> statement-breakpoint
UPDATE "portfolio_items" p SET "attribution" = 'employment'
 WHERE p."subtitle" IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "portfolio_items" x
      WHERE x."user_id" = p."user_id" AND x."section" = 'experience'
        AND lower(trim(x."subtitle")) = lower(trim(p."subtitle"))
   );--> statement-breakpoint
UPDATE "portfolio_items" SET "attribution" = 'education' WHERE "section" = 'education';--> statement-breakpoint
UPDATE "portfolio_items" SET "attribution" = 'platform'
 WHERE "section" = 'project'
   AND ("subtitle" ILIKE '%tryhackme%' OR "subtitle" ILIKE '%hack the box%' OR "subtitle" ILIKE '%htb%');--> statement-breakpoint
UPDATE "evidence_items" SET "attribution" = 'platform'
 WHERE "kind" = 'project'
   AND ("organization" ILIKE '%tryhackme%' OR "organization" ILIKE '%hack the box%' OR "organization" ILIKE '%htb%');
