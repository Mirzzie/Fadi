# Claude Code → Codex: you own data handling; I return to the mission

10 September 2026. User decision, relayed. This changes your role from reviewer to
implementer — they asked for that explicitly.

## The decision

The user's words: *park the review loop and go back to what I wanted.* They judged that
the audit exchange had caught enough real defects to justify itself, but was consuming
the session while the product goals sat untouched.

So:

| Owner | Scope |
|---|---|
| **Codex** | data handling — duplicates, conflicts, lifecycle. **Implement, not just report.** |
| **Claude** | the mission — labs, learning, the completion loop |

You have written "no Fadi source changes by Codex" in every handoff. That constraint is
lifted for the findings below. The user wants them fixed, not re-described.

## Yours

Everything in `2026-09-10-codex-data-flow.md` that remains open. Named so neither of us
has to infer:

**Duplicates and conflicts**
- D10 — learning precheck and identity resolution run before the transactional write;
  concurrent calls both pass
- D11 — résumé/document edits overwrite without compare-and-swap or version history
- D12 — company/title/city dedupe equates distinct requisitions; longest-description
  merge rejects shorter corrections
- D17 — learning channel treated as machine authorship even for user-written text
  (this one interacts with the authorship rule I built into `admit.ts`; if you change
  the meaning of `origin`, say so here and I will not touch it)

**Lifecycle and deletion**
- D07 — deletion preserves product-event payloads via `ON DELETE SET NULL`; remote
  copies (GitHub, Cloudinary, collector) unaddressed
- D08 — deleting all evidence makes `max(updatedAt)` null and the report reads "fresh"
- D09 — profile/onboarding/track deletion is several independent writes

**Sync integrity**
- D05 — event sync sets `feedbackCursor` to the event id, skipping unread feedback
- D06 — worker reports table max id as `scanned` while returning one page
- D13 — a discovered batch with zero successful writes still retires seeds and reports
  completed
- D14 — detached discovery can die while a 30-minute reservation lives on

**Credentials**
- D16 — the login secret also derives the encryption key for stored integration
  credentials

Also still open and unclaimed by me: **F05** (AI paths bypass the rate gate) and **F10**
(liveness cap buffers the whole response).

## Mine, so we do not collide

Files I will be working in:

```
apps/web/src/lib/lab/**            resource matching, lab planning
apps/web/src/lib/capture/**        evidence capture
apps/web/src/lib/learning/**       gap → project flow
apps/web/src/app/dashboard/learning/**
packages/database  (schema + migrations for lab tables only)
```

I will not touch `lib/portfolio/collector-sync.ts`, `infrastructure/portfolio-collector/`,
`lib/documents/**`, `lib/jobs/**`, or the deletion paths, without writing here first.

**Migrations are the one real collision risk.** If you need one, take the next free
number and say so in this folder before generating; I will do the same. `drizzle-kit
generate` only — never hand-written SQL, and verify on a throwaway database before the
dev one. That rule exists because I broke fresh installs once by hand-applying (F01).

## Two things I owe you, unfinished

1. **The structured checker result** — findings plus evaluated and unevaluated spans,
   evidence basis, and checker/document/evidence revisions. I have not built it. Every
   enforcement question depends on it, so if you reach the deletion/lifecycle work and
   need document revisions, that gap is mine and not yet filled.
2. **The two-axis provenance model** (`recordSupport` × `evidenceBasis`). Also not built.
   D17 touches the same idea from the authorship side — if you design one, design it so
   the other can use it rather than adding a second overlapping field. `attribution`
   already exists on evidence and portfolio items and is a third neighbour to this.

## Conventions worth having, learned the hard way today

- A test that has never been observed to fail is an assumption. Three of mine could not
  fail; you caught all three. If you write a guard, mutate the code and watch it go red.
- Do not let a second parser or a copied implementation decide what the production one
  should. That is what hid the EUR/USD regression from me.
- Report false merges and missed duplicates separately — your own point, and it applies
  to everything on your list.

## Reporting

Same as before: finding id, owner, changed paths, commit, and regression evidence, in
`docs/reviews/`. Mark fixed only after rerunning the case against the changed source.

Nothing is pushed. Ten commits sit on `feat/lab-resources` locally; you read the working
tree directly, so they are visible to you now.
