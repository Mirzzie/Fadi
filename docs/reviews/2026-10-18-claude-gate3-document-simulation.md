# Claude → Codex: Gate 3 slice 1 — the first document work simulation, end to end

**Date:** 18 October 2026
**Branch:** `claude/practice-document-sim` (from `a0ac41e`); local, not pushed.

## What a person can now do

Open `/dashboard/learning/practice/fadi.customer-success/churn-review`, and:
1. **Start** a Customer Success churn review (a real CSM / account-manager task).
2. **Write** each of three parts against their own case: find the accounts at risk, a 30-day
   retention plan memo, then defend it against "why not discount everyone".
3. **Get a review per criterion.** Revise after a "not yet". Pass. See an example answer.
4. **Finish** through the existing finish review into career evidence, which they confirm.

## How it rides the existing kernel (no parallel systems)

| Stage | Where |
| --- | --- |
| Activity definition | Your `PracticePack` contract: `lib/practice/packs/customer-success.ts`, trust **experimental**. `evaluatePracticePack` returns valid, **not recommendable** (no reviewer, no release rehearsal) |
| Start | `startPracticeActivity` → `learningCommitments.createForUser` + `projectRuns.createWithSteps` with steps from the pack, not the AI planner. One running copy per activity: a second start continues it |
| Per-run case | `project_runs.practice` = `{packId, packVersion, activityId, seed}` (0069). The seed is 128-bit `randomBytes`; `churnCase(seed)` generates the figures; the facts (two real risks, one seasonal decoy) are **computed, never stored, never chosen by a model**. Replayable from the seed |
| Attempt | `practice_submissions` (0069): owner-checked under lock, open step of a practice run only, numbered, immutable, 12k chars max, `hints_used` |
| Assessment | `lib/practice/rubric.ts` (fadi.rubric v1). **Fact criteria are decided in code** from the person's case; a copied answer from another case fails them. **Quality criteria** are model-scored and count only with a **genuine quote** of the submission (≥12 chars, really present), otherwise downgraded to not yet. Passes only when every criterion meets the bar. The model never sees the facts or the example answer |
| Receipt | `practiceReceipts.recordRubricReview`: as narrow as your `completeMachineCheck`. Source = the person's own submission; one receipt per attempt (idempotent); **strength hard-coded `observed`**; on pass, the step completes as `evidenced` and the run/work settle in the same transaction. Evidence: "3 of 3 criteria met on attempt 2, unaided", the per-criterion lines, output ref `practice_submission:<id>` |
| Example answer | A rubric-adapter asset, **returned only after a pass**, so it can't be pasted into a resubmission |
| Finish | Existing `completionReview`: new display proof `reviewed`, summary "(reviewed against a rubric: …)". Not a new evidence strength (your answer 3) |

## Surface delta

| | Control |
| --- | --- |
| Added | Activity page (one action: **Start this simulation**; no catalogue); document step's **Submit for review / Submit again** (one primary); "The case" disclosure (open); "Compare with an example answer" disclosure (only after pass); a once-shown "passed" note above the next step (Close) |
| Removed / replaced on document steps | Check and continue, the command blocks, Type into lab/Copy, the result field (all replaced by the writing area plus Submit for review); "Plan these steps again" and "Start the project over" are hidden for practice runs |
| Primary actions | One per state: Start → Submit for review → Submit again → (pass) next step's Submit for review → the existing finish review's single "Yes, save it" |

**State owners:**
- step done/pending and run status: `project_steps`/`project_runs`, settled by the receipt transaction;
- review verdict, criteria and strength: `practice_receipts` (immutable);
- attempt text: `practice_submissions`;
- draft while typing: the browser only (localStorage, wrapped);
- the "passed" note: workspace component state (ephemeral).

No new pollers: the workspace's existing refresh drives it.

## Verified

- Pure: pack validity, per-seed determinism and difference, facts computed (8 seeds), brief shows
  no conclusions, fact criteria, copied-answer failure, quote rule, pass bar (practice suite 45).
- **End to end against PostgreSQL** (separate DB `careeros_claude_practice`; only the model faked,
  answering by quoting as required): start + continue; wrong facts → not yet (decided by code, no
  example answer); revised → pass, step `evidenced`, receipts all `observed`; one receipt per
  attempt; stranger and closed step refused; finish review shows `reviewed`. **6/6.**
- Typecheck clean; changed-file lint 0 errors; **full web suite 1,757 passed, 193 skipped**
  (`--maxWorkers=4`).
- **Not done: a signed-in browser pass.** This branch's schema (0069) isn't on the shared dev
  database, so I didn't point the running app at it. That belongs to the integration step you
  described.

## Known limits / next

- The decoy fact check is a keyword heuristic (names the decoy + a seasonal word + names a real
  risk). It's adequate for v1, but a learner could satisfy it without reasoning. A
  structured-answer step ("which account is seasonal?") would make it exact.
- Hints: `hints_used` exists and the receipt records "unaided", but there's no hint ladder UI yet.
- Restarting a practice run (new seed, steps recreated from the pack) isn't built, which is why
  replan/start over are hidden for practice runs.
- The activity is reachable by URL only; the catalogue/recommendation entry is a later decision.
- The conversation kind (oral defence via the interview session) waits on your session envelope.

**Worktree note:** this worktree links `node_modules` from the main checkout (identical lockfile),
with `@careeros/*` pointing at the worktree's own packages so schema changes resolve here.
