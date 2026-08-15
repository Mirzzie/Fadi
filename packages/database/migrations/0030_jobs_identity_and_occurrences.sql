-- Jobs identity + occurrences, as ONE self-contained, correctly-ordered, idempotent upgrade from
-- 0029 (squashes the earlier 0030-0033 + their out-of-band backfill script). Runs inside the
-- migrator's transaction; the advisory lock serializes concurrent deploys. Ordering is deliberate
-- (Codex #3): create an occurrence from EVERY original job BEFORE consolidating, so no provenance
-- is lost; repoint dependents; THEN add NOT NULL / unique indexes last.
SELECT pg_advisory_xact_lock(915237);--> statement-breakpoint

-- Canonical-key function — byte-identical to the TS canonicalJobKey (validated 1754/1754 on real
-- data), so an in-SQL backfill matches what the app writes at runtime. See canonical.ts.
CREATE OR REPLACE FUNCTION _job_norm(s text) RETURNS text AS $$
  SELECT trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(s,'')),'&',' and ','g'),'[^a-z0-9]+',' ','g'),'\s+',' ','g'));
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint
CREATE OR REPLACE FUNCTION _job_canon_company(s text) RETURNS text AS $$
  SELECT regexp_replace(_job_norm(s),'(\s+(inc|incorporated|llc|ltd|limited|plc|gmbh|ag|sa|srl|bv|nv|co|corp|corporation|company|group|holdings|international|global))+$','','g');
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint
CREATE OR REPLACE FUNCTION canonical_job_key(company text, title text, loc text) RETURNS text AS $$
  SELECT _job_canon_company(company)||'|'||_job_norm(title)||'|'||_job_norm(split_part(coalesce(loc,''),',',1));
$$ LANGUAGE sql IMMUTABLE;--> statement-breakpoint

-- Occurrences table (provenance: one row per provider's representation of a vacancy).
CREATE TABLE IF NOT EXISTS "job_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"requisition_id" text,
	"url" text,
	"description" text,
	"posted_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"liveness_state" text,
	"liveness_checked_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_occurrences_job_id_jobs_id_fk') THEN
    ALTER TABLE "job_occurrences" ADD CONSTRAINT "job_occurrences_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade;
  END IF;
END $$;--> statement-breakpoint
-- NOTE: the (job_id, source, external_id) UNIQUE index is created LAST (STEP H), after all
-- occurrences are repointed to survivors and duplicates merged — otherwise repointing a loser's
-- occurrence onto a survivor that already holds the same (source, external_id) would violate it.
CREATE INDEX IF NOT EXISTS "job_occurrences_job_id_idx" ON "job_occurrences" ("job_id");--> statement-breakpoint

-- Restricted, application-invisible holding table for captures we cannot attribute at migration
-- time. Real QUARANTINE (not deletion): the row + its occurrences + reason are preserved here so
-- the data is recoverable, while being removed from every user-facing table.
CREATE TABLE IF NOT EXISTS "job_migration_quarantine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_job_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"quarantined_at" timestamp with time zone NOT NULL DEFAULT now(),
	"job_row" jsonb NOT NULL,
	"occurrences" jsonb NOT NULL DEFAULT '[]'::jsonb
);--> statement-breakpoint

-- New jobs columns (nullable first; constraints added last).
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "canonical_key" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='jobs_owner_user_id_users_id_fk') THEN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
END $$;--> statement-breakpoint

-- Demote the old (source, external_id) UNIQUE to a plain index NOW, before the data steps —
-- consolidation and per-user clones legitimately create rows sharing a source+external_id, so it
-- must no longer be unique. canonical_key is the identity from here on.
DROP INDEX IF EXISTS "jobs_canonical_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "jobs_source_external_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_source_external_id_idx" ON "jobs" ("source","external_id");--> statement-breakpoint

-- STEP A — an occurrence from EVERY original job, BEFORE any consolidation, so a duplicate that is
-- about to be merged away still contributes its provider/url/description/status as an occurrence.
INSERT INTO "job_occurrences" ("job_id","source","external_id","url","description","posted_at","status","liveness_state","liveness_checked_at","first_seen_at","last_seen_at","raw_payload")
SELECT j."id", j."source", j."external_id", j."url", j."description", j."posted_at",
       CASE WHEN j."status" IN ('active','closed','expired') THEN j."status" ELSE 'active' END,
       j."liveness_state", j."liveness_checked_at", j."discovered_at", j."updated_at", j."raw_payload"
FROM "jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "job_occurrences" o WHERE o."job_id"=j."id" AND o."source"=j."source" AND o."external_id" IS NOT DISTINCT FROM j."external_id");--> statement-breakpoint

-- STEP B — backfill canonical identity.
UPDATE "jobs" SET "canonical_key" = canonical_job_key("company","title","location") WHERE "canonical_key" IS NULL;--> statement-breakpoint

