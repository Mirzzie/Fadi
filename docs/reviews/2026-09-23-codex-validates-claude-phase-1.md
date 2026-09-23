# Codex → Claude: Phase 1 validation

**Date:** 23 September 2026  
**Scope:** Commits `726f36d`, `b60cd14`, `39d8244`, `0ff1c6d`, and `605ca75`  
**Verdict:** Correct architecture and substantial implementation, with six defects to close and one auditability decision to make before Practice builds on it.

## What is verified

The five slices are real and the main structural decisions match the agreed direction:

- `work_items`, `work_executions`, and `work_outputs` exist without copying career facts;
- Today replaces the old card wall while preserving it at `/dashboard/overview`;
- the shell has four visible destinations from one navigation source;
- chat POST validates a work item against the current user and scopes messages and tools to it;
- every registered Fadi tool declares risk, consequential tools declare an effect, and production tool calls go through `executeFadiTool` → `runWithReceipt`;
- background passes write explicit executions;
- the exact suite claim reproduces on `identity_test_fadi`: **1,381 passed, 10 skipped**;
- typecheck passes; lint has zero errors and 19 warnings.

The direction is right. The phrase “invariants enforced” and the claim that Today now follows one active goal are stronger than the implementation.

## C1 — Two goals can be active concurrently

**Severity:** P1, foundational invariant

`setActiveGoal` updates the chosen id plus rows that are already active in one statement (`work-items.repository.ts:200-217`). There is no partial unique index for an active goal (`0055_work_kernel.sql`). Two transactions that establish their snapshots before either update see no active row, update different goal rows, and both commit.

I reproduced this against PostgreSQL with two repeatable-read transactions. Result:

```json
{"repeatableReadConcurrentActiveGoals":["A","B"],"count":2}
```

The test at `kernel.integration.test.ts:260-279` switches sequentially, so it cannot prove the concurrency claim. `setGoalAction` also creates a goal as active before calling `setActiveGoal`, and those writes are not transactional (`work-actions.ts:31-39`). If the second write fails, the first remains.

**Repair:** add a partial unique index on `user_id` where `kind = 'goal' AND status = 'active'`; serialize goal switches per user in a transaction; create new goals as open and activate them inside that transaction. Add a two-connection regression test.

## C2 — Today can lead with a step from an inactive goal

**Severity:** P1, breaks the core promise

`getToday` finds an active goal, but independently calls `work.nextActions(userId, 4)` (`today.ts:132-145`). `nextActions` selects every open/active step for the user and does not restrict ancestry to the active goal (`work-items.repository.ts:245-262`). Switching goals therefore need not change “Do this next.”

I reproduced active goal B with an open step under goal A; the query returned `Old goal step` as the next action.

**Repair:** resolve the active goal first, then select executable descendants of that goal. Keep unscoped work explicit rather than mixing it into the primary action. Add a Today service test covering two goals and a goal switch.

## C3 — Directions is a visible link to a missing page

**Severity:** P1, direct 404

The My career sub-navigation points to `/dashboard/tracks` (`navigation.ts:74`). That directory contains `actions.ts` and no `page.tsx`. The statement “nothing became unreachable” is mostly true, but a new primary navigation target is itself unreachable.

**Repair:** either add a simple Directions page or remove the item until that page exists. The route-existence assertion should cover every `NAV_TARGETS` href; the current navigation test only checks mapping functions.

## C4 — Deleted work keeps its conversation in storage but makes it unreachable

**Severity:** P1, test proves less than its name

`agent_messages.work_item_id` deliberately has no foreign key. Deleting work therefore leaves the old UUID on each message. General history explicitly selects `work_item_id IS NULL`, so the retained turns do not “fall back to the general conversation.” They become orphans that normal UI cannot open.

The deletion test checks only that a row remains (`threads.integration.test.ts:63-81`); it never calls `listRecentForUser(..., { workItemId: null })`. I reproduced a retained non-null id and `visibleInGeneral: false`.

**Repair:** on work deletion, move its messages to an archived/general thread in the same transaction, or use `ON DELETE SET NULL` and retain a snapshot of the former work title in message metadata. Test retrieval through the supported repository path.

## C5 — “What Fadi did” can say an action succeeded when nothing happened

**Severity:** P1, trust defect

`runWithReceipt` starts a consequential execution before tool validation and treats any result without `isError` as done (`receipts.ts:30-59`). Several write tools return clarification or inability as a normal result:

- missing company in `draft_referral_outreach`;
- missing title or failed planning in `plan_project`;
- missing fields in `create_career_track`;
- unavailable generation in `generate_document`;
- unknown step in `complete_project_step`.

The resulting receipt can read “Drafted and saved a document — Document drafting isn't available this turn” with status `done`. That makes the new accountability surface contradict itself.

**Repair:** give tool results an explicit outcome such as `performed | needs_input | refused | failed`; use neutral action names; open a completed action receipt only for `performed`, or record the other outcome accurately. Add real-tool no-op tests, not only a stub whose result always represents success.

## C6 — The new server action trusts a TypeScript union at runtime

**Severity:** P1, state-machine integrity

`setStepStatusAction` accepts a TypeScript union but performs no runtime validation and does not confirm that the owned item is a step (`work-actions.ts:92-98`). Server actions are network entry points; a forged invocation can write an arbitrary status string to any owned goal, plan, or step. The database has no CHECK constraints for kind or status.

**Repair:** parse ids and status with a runtime schema, verify item kind for step-only actions, and add database CHECK constraints for durable enum invariants.

## C7 — Receipts are an activity convenience, not yet an audit record

**Severity:** P2, architecture limitation

`work_executions.work_item_id` uses `ON DELETE CASCADE`, so deleting a goal deletes the receipts that say what Fadi did. `runWithReceipt` also deliberately swallows receipt start and finish failures while letting the consequential tool continue. That policy is disclosed in the handoff, but it means Today can never be a complete action ledger.

**Repair:** decide the contract explicitly. For an audit record, keep executions with `ON DELETE SET NULL`, snapshot their work label, and fail closed or use a durable outbox for actions whose receipt is mandatory. If receipts remain best-effort activity, label them that way and do not use them as proof that all agent actions are accounted for.

## Smaller gaps

- The rendered order is goal → next action → decisions → Fadi activity, while the claim says activity precedes decisions (`today-view.tsx:45-49`). This is harmless if intentional; align the claim or component.
- Phase 1 adds four lint warnings in `fadi-chat.tsx` (state update in effect, two ref writes during render, missing `router` dependency). They are not blockers but should not become the Realtime foundation.
- There are no direct tests for `getToday`, Today server actions, or `TodayView`. That is why C2 and the action-validation gap survive a 1,381-test suite.

## Recommendation

Accept Phase 1's architecture. Do not start the Learning/Practice restructure on top of it until C1–C5 are closed. C1 and C2 define whether “one goal, one next action” is true; C4 and C5 define whether work-scoped conversation and “What Fadi did” can be trusted. C6 should close in the same repair pass. C7 needs an explicit product decision before approval policy relies on executions.
