# Codex → Claude: cross-verification of `081b97f..f6b0d7d`

22 September 2026. I treated this as an adversarial review of the last fifteen commits plus the
handoff, not as a confirmation pass.

## Verdict

The transaction fixes are real, and the cleanup work reduced visible clutter. The range is not
ready to describe as closed. I found four high-impact defects, four material design/UX failures,
and several smaller inconsistencies. Two defects can silently lose or mis-associate career data.

The common cause is still the one the owner named: containment rules were added around a data model
that lacks explicit relationships. A boolean matcher, free-text deletion parser, public-page
backup, and portfolio hard stop each compensate for a missing first-class concept.

## Independent verification

- Exact range reviewed: `081b97f..f6b0d7d`; tree clean before and after.
- Full ordinary suite: **1,243 passed, 90 skipped** outside the filesystem sandbox.
- All **80 database integration tests passed** against two isolated, migrated Postgres databases;
  both databases were removed afterward.
- Typecheck clean. Lint: 0 errors, 18 existing warnings.
- Focused identity, sync, rewrite, freshness and voice tests: 54 passed.
- Cleanup evidence exists: the backup records 36 portfolio rows before and 33 after, and six links
  in the after snapshot. Current read-only state is 32 items, six evidence links, 15 media URLs,
  and 13 evidence records. The one-row difference happened after the cleanup snapshot, so I do not
  attribute it to that three-row cleanup.

Passing tests do not cover the defects below. In several cases the test asserts the selected policy
without exercising the destructive or ambiguous path.

## Findings

### C15-01 — High — Saving Profile can erase the stored LinkedIn history

`aaac411` removed `linkedInText` from `ProfileForm` and made it optional in the server action.
The form still submits `linkedInUrl`. When that URL is non-empty, `updateProfileAction` enters the
LinkedIn branch, converts the absent text to `""`, and calls `upsertLatestForUser` with
`rawText: null` (`profile/actions.ts:107-124`). `preserveThenReplace` skips preservation for the
empty input, so this is exactly the loss S2-R1 was meant to prevent.

The source-gate test cannot see this because it checks only that the filename contains a call to a
preservation helper. It does not test the omitted-field transition.

**Repair:** distinguish “field omitted” from “clear this field.” Updating the URL must preserve the
existing raw text. Add a real-DB regression test: seed URL + text, call the exact current Profile
payload without `linkedInText`, and assert the text and source history remain.

### C15-02 — High — S2-R2 authorizes whole-job deletion for bullet-level instructions

`explicitRemovals` treats any removal verb plus any occurrence of the company or title as authority
to remove the whole structured entry. I reproduced complete removal for both:

- `Remove Linux from the Spark Technomedia role`
- `Cut one bullet from the IT Support Consultant job`

If the model omits the role while carrying out either request, `restoreDropped` now accepts the
omission. This reopens the original failure: a model can silently drop an employer.

**Repair:** a prose rewrite must never delete a structured role/project/education entry. Use an
explicit Remove control in the document editor, or return a typed proposed operation and require a
separate user action. Do not infer destructive authority from free text.

### C15-03 — High — Loose portfolio matching can create a permanent wrong link

The handoff says there is no score floor. There is an implicit floor: `findSameThings` emits only
scores at or above 0.5. The real defect remains: 0.5 from shared vocabulary is not identity proof.

I reproduced two different jobs scoring 0.55 solely because they shared “Windows, systems,
networks, cloud” in a larger mixed corpus. `planEvidenceSync` accepts that `maybe` result, and then
either writes the evidence foreign key or suppresses creation indefinitely (`sync-plan.ts:82-100`).
A wrong match is therefore not cheap: it corrupts provenance and hides missing portfolio work.

`linkToEvidence` also updates unconditionally (`portfolio.repository.ts:140-149`). Two tabs can
both read a null link and the last update can overwrite the first, despite the comment saying an
existing link is never overwritten. There is no within-site uniqueness constraint either.

**Repair:** automatic linking needs strong deterministic identity: exact artefact, explicit user
choice, or exact normalized organization + period + identity key. A vocabulary/embedding match may
produce a suggestion only. Make the write compare-and-set (`WHERE evidence_item_id IS NULL`) and
enforce one evidence link per site where the data model requires it.

### C15-04 — High — “Restore the whole CMS” is false, unvalidated, and creates an SSRF surface

The backup is built from `getPublishedByHandle`, which explicitly returns only published,
confirmed items (`github-actions.ts:160-169`, `portfolio.repository.ts:249-275`). It omits drafts,
hidden/unconfirmed items, site title/headline/profile/theme/resume links, evidence links,
confirmation state, dismissal state, and other CMS metadata. The UI nevertheless says “copy of
everything” and “brings the whole CMS back.” It restores a public snapshot, not the CMS.

The successful restore path has no test. The only browser check exercised the no-connection error.
Remote JSON is parsed without a byte cap, row cap, or schema. `fromExportItem(null)` throws; nested
objects and arrays pass through as text/array fields until the database rejects them. A large valid
payload can consume memory and attempt an unbounded insert.

`pagesUrl` is currently written from the derived GitHub login/repo, so direct arbitrary URL entry
is not exposed by the current UI. However, `fetch` follows redirects. In a hosted deployment an
authenticated user can control a Pages/custom-domain redirect chain, making this an unproven but
credible authenticated SSRF surface. No live exploit was attempted.

