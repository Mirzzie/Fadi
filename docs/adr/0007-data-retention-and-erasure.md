# 0007 — Data retention and erasure

- **Status:** **ACCEPTED (Option A) — 2026-07-20.** Proposed and accepted the same day;
  the recommendation was adopted. Implementation record at the end of this file.
- **Date:** 2026-07-20
- **Decides:** ledger item A7 (`ASSUMPTION_LEDGER.md`)

> Written before implementation, deliberately. ADR 0006 was authored after its code
> existed and described a cycle that was still present at the next commit — which makes
> it a record of what happened, not a decision. This document must be capable of being
> rejected. If you disagree with the recommendation, the correct outcome is that this
> file changes, not that it is quietly bypassed.
>
> The Proposed → Accepted transition is preserved in git history (this document existed
> as Proposed before any code referenced it), which is the audit trail ADR 0006 lacked.

## Context

There is currently **no retention policy in code**: no purge, no expiry, no TTL on any
career data. `SUBSCRIPTION_AND_MONETIZATION.md` (day one) promised "hard-delete
according to retention policy." That policy was never written. Nothing decided that data
is kept forever — it is kept forever because nobody chose otherwise.

### What is actually stored

30 tables. The sensitivity is not uniform, and that matters for the decision:

| tier | tables | why it is sensitive |
|---|---|---|
| **Acutely personal** | `resilience_events` (rejection autopsies), `applications` (`rejection_stage`, `outcome`), `agent_messages` | A record of being turned down, repeatedly, with the user's own reflections on why. This is the most sensitive data in the product and the least likely to be re-derivable. |
| **Identity / history** | `resumes`, `linkedin_profiles`, `evidence_items`, `career_reports`, `interview_stories`, `profiles` | Full career history and contact details. |
| **Credentials** | `user_ai_settings` (encrypted key), `mcp_tokens` (hashed), `session`, `account` | Encrypted/hashed at rest, but present. |
| **Derived / low** | `documents`, `portfolio_items`, `momentum_states`, `learning_commitments` | Reconstructible from the above. |
| **Not personal** | `jobs` (1,119 rows) | A shared catalogue, not user data. Out of scope. |

### What erasure does today — better than the earlier audit implied

`deleteAccountDataAction` → `usersRepository.deleteById` → a single `DELETE` on `users`.
**26 tables carry `ON DELETE CASCADE` from `users.id`**, verified against the live
database, so app data is genuinely removed rather than orphaned. That is a real strength
and should not be rebuilt.

**The actual gap is narrow and specific.** There are two identity tables:
`users` (app, 7 rows) and `user` (better-auth, 8 rows). `session` and `account` cascade
from better-auth's `user`, which the delete never touches. So after "delete my data" the
credentials still authenticate and produce a fresh empty account. That is *"delete my
data"*, not *"close my account"* — defensible, but it is not what most people mean by
deletion, and under GDPR Article 17 an erasure request means the second one.

GDPR is in scope, not hypothetical: the primary user is job-searching in Dublin.

## The decision to make

**How long is career data kept when the user does not ask for anything?**

Deliberately framed as a genuine choice. Real products land across this whole range, and
none of these is the obviously correct answer.

### Option A — Delete on request only (status quo, made explicit)

Keep indefinitely; erase when asked. What most pre-launch products do.

- **For:** zero build cost; no risk of deleting something a user wanted; a job search can
  legitimately span years, and evidence written in 2026 is still true in 2030.
- **Against:** "indefinitely" is doing a lot of work for rejection autopsies. GDPR storage
  limitation (Art. 5(1)(e)) expects a *justified* period, and "forever, because we never
  decided" is not a justification.

### Option B — Inactivity-based purge (e.g. delete after 24 months dormant)

- **For:** bounded exposure; a defensible answer to "how long do you keep this?"; standard
  for consumer products holding sensitive records.
- **Against:** real build cost (a scheduled job, warning emails, a re-activation path);
  deleting a dormant user's history is destructive and, done wrong, is the worst possible
  bug in this product. Note `portfolio_items` may be *publicly served* — purging those
  breaks live URLs.

### Option C — Tiered by sensitivity

Acutely personal data (rejection autopsies, `agent_messages`) purges on a short clock,
e.g. 12 months; career history persists until erasure.

- **For:** matches the actual risk gradient. Evidence and résumés are an asset the user
  wants kept; a log of every rejection is a liability that decays in usefulness.
  Also doctrinally coherent — momentum "scores the process, never the outcome."
- **Against:** most complex to build and explain; per-table rules drift over time.

### Option D — User-configurable retention

- **For:** strongest trust signal; the user owns the call, consistent with the BYO-key,
  self-hostable, own-your-stack posture.
- **Against:** a settings surface, migration and per-user scheduling for something few
  users will touch — real cost for a product whose core loop was proven working *today*.

