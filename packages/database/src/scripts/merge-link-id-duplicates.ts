/**
 * Merge vacancies that were stored once per crawl because their provider id was a tracking link.
 *
 * Before stableExternalId, a scraper that used the listing link as its id (Indeed's
 * `/rc/clk?jk=…&bb=…`) keyed the same vacancy differently on every crawl. This re-keys those
 * rows the way the write path now does and folds each group into one row: applications,
 * documents, interview sessions, saves, occurrences and work-item refs move to the survivor,
 * which keeps the longest description and the latest posting date. Everything in one
 * transaction.
 *
 *   npm --workspace @careeros/database exec tsx src/scripts/merge-link-id-duplicates.ts          # dry run
 *   npm --workspace @careeros/database exec tsx src/scripts/merge-link-id-duplicates.ts --apply
 */
import pg from "pg";

import { canonicalOccurrenceJobKey, stableExternalId } from "../canonical";

type Row = {
  id: string;
  source: string;
  external_id: string;
  canonical_key: string;
  company: string;
  title: string;
  location: string | null;
  owner_user_id: string | null;
  created_at: Date;
  refs: number;
};

const apply = process.argv.includes("--apply");
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://careeros:careeros@localhost:5433/careeros",
});

const client = await pool.connect();
try {
  await client.query("begin");
  const { rows } = await client.query<Row>(`
    select j.id, j.source, j.external_id, j.canonical_key, j.company, j.title, j.location,
           j.owner_user_id, j.created_at,
           (select count(*) from applications a where a.job_id = j.id)
             + (select count(*) from saved_jobs s where s.job_id = j.id)
             + (select count(*) from documents d where d.job_id = j.id) as refs
    from jobs j
    where j.external_id ~ '^https?://'
  `);

  // One vacancy = one owner, one source, one stable id — whatever key format the row was
  // written under. Older rows carry a content-only key from before per-source keys existed;
  // they are the same posting as the per-crawl copies and fold in with them.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const scope = `${row.owner_user_id ?? "public"}::${row.source}::${stableExternalId(row.external_id)}`;
    groups.set(scope, [...(groups.get(scope) ?? []), row]);
  }

  let merged = 0;
  let rekeyed = 0;
  for (const group of groups.values()) {
    const first = group[0]!;
    const newKey = canonicalOccurrenceJobKey(
      first.company,
      first.title,
      first.location,
      first.source,
      first.external_id
    );
    // A crawl since the fix may already have stored this vacancy under its stable key. That row
    // is the one the write path will keep finding, so it survives and the rest fold into it.
    const owner = group[0]!.owner_user_id;
    const { rows: current } = await client.query<{ id: string }>(
      `select id from jobs where canonical_key = $1
         and owner_user_id is not distinct from $2 and not (id = any($3))`,
      [newKey, owner, group.map((row) => row.id)]
    );
    if (current[0]) {
      group.push({ ...group[0]!, id: current[0].id, refs: Number.MAX_SAFE_INTEGER });
    }
    // The row something already points at survives; otherwise the first one seen.
    group.sort(
      (a, b) => Number(b.refs) - Number(a.refs) || a.created_at.getTime() - b.created_at.getTime()
    );
    const [keep, ...drop] = group;
    const dropIds = drop.map((row) => row.id);

    if (dropIds.length > 0) {
      merged += dropIds.length;
      await client.query(
        `update jobs k set
           description = case when length(coalesce(d.description, '')) > length(coalesce(k.description, ''))
                              then d.description else k.description end,
           posted_at = greatest(k.posted_at, d.posted_at)
         from (select description, posted_at from jobs where id = any($2)
               order by length(coalesce(description, '')) desc limit 1) d
         where k.id = $1`,
        [keep.id, dropIds]
      );
      for (const table of ["applications", "documents", "interview_sessions"]) {
        await client.query(`update ${table} set job_id = $1 where job_id = any($2)`, [
          keep.id,
          dropIds,
        ]);
      }
      // A save of both copies by one person becomes one save.
      await client.query(
        `delete from saved_jobs s where s.job_id = any($2)
           and exists (select 1 from saved_jobs k where k.job_id = $1 and k.user_id = s.user_id)`,
        [keep.id, dropIds]
      );
      await client.query(`update saved_jobs set job_id = $1 where job_id = any($2)`, [
        keep.id,
        dropIds,
      ]);
      // Occurrences are the same posting seen again; the survivor's own record is enough.
      await client.query(`delete from job_occurrences where job_id = any($1)`, [dropIds]);
      for (const id of dropIds) {
        await client.query(
          `update work_items set refs = replace(refs::text, $1, $2)::jsonb
           where refs::text like '%' || $1 || '%'`,
          [id, keep.id]
        );
      }
      await client.query(`delete from jobs where id = any($1)`, [dropIds]);
    }

    const stableId = stableExternalId(keep.external_id);
    // Each crawl also added an occurrence to the row it did reach; under the stable id they are
    // one, so the most recently seen stays.
    await client.query(
      `delete from job_occurrences o where o.job_id = $1 and o.source = $2
         and o.id <> (select id from job_occurrences where job_id = $1 and source = $2
                      order by last_seen_at desc limit 1)`,
      [keep.id, keep.source]
    );
    await client.query(
      `update job_occurrences set external_id = $2 where job_id = $1 and source = $3`,
      [keep.id, stableId, keep.source]
    );
    await client.query(`update jobs set canonical_key = $2, external_id = $3 where id = $1`, [
      keep.id,
      newKey,
      stableId,
    ]);
    rekeyed++;
  }

  console.log(
    `${rows.length} link-id rows: ${rekeyed} vacancies kept, ${merged} duplicates merged.`
  );
  if (apply) {
    await client.query("commit");
    console.log("Applied.");
  } else {
    await client.query("rollback");
    console.log("Dry run — nothing changed. Re-run with --apply.");
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