-- STEP C1 — a private capture referenced by exactly ONE user belongs to that user.
UPDATE "jobs" j SET "owner_user_id" = a.uid FROM (
  SELECT job_id, (array_agg(user_id))[1] AS uid FROM (
    SELECT job_id, user_id FROM "applications" WHERE job_id IS NOT NULL
    UNION SELECT job_id, user_id FROM "saved_jobs"
    UNION SELECT job_id, user_id FROM "documents" WHERE job_id IS NOT NULL
  ) r GROUP BY job_id HAVING count(DISTINCT user_id)=1
) a WHERE j."id"=a.job_id AND j."source" IN ('manual','extension') AND j."owner_user_id" IS NULL;--> statement-breakpoint

-- STEP C2 — a private capture referenced by SEVERAL users is cloned once PER user (each user gets
-- their own private copy + occurrences, with their dependents repointed) — never left public.
DO $$
DECLARE r RECORD; newid uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT refs.job_id, refs.user_id
    FROM (
      SELECT job_id, user_id FROM "applications" WHERE job_id IS NOT NULL
      UNION SELECT job_id, user_id FROM "saved_jobs"
      UNION SELECT job_id, user_id FROM "documents" WHERE job_id IS NOT NULL
    ) refs
    JOIN "jobs" j ON j."id"=refs.job_id
    WHERE j."source" IN ('manual','extension') AND j."owner_user_id" IS NULL
  LOOP
    INSERT INTO "jobs" ("source","external_id","canonical_key","owner_user_id","title","company","location","remote_mode","employment_type","seniority","description","url","salary_text","status","liveness_state","liveness_checked_at","posted_at","discovered_at","raw_payload","created_at","updated_at")
    SELECT "source","external_id","canonical_key",r.user_id,"title","company","location","remote_mode","employment_type","seniority","description","url","salary_text","status","liveness_state","liveness_checked_at","posted_at","discovered_at","raw_payload","created_at",now()
    FROM "jobs" WHERE "id"=r.job_id RETURNING "id" INTO newid;
    INSERT INTO "job_occurrences" ("job_id","source","external_id","requisition_id","url","description","posted_at","status","liveness_state","liveness_checked_at","first_seen_at","last_seen_at","raw_payload")
    SELECT newid,"source","external_id","requisition_id","url","description","posted_at","status","liveness_state","liveness_checked_at","first_seen_at","last_seen_at","raw_payload"
    FROM "job_occurrences" WHERE "job_id"=r.job_id;
    UPDATE "applications" SET "job_id"=newid WHERE "job_id"=r.job_id AND "user_id"=r.user_id;
    UPDATE "documents" SET "job_id"=newid WHERE "job_id"=r.job_id AND "user_id"=r.user_id;
    UPDATE "saved_jobs" SET "job_id"=newid WHERE "job_id"=r.job_id AND "user_id"=r.user_id;
  END LOOP;
END $$;--> statement-breakpoint

-- STEP C3 — QUARANTINE: any manual/extension capture still public (no attributable owner, deps now
-- repointed to clones) is COPIED to the restricted holding table (row + occurrences + reason),
-- THEN removed from user-facing tables — reversible, never a public catalog job, never silent loss.
INSERT INTO "job_migration_quarantine" ("original_job_id","reason","job_row","occurrences")
SELECT j."id", 'unowned_private_capture_at_migration', to_jsonb(j),
       coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM "job_occurrences" o WHERE o."job_id"=j."id"), '[]'::jsonb)
FROM "jobs" j WHERE j."source" IN ('manual','extension') AND j."owner_user_id" IS NULL;--> statement-breakpoint
DELETE FROM "jobs" WHERE "source" IN ('manual','extension') AND "owner_user_id" IS NULL;--> statement-breakpoint

-- STEP D — consolidate duplicate canonical rows within each SCOPE (public = owner null; private =
-- per owner): pick a survivor, repoint occurrences + dependents to it, delete the losers.
CREATE TEMP TABLE _dupes ON COMMIT DROP AS
SELECT "id",
  first_value("id") OVER w AS survivor_id,
  row_number() OVER w AS rn
FROM "jobs"
WINDOW w AS (
  PARTITION BY coalesce("owner_user_id"::text,'public'), "canonical_key"
  ORDER BY ("status"='active') DESC, length(coalesce("description",'')) DESC, "created_at" DESC
);--> statement-breakpoint
-- Repoint ALL loser occurrences to the survivor (no conflict skip — the unique index is not yet
-- created, so co-located duplicates are allowed here and merged in STEP D2 without losing data).
UPDATE "job_occurrences" o SET "job_id"=d.survivor_id FROM _dupes d WHERE o."job_id"=d."id" AND d.rn>1;--> statement-breakpoint
UPDATE "applications" a SET "job_id"=d.survivor_id FROM _dupes d WHERE a."job_id"=d."id" AND d.rn>1;--> statement-breakpoint
UPDATE "documents" dd SET "job_id"=d.survivor_id FROM _dupes d WHERE dd."job_id"=d."id" AND d.rn>1;--> statement-breakpoint
UPDATE "saved_jobs" s SET "job_id"=d.survivor_id FROM _dupes d WHERE s."job_id"=d."id" AND d.rn>1
  AND NOT EXISTS (SELECT 1 FROM "saved_jobs" s2 WHERE s2."user_id"=s."user_id" AND s2."job_id"=d.survivor_id);--> statement-breakpoint
