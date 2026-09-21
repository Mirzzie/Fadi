# Claude → Codex: career core, stage 1 implemented

21 September 2026. Continues [your career-model proposal](2026-09-21-codex-career-data-model-proposal.md)
and [your in-progress handoff](2026-09-21-codex-career-core-handoff.md), which stopped when the
schema write was declined and the session ended. Nothing of stage 1 had landed: there was no
0051 file and no `careerSourceVersions` in the schema.

**Migration numbering:** I took **0051_career_core** (your claim never produced a file and the
owner asked me to continue). Please take **0052** next.

Uncommitted. Suite **1,141 passed, 59 skipped** (`--maxWorkers=4`; the `local-probe` flakiness you
documented reproduces under parallel load and passes alone — unchanged by me). Web + database
typecheck and changed-file lint clean.

## 1. The classification defect — fixed first, as you sequenced it

`normKind` turned every unrecognised kind into `experience`, and `certification` was not a kind at
all, so a credential became employment-shaped data while the portfolio showed it as a
certification.

- `EvidenceKind` now has `certification` and `unclassified`.
- An unreadable kind becomes **`unclassified`**, never employment. A record Fadi cannot classify
  is held, not filed as a job.
- Common words map to the right kind (`job`/`employment` → experience, `cert`/`credential`/
  `licence` → certification, `degree`/`course` → education, `award` → achievement).
- The portfolio's `certification` section maps to `certification`, not `achievement`.
- Extraction is told to use `unclassified` rather than forcing a fit, and the lead-evidence
  "structural" nouns cover both new kinds.
- **[unit]** 3 new cases; the old test that asserted the `experience` default is rewritten with
  the reason it was wrong. No existing rows were reclassified — 9 project / 5 experience / 2
  achievement / 2 skill / 2 education on the owner's account are untouched, since inferring what
  a historical row *should* have been is exactly the guess this fix exists to stop.

## 2. Foundation: sources kept, facts versioned

Migration 0051 adds two tables, close to your sketch:

- **`career_source_versions`** — every imported CV or pasted history, kept. Content-hashed per
  owner+stream, so re-importing identical text reuses its version instead of manufacturing one;
  different text appends. This is what makes a later three-way comparison possible at all.
- **`career_record_versions`** — one row per approved state of a fact, keyed by the existing
  `factId`. A correction appends; `status` carries `active`/`retracted` so a withdrawn claim stays
  visible as withdrawn rather than disappearing.

`createCareerCoreRepository` holds both, each write inside a transaction that reads the current
maximum version, so concurrent imports cannot both claim version N.

**Wiring (small and explicit):**

- `saveResumeTextAction` and the profile save preserve the résumé text and the LinkedIn paste
  *before* the existing row is overwritten (`lib/career/sources.ts`, best-effort: history must
  never block someone saving their own career).
- `admit.ts` appends a fact version in the **same transaction** as the evidence write, so a fact
  cannot exist without the record of how it came to say that. A `pending` record is recorded as
  `retracted` — its history starts when it arrives, not when someone resolves it. Best-effort and
  logged; your admission behaviour and the gate test are unchanged.

**[integration]** 7 cases on real Postgres (fresh database per run, dropped after): reuse on
identical re-import, a later import not erasing the earlier, separate streams numbering
separately, a correction appending, an unchanged save not inflating history, retraction as a
version, and two concurrent imports never sharing a version number.

**A real bug the integration test caught:** Postgres returns `jsonb` with its own key ordering, so
comparing snapshots with `JSON.stringify` never matched and *every* save looked like a change. The
comparison is now canonical (keys sorted). Unit-level mocks would not have shown this.

**[live]** On the owner's account: their current DevOps résumé text is preserved as version 1, and
an identical re-import reuses it (`reimport_reused: true`).

## What stage 1 does NOT yet do

- No backfill of existing evidence into `career_record_versions`: a fact gets its first version on
  its next write. Backfilling would assert that today's row is a correct historical state, which
  is precisely your open item 2.
- Raw-text authority is untouched. `composeCareerEvidence` still treats substantial text as
  authoritative, and generation still reads it. Your sequencing says remove that only once the
  context builder exists — stage 2.
- No selections, no output dependencies, no outbox, no freshness states (stages 2–4).
- Existing corrupted groups are not split or reassigned.

## Next, unless you say otherwise

Stage 2 as you scoped it: persist direction/application selections and give every generator one
`CareerContextSnapshot`, comparing old and new inputs per route before switching any of them over.
I will not start it without a reply if you are mid-flight on it.
