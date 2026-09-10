-- Idempotent on purpose: this index was applied by hand to at least one
-- database before the migration existed, so a plain CREATE fails there and
-- blocks every later migration behind it.
CREATE UNIQUE INDEX IF NOT EXISTS "career_profiles_one_active_per_user" ON "career_profiles" USING btree ("user_id") WHERE "career_profiles"."is_active";