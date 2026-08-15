#!/usr/bin/env bash
# Automated fixture test for migration 0030_jobs_identity_and_occurrences: proves the upgrade from
# a POPULATED 0029 database preserves every provider occurrence, application, save and document,
# and correctly attributes / clones / quarantines private captures. Requires a superuser Postgres
# (to create a throwaway DB). Point it at one with:
#   MIGTEST_ADMIN_URL=postgres://user:pass@host:port/postgres bash migration-0030.fixture.sh
# The docker instance in infrastructure/docker (port 5433, user/pass careeros) works out of the box.
set -euo pipefail
ADMIN="${MIGTEST_ADMIN_URL:-postgres://careeros:careeros@localhost:5433/postgres}"
DB="migtest_0030_$$"
BASE="$(dirname "$ADMIN")"
URL="${BASE}/${DB}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() { psql "$ADMIN" -q -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN" -q -c "create database \"$DB\";"

# Replay 0000..0029 (the baseline before jobs-identity work).
for f in $(ls "$DIR"/migrations/*.sql | sort); do
  n="$(basename "$f" | cut -c1-4)"
  [ "$n" -le "0029" ] 2>/dev/null || continue
  psql "$URL" -q -f "$f"
done

# Fixture: provider duplicate (2 sources, 1 vacancy), single-referrer manual, multi-referrer
# manual, unreferenced manual, and a public singleton — plus applications/saves/documents.
LONG="$(printf 'FULL JD %.0s' {1..40})"
psql "$URL" -q <<SQL
insert into users(id,email) values ('11111111-1111-1111-1111-111111111111','u1@x.com'),('22222222-2222-2222-2222-222222222222','u2@x.com');
insert into jobs(id,source,external_id,title,company,location,description,status) values
 -- provider duplicate (2 sources, 1 vacancy)
 ('aaaaaaaa-0000-0000-0000-000000000001','jooble','j1','Software Engineer','Acme','Dublin, Ireland','short teaser','active'),
 ('aaaaaaaa-0000-0000-0000-000000000002','adzuna','a1','software engineer','Acme, Inc.','Dublin','${LONG}','active'),
 -- single-referrer manual (application)
 ('aaaaaaaa-0000-0000-0000-000000000003','manual','m2','Analyst','Beta','Cork','d2','manual'),
 -- multi-referrer manual (u1 + u2)
 ('aaaaaaaa-0000-0000-0000-000000000004','manual','m3','Designer','Gamma','Galway','d3','manual'),
 -- unreferenced manual -> real quarantine
 ('aaaaaaaa-0000-0000-0000-000000000005','manual','m4','Writer','Delta','Sligo','d4','manual'),
 -- public singleton
 ('aaaaaaaa-0000-0000-0000-000000000006','reed','r5','Nurse','Zeta','Dublin','d5','active'),
 -- DOCUMENT-ONLY manual (referenced only by a document, by u2)
 ('aaaaaaaa-0000-0000-0000-000000000007','manual','m7','Editor','Kappa','Waterford','d7','manual');
insert into applications(id,user_id,job_id,company,title) values
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','Acme','Software Engineer'),
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003','Beta','Analyst'),
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','Gamma','Designer'),
 (gen_random_uuid(),'22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000004','Gamma','Designer');
insert into saved_jobs(id,user_id,job_id) values (gen_random_uuid(),'22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002');
insert into documents(id,user_id,job_id,kind,title) values
 (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','cv','My CV'),
 (gen_random_uuid(),'22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000007','cv','Doc-only');
SQL

# The upgrade under test (single transaction, like the migrator).
psql "$URL" --single-transaction -q -f "$DIR/migrations/0030_jobs_identity_and_occurrences.sql"

pass=0; fail=0
chk() { if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  FAIL: $1 -> got [$2] expected [$3]"; fi; }
Q() { psql "$URL" -tAc "$1"; }
chk "jobs=6 (survivor,J2,2 clones,J5,J7)" "$(Q "select count(*) from jobs")" "6"
chk "occurrences=7"                    "$(Q "select count(*) from job_occurrences")" "7"
chk "survivor keeps BOTH providers"    "$(Q "select string_agg(o.source,',' order by o.source) from job_occurrences o join jobs j on j.id=o.job_id where j.canonical_key='acme|software engineer|dublin'")" "adzuna,jooble"
chk "survivor desc = fullest"          "$(Q "select (description like 'FULL JD%') from jobs where canonical_key='acme|software engineer|dublin'")" "t"
chk "no orphaned applications"         "$(Q "select count(*) from applications a where a.job_id is not null and not exists(select 1 from jobs j where j.id=a.job_id)")" "0"
chk "applications preserved"           "$(Q "select count(*) from applications")" "4"
chk "no public manual/extension"       "$(Q "select count(*) from jobs where source in ('manual','extension') and owner_user_id is null")" "0"
chk "canonical_key not null"           "$(Q "select count(*) from jobs where canonical_key is null")" "0"
chk "single-referrer manual attributed" "$(Q "select owner_user_id='11111111-1111-1111-1111-111111111111' from jobs where canonical_key='beta|analyst|cork'")" "t"
chk "multi-referrer manual cloned per user" "$(Q "select count(distinct owner_user_id) from jobs where canonical_key='gamma|designer|galway'")" "2"
chk "each user's app -> their own clone" "$(Q "select bool_and(a.user_id=j.owner_user_id) from applications a join jobs j on j.id=a.job_id where a.title='Designer'")" "t"
# DOCUMENT-ONLY ownership: J7 referenced only by a document (u2) must be attributed, not quarantined.
chk "document-only manual attributed to u2" "$(Q "select owner_user_id='22222222-2222-2222-2222-222222222222' from jobs where canonical_key='kappa|editor|waterford'")" "t"
chk "no orphaned documents"            "$(Q "select count(*) from documents d where d.job_id is not null and not exists(select 1 from jobs j where j.id=d.job_id)")" "0"
# REAL QUARANTINE: the unreferenced manual is preserved in the holding table, not silently deleted.
chk "unreferenced manual out of jobs"  "$(Q "select count(*) from jobs where canonical_key='delta|writer|sligo'")" "0"
chk "quarantine table holds it (+reason+occurrences)" "$(Q "select count(*) from job_migration_quarantine where reason='unowned_private_capture_at_migration' and job_row->>'title'='Writer' and jsonb_array_length(occurrences)>=1")" "1"

echo "migration-0030 fixture: PASS=$pass FAIL=$fail"
[ "$fail" -eq 0 ]