**Repair:** read the known file through the authenticated GitHub Contents API using the stored
owner/repo, not an arbitrary web fetch. Validate a strict versioned Zod schema and cap bytes, rows,
strings, and media URLs before mutation. Rename the feature “Restore published items.” A real full
CMS backup must be private and versioned; public GitHub Pages cannot safely carry private drafts.
For the owner’s actual reset requirement, add one direct transaction: reset career data while
preserving portfolio tables. Delete-then-restore is a lossy detour.

### C15-05 — Medium — The project hard stop exposes the missing artefact model

Stopping image-less projects from auto-publishing was the right containment action. Making all
projects unreachable from evidence is the wrong end state. The UI says “Add one with a screenshot
or repo link and it goes up,” but offers no action on that record. The user must create a second,
unlinked CMS entry and rely on the unsafe matcher above to reconnect it.

The empty-state copy still says seeding includes “projects, experience, skills,” even though
`seedItemsFromEvidence` now drops every project and achievement.

**Repair:** add a first-class `evidence_artifacts` relation (fact id, type, URL/media id, source,
caption, verification state). “Add proof” on a project attaches the artefact to the fact and creates
or updates its linked portfolio projection. Lab completion and outside projects use the same path.

### C15-06 — Medium — “It’s up to date” records a claim the system has not checked

`markDocumentCurrentAction` replaces the generation fingerprint with today’s record fingerprint;
it never inspects whether the document contains those changes. The button says “It’s up to date.”
The metadata records that a person marked it, but every ordinary freshness reader now reports
current. This converts dismissal into false state.

**Repair:** retain the generation baseline and store a separate
`acknowledgedStaleFingerprint`. Label the action “Keep this version” or “Dismiss this notice.” The
document becomes current only after a regeneration or a verified structured reconciliation.

### C15-07 — Medium — Autoplay-queued speech survives Stop and mute

`waitForGesture` stores a module-global queued utterance and listeners. `stopFadiSpeech` does not
clear either. After autoplay is blocked, muting, stopping, unmounting an interview, or starting a
new utterance leaves the old speech queued. The next click can call `speakFadi` and speak it anyway,
possibly interrupting newer speech. The added test checks only error classification, not queue
lifecycle.

The retry also discards the already-generated blob and makes a second billable TTS request.

**Repair:** make the queued playback part of the current generation, retain the audio object/blob,
and let Stop remove listeners, clear the queue, and revoke the URL. Test blocked → Stop → gesture
and blocked old utterance → new utterance → gesture.

### C15-08 — Medium — Identity policy is encoded as a defaulted boolean and the new tests hide recall

The strict review trade is reasonable as containment: five false questions were worse than one
missed duplicate. It is not a complete identity contract. The changed MSc test takes a known true
duplicate and now asserts `different`; zero questions therefore measures precision only by setting
recall aside. With no manual merge path, that false negative is durable.

Claude’s exact `Support Engineer` / `Senior Support Engineer` example does not trigger because
`support` is a stop word. The underlying concern reproduces: `Cloud Support Engineer` / `Senior
Cloud Support Engineer` at the same employer in different periods returns `maybe` at 0.55, so a
promotion can become a false duplicate question.

`requireAnchor?: boolean` with a strict default is a foot-gun. The same comparator is being asked
to mean “hold import,” “suggest duplicate,” “reconcile,” and “mutate foreign key.” Those operations
have different proof requirements.

**Repair:** require a named policy at every caller (`admission_review`, `advisory`,
`automatic_link`) with no default, or better return raw identity signals and let each operation
apply its own decision rule. Add a balanced oracle containing both true rewrites and same-domain
distinct work. Add a low-friction “Same as…” action in the evidence item menu as the recovery path.

## Smaller inconsistencies

- The manual Evidence kind selector still omits `certification`, even though certification is now
  a first-class kind. Imported certificates work; manually added ones cannot be classified.
- The restore control is shown whenever the CMS is empty even when there is no GitHub connection,
  creating a predictable dead-end click. The UI already has the connection state and can show the
  useful next action directly.
- `68ea846` globally monkey-patches `performance.measure` in development and swallows every
  `TypeError` for React’s zero-width-prefixed tracks, not only the negative-timestamp case. Keep it
  temporary and remove it when Next is upgraded; the comment’s “exactly that one case” is broader
  than the predicate.
- `preserveThenReplace` logs `career.source_preserved` inside the transaction before commit. A
  later replacement failure rolls back the row while leaving a success-shaped log event.
- Voice-provider reasons reach the console, not a visible status surface. Someone should not need
  DevTools to learn that voice terms must be accepted.

## What I accept

- S2-R1’s transaction boundary is correct and passed failure-injection integration testing.
- S2-R3 preserves sections outside the model’s current rewrite schema.
- S2-R5’s selection reconciliation is coherent and passed real-Postgres tests.
- Certification routing and dropping unknown kinds are safer than inventing employment/custom
  records.
- The three-row portfolio cleanup and six evidence links are present in the recorded before/after
  backup.
- The voice provider now preserves actionable backend failure reasons; the queue lifecycle still
  needs repair.

## Recommended order

1. Fix C15-01 before the Profile form is used again.
2. Disable free-text structural deletion (C15-02).
3. Stop automatic loose linking and make the repository write conditional (C15-03).
4. Relabel/contain restore immediately, then replace it with GitHub API + validation (C15-04).
5. Separate freshness acknowledgement from current state (C15-06).
6. Build the artefact relation and one-click project proof flow (C15-05).
7. Repair voice cancellation (C15-07).
8. Replace the boolean identity policy and add the balanced oracle/manual merge escape hatch.

No product code was changed during this review.
