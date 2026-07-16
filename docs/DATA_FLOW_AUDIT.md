# Data-flow audit — every feature, schema → repository → caller → live rows

*Run: 2026-07-16 · against the real database (host Postgres `:5432`, 7 app users).*

Method: for each table, check (a) does a repository exist, (b) does app code call it,
(c) **does the live database actually contain rows**. (c) is the one that matters —
code can be perfectly wired and still be a feature nobody can reach. Every finding
below was confirmed by querying the DB or reading the code, not by grepping alone.

> **Standing lesson.** An earlier audit of mine claimed "the evidence pool is not wired
> to the résumé". That was **false** — I grepped for `createEvidenceRepository` in
> `lib/documents/`, saw nothing, and inferred a gap. The bridge is a *dynamic import*
> of `lib/evidence/pool` ([generate.ts:118](../apps/web/src/lib/documents/generate.ts#L118)).
> A grep proves presence, never absence. **Probe the behaviour.**

---

## 🔴 F1 — Momentum has readers but no writers (the worst bug in the platform) — **FIXED 2026-07-16**

> **Fixed.** `quality_application` is now emitted by `markApplicationApplied` — but only
> when a tailored document exists for the job (deterministic proof of work, no AI call,
> no provider key; a spray application is one click too, and the click is still not
> rewarded). `appliedAt` is the idempotency key, so a second click awards nothing.
> `skill_closed` is now emitted on learning completion, guarded by the existing
> already-completed early return.
>
> Pinned by `lib/resilience/wiring.test.ts`, which reads the source and fails if any
> defined reward loses its writer. That test was itself verified by deleting the writer
> and watching it fail — a first draft passed vacuously, because `service.ts` contains
> both the string `"quality_application"` (the read) and the string
> `recordForwardMotion` (its definition), so a naive `includes && includes` check would
> have green-lit this bug for its entire lifetime. It now matches the call expression.
>
> Write path verified end-to-end against the real DB on a smoke user: momentum 0 → 12,
> and `countEventsSince("quality_application")` — the read that always returned 0 —
> returned 1. Data restored afterwards (0 events, 0 dirty states).

`getMomentumSummary` **counts** `quality_application` events to compute cadence
adherence ([service.ts:61](../apps/web/src/lib/resilience/service.ts#L61)).
**Nothing ever writes one.** The only occurrence of the string `"quality_application"`
outside the engine is that read.

| kind | delta | emitted? |
|---|---|---|
| `quality_application` | +12 | ❌ **never — read-only** |
| `skill_closed` | +15 | ❌ **never** (learning completion publishes `evidence.changed` but never awards momentum) |
| `rejection_logged` | +2 | ✅ |
| `rejection_autopsy` | +10 | ✅ |
| `referral_added` | +18 | ✅ but `referral_targets` = **0 rows** |
| `rest_day` | — | ✅ |
| `comeback` | — | internal |

Live state: **all 7 `momentum_states` rows are `momentum=0, peak=0, last_action_at=NULL`**,
and `resilience_events` = **0 rows**.

**Consequence:** the only paths that can move momentum today are *getting rejected* and
*adding a referral* (a feature with zero rows). The primary user has **7 applications**
and a dashboard reading **momentum 0, cadence adherence 0** — permanently, no matter
what he does.

This inverts Principle 4 exactly. A subsystem built to "score the process, never the
outcome" currently scores **only the outcome, and only the bad one**. For a user whose
stated problem is *"making me less confident in my own career"*, this is worse than not
shipping it.

**Fix:** emit `quality_application` when an application is sent **with a tailored
document attached** (provenance = real work, per Principle 2 — not a button click,
which `markApplicationApplied` correctly refuses to reward). Emit `skill_closed` on
learning completion, alongside the existing `evidence.changed`.

## 🔴 F2 — Banned folklore is load-bearing in code

[engine.ts:37](../apps/web/src/lib/resilience/engine.ts#L37) justifies the largest
momentum reward (+18) with:

> `referral_added` is highest (+18): **1 referral ≈ 40 cold applications**.

That claim is on the **Retired Claims** table in `PLATFORM_IDEOLOGY.md` — directionally
right, numerically unsourced. It is currently setting a real number in shipped code.
Either re-ground the weight in the verified decorrelation argument (a referral is a
genuinely independent draw) or drop the figure. Doctrine binds code, or it is decoration.

## 🟠 F3 — The evidence pool is empty for every user

`evidence_items` = **0 rows across all 7 users**, including the primary user (who has
2 résumés, 1 LinkedIn, 2 tracks, 3 generated documents).

So all 3 of his documents were generated with `topEvidence = ""`. Five features read
this pool (`documents/generate`, `jobs/fit`, `career/track-resume`, `interview/jd-prep`,
`interview/company-brief`) and all five silently degrade to raw résumé text:

```ts
topEvidence ? `\n${topEvidence}` : ""
```

No warning, no nudge, no signal. The pool isn't broken — **filling it is work** (needs an
AI key, a buried `/dashboard/evidence` page, a deliberate click). Capture is the
bottleneck, not storage or ranking.

**Fixed already (2026-07-16):** the ranker used to filter `score > 0`, which *deleted*
every item whose words didn't literally overlap the track's role words — a home lab
tagged `wazuh/suricata/proxmox` scored **0** against "Cybersecurity Analyst". Low score
means **untranslated**, which is the thing this product exists to fix. New invariant:
**ranking ORDERS evidence, it never DELETES it.** Plus `market_tags` (migration 0028)
stores the market's name for the same real work.

**Fixed 2026-07-16 (visibility):** `generateCareerDocument` now returns an
`evidenceNotice` when the pool contributed nothing, and the workspace surfaces it
instead of reporting a bare "Drafted." The fallback to résumé prose was always correct;
the silence was the bug.

**Still open:** make capture cheap — the pool is empty because *filling it is work*,
not because anything is broken. Speak-to-edit (`lib/documents/dictation.ts`) is the
first move at that; voice → evidence capture is the natural follow-on.

## 🟡 F4 — Ghost tables: schema-only, zero code, zero rows

| table | repository | app callers | rows |
|---|---|---|---|
| `product_events` | ❌ none | **0 — no reference anywhere outside the schema** | 0 |
| `learning_recommendations` | ❌ none | **0** (the `learningRecommendations` hits are an unrelated zod field on the career report) | 0 |

`product_events` is the notable one: it is the table that would answer *"does this app
actually work for people?"* — the question that started this whole review. It was
defined, migrated, and never wired. **Nothing measures the product.**

## 🟡 F5 — Wired but unused (not bugs — adoption signals)

| table | rows | note |
|---|---|---|
| `referral_targets` | 0 | #1 belief, fully wired (`network/referrals.ts`, 6 exports, AI tool), never used |
| `resilience_events` | 0 | see F1 |
| `resume_templates` | 0 | repo + 2 callers exist; **no templates seeded** → the picker has nothing to pick |
| `saved_jobs` | 0 | 940 jobs ingested, none saved |

`resume_templates` at 0 rows with live callers is worth a UI check — a template picker
backed by an empty table usually renders as broken, not empty.

## 🟡 F6 — Orphaned auth identity

One row in better-auth's `user` table (`m@gmail.com`) has **no corresponding
`auth_identities` row**, hence `user`=8 vs `users`=7. An account that can authenticate
but has no application identity. Worth reproducing before deciding whether the linking
step can fail silently at sign-up.

---

## Healthy

`jobs` (940), `portfolio_items` (33), `portfolio_sites` (1), `agent_runs`/`findings`/
`messages` (27/29/25), `interview_stories` (18), `applications` (7), `career_profiles` (7),
`resumes` (7), `documents` (3). The agent and portfolio subsystems are the most genuinely
exercised parts of the platform.

## The pattern

Consistent with the feature-alignment audit: **everything aligned with the doctrine is
underbuilt; everything built is partly contradicting it.** The three subsystems that
most directly serve the primary user — evidence, momentum, referrals — hold **0, 0, and
0 rows**. The platform's own thesis is the least-exercised code in it.

Ranked by harm to the primary user: **F1** (actively demoralising, and it is the one
feature whose entire purpose is morale) → **F3** (his projects never reach his CV) →
**F2** (doctrine not binding) → **F4** (can't measure any of it).