DELETE FROM "jobs" j USING _dupes d WHERE j."id"=d."id" AND d.rn>1;--> statement-breakpoint

-- STEP D2 — merge occurrences that are now co-located on a survivor with the SAME (source,
-- external_id): keep the earliest-seen row enriched with the best of each field (longest
-- description, its URL, earliest first-seen, latest last-seen, freshest posted, strongest liveness
-- evidence), then delete the rest — so a duplicate provider row's data is merged, never discarded.
WITH g AS (
  SELECT "id",
    row_number() OVER w AS rn,
    first_value("id") OVER w AS keep_id,
    "job_id","source","external_id"
  FROM "job_occurrences"
  WINDOW w AS (PARTITION BY "job_id","source","external_id" ORDER BY "first_seen_at" ASC, "id")
),
m AS (
  SELECT "job_id","source","external_id",
    (array_agg("description" ORDER BY length(coalesce("description",'')) DESC))[1] AS description,
    (array_agg("url" ORDER BY length(coalesce("description",'')) DESC) FILTER (WHERE "url" IS NOT NULL))[1] AS url,
    min("first_seen_at") AS first_seen_at,
    max("last_seen_at") AS last_seen_at,
    max("posted_at") AS posted_at,
    (array_agg("liveness_state" ORDER BY CASE "liveness_state" WHEN 'closed' THEN 0 WHEN 'live' THEN 1 ELSE 2 END) FILTER (WHERE "liveness_state" IS NOT NULL))[1] AS liveness_state,
    bool_or("status"='active') AS any_active,
    bool_or("status"='closed') AS any_closed
  FROM "job_occurrences" GROUP BY "job_id","source","external_id" HAVING count(*)>1
)
UPDATE "job_occurrences" o SET
  "description"=m.description, "url"=m.url, "first_seen_at"=m.first_seen_at, "last_seen_at"=m.last_seen_at,
  "posted_at"=m.posted_at, "liveness_state"=m.liveness_state,
  "status"=CASE WHEN m.any_active THEN 'active' WHEN m.any_closed THEN 'closed' ELSE 'expired' END,
  "updated_at"=now()
FROM g JOIN m ON m."job_id"=g."job_id" AND m."source"=g."source" AND m."external_id" IS NOT DISTINCT FROM g."external_id"
WHERE o."id"=g.keep_id AND g.rn=1;--> statement-breakpoint
DELETE FROM "job_occurrences" o USING (
  SELECT "id", row_number() OVER (PARTITION BY "job_id","source","external_id" ORDER BY "first_seen_at" ASC, "id") AS rn
  FROM "job_occurrences"
) g WHERE o."id"=g."id" AND g.rn>1;--> statement-breakpoint

-- STEP E — aggregate each survivor's rolled-up fields from its (now complete) occurrences.
UPDATE "jobs" j SET
  "description" = agg.description,
  "url" = agg.url,
  "posted_at" = agg.posted_at,
  "status" = CASE
    WHEN j."owner_user_id" IS NOT NULL AND j."source"='manual' THEN j."status"
    WHEN j."liveness_state"='closed' THEN 'closed'
    WHEN agg.any_active THEN 'active'
    WHEN agg.any_closed THEN 'closed'
    ELSE 'expired' END
FROM (
  SELECT o."job_id",
    (array_agg(o."description" ORDER BY length(coalesce(o."description",'')) DESC))[1] AS description,
    (array_agg(o."url" ORDER BY length(coalesce(o."description",'')) DESC) FILTER (WHERE o."url" IS NOT NULL))[1] AS url,
    max(o."posted_at") AS posted_at,
    bool_or(o."status"='active') AS any_active,
    bool_or(o."status"='closed') AS any_closed
  FROM "job_occurrences" o GROUP BY o."job_id"
) agg
WHERE j."id"=agg."job_id";--> statement-breakpoint

-- STEP H — constraints LAST, on clean data: occurrence unique + jobs NOT NULL + scoped partial
-- uniques + owner index.
CREATE UNIQUE INDEX IF NOT EXISTS "job_occurrences_job_source_external_idx" ON "job_occurrences" ("job_id","source","external_id");--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "canonical_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_public_canonical_key_idx" ON "jobs" ("canonical_key") WHERE "owner_user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_private_canonical_key_idx" ON "jobs" ("owner_user_id","canonical_key") WHERE "owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_owner_user_id_idx" ON "jobs" ("owner_user_id");
