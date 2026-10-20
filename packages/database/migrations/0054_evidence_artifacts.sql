CREATE TABLE "evidence_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_portfolio_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_source_portfolio_item_id_portfolio_items_id_fk" FOREIGN KEY ("source_portfolio_item_id") REFERENCES "public"."portfolio_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_artifacts_fact_url_unique" ON "evidence_artifacts" USING btree ("user_id","fact_id","url");--> statement-breakpoint
CREATE INDEX "evidence_artifacts_fact_idx" ON "evidence_artifacts" USING btree ("user_id","fact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_items_site_evidence_unique" ON "portfolio_items" USING btree ("site_id","evidence_item_id") WHERE "portfolio_items"."evidence_item_id" is not null;--> statement-breakpoint

-- Preserve proof already connected to Evidence before this model existed.
INSERT INTO "evidence_artifacts"
  ("user_id", "fact_id", "kind", "url", "label", "sort_order", "source_portfolio_item_id")
SELECT p."user_id", COALESCE(e."fact_id", e."id"),
       CASE WHEN p."image_url" ~* '(\\.mp4|\\.webm|\\.mov)(\\?|$)|/video/upload/' THEN 'video' ELSE 'image' END,
       p."image_url", 'Cover', 0, p."id"
FROM "portfolio_items" p
JOIN "evidence_items" e ON e."id" = p."evidence_item_id" AND e."user_id" = p."user_id"
WHERE p."image_url" IS NOT NULL AND p."image_url" <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "evidence_artifacts"
  ("user_id", "fact_id", "kind", "url", "label", "sort_order", "source_portfolio_item_id")
SELECT p."user_id", COALESCE(e."fact_id", e."id"),
       CASE WHEN media."url" ~* '(\\.mp4|\\.webm|\\.mov)(\\?|$)|/video/upload/' THEN 'video' ELSE 'image' END,
       media."url", 'Gallery', media."ord"::integer, p."id"
FROM "portfolio_items" p
JOIN "evidence_items" e ON e."id" = p."evidence_item_id" AND e."user_id" = p."user_id"
CROSS JOIN LATERAL jsonb_array_elements_text(p."gallery") WITH ORDINALITY AS media("url", "ord")
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "evidence_artifacts"
  ("user_id", "fact_id", "kind", "url", "label", "sort_order", "source_portfolio_item_id")
SELECT p."user_id", COALESCE(e."fact_id", e."id"), 'link', p."url", 'Source', 1000, p."id"
FROM "portfolio_items" p
JOIN "evidence_items" e ON e."id" = p."evidence_item_id" AND e."user_id" = p."user_id"
WHERE p."url" IS NOT NULL AND p."url" <> ''
ON CONFLICT DO NOTHING;