## Recommendation

**Adopt A now, explicitly and in writing, and close the erasure gap. Defer B/C/D.**

Concretely:

1. **Write the policy down** — "career data is kept until you delete it" — in
   `SECURITY_AND_COMPLIANCE.md` and in the UI at the delete control. The current
   failure is not that data is kept; it is that nobody chose to keep it, so no one can
   answer the question honestly.
2. **Add true account closure** alongside data deletion: delete the better-auth `user`
   row (cascading `session`/`account`) in the *same transaction* as the app `users`
   delete. Two identity tables deleted separately is exactly the non-atomic pattern
   fixed in `learning/actions.ts` and `portfolio.repository.ts` — a failure between them
   leaves an account that is half-erased and still authenticates.
3. **Keep "delete my data" as a distinct action.** Wiping history while keeping the login
   is genuinely useful — starting a new search fresh. Two clearly-labelled controls beat
   one ambiguous one.
4. **Revisit B or C when there is a second user.** Automated deletion is destructive, and
   the product currently has one real user, no acquisition funnel, and — as of today — a
   core loop that has worked exactly once. Building a scheduled deleter now optimises a
   stage we are not at, which is the same reasoning applied to the BYO-key wall (A4).

**Why not C, which is arguably the most principled:** it is the right answer at scale and
the wrong one at N=1. It needs per-table rules, a scheduler and a warning path — and the
data it would protect currently amounts to 0 rows in `resilience_events`. Revisit it the
moment real rejection autopsies accumulate.

## Consequences if adopted

**Positive**
- Retention becomes a stated choice, answerable to a user or a DPA.
- GDPR Art. 17 erasure genuinely satisfied; the auth-identity gap closes.
- No scheduled-deletion machinery to get wrong while the product is unproven.

**Negative / accepted trade-offs**
- Indefinite retention remains the default. Accepted **explicitly**, not by omission —
  and it is the one line here most likely to need revisiting before any public launch.
- No automated minimisation, so exposure grows with usage. Tolerable at current scale;
  it will not stay tolerable.
- Deferring C means acutely personal data has no shorter clock than a résumé, which is
  arguably backwards on principle.

## Follow-ups (not in this ADR)

1. Export-before-delete ("download everything") — GDPR Art. 20 portability, and it makes
   deletion feel safe rather than final.
2. Decide whether published `portfolio_items` survive account deletion; live public URLs
   make this a user-visible call, not an internal one.
3. Retention for `agent_messages`, which accrue fastest and are re-readable transcripts.

---

## Implementation record (2026-07-20)

Recommendation 1 (write the policy down) and 2 (true account closure) shipped.
Recommendations 3 (keep both actions) and 4 (defer automated purge) are honoured by the
shape of what shipped.

**Two distinct, honestly-labelled actions:**

- `deleteAccountDataAction` → `usersRepository.deleteById` — "Delete my data & start over."
  Wipes career data via 26 FK cascades; **keeps** the better-auth login. Unchanged
  behaviour, now labelled honestly (the old copy didn't say the login survived).
- `closeAccountAction` → `usersRepository.closeAccount` — "Close my account." Full Art. 17
  erasure: resolves the linked better-auth id from `auth_identities`, then deletes BOTH
  identity rows **in one transaction** (app `users` cascades 26 tables; better-auth
  `user` cascades `session` + `account`).

**Verified against the live database, both directions** — the standing rule is that an
unwatched guarantee is not a guarantee:

| probe | result |
|---|---|
| Full closure of a seeded account (app user + better-auth user + session + account + identity + evidence) | all 6 counts → 0; returned better-auth id matched |
| Forced failure mid-transaction (after the app-user delete) | account fully preserved — app user, better-auth user and evidence all still present |

**Atomicity note carried through:** `closeAccount` uses `db.transaction`, the same pattern
as the portfolio-import and learning-completion fixes. Deleting the two identities as
separate statements was explicitly rejected — a failure between them would leave an
account that is half-erased and still authenticates, which is worse than the status quo.

**Wired, not orphaned:** `closeAccountAction` is reachable from the profile Danger Zone
(`components/profile/profile-form.tsx`), beside "Delete my data." Building the action
without a caller would have reproduced the "built breadth, never wired" pattern the
feature audit flagged.

**Deferred as recommended:** no scheduled purge, no inactivity deletion, no per-table
retention clocks (Options B/C/D). Retention default remains "kept until you delete it,"
now stated explicitly rather than defaulted by omission. Revisit when there is a second
user and real `resilience_events` rows accumulate.

**Not yet done from the follow-ups:** the written user-facing policy in
`SECURITY_AND_COMPLIANCE.md` (the UI copy now states it at the point of action; the
compliance doc should mirror it), and export-before-delete.
