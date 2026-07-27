# Assumption ledger

*Started 2026-07-20. Reviewed at the top of every planning session.*

## Why this file exists

Between 2026-06-02 and 2026-07-16 this platform was built across 170 commits on a
doctrine that carried **zero citations** until commit #172 of 174. The research that
justifies the product arrived after the product. When it arrived, it forced deletions —
the commit is literally titled *"align the platform with its doctrine, and cut what
contradicts it."* Had the evidence come first, there would have been nothing to cut.

That failure mode is not carelessness; it is *invisible*. An unverified assumption
behaves exactly like a verified one right up until it doesn't. This ledger makes them
visible, so we can see what we are betting on before we bet more on it.

**The rule:** if we are about to build something that depends on a row in the UNVERIFIED
table below, that gets said out loud first. Not to block the work — to make the bet
conscious.

## Status vocabulary

| status | meaning |
|---|---|
| **VERIFIED** | Checked against real data. Cite the source. |
| **UNVERIFIED** | Plausible, load-bearing, untested. Normal — most things start here. |
| **CONTRADICTED** | We have data pointing the other way and are still building on it. **Dangerous.** |
| **RETIRED** | Was load-bearing, now removed or replaced. Kept for the audit trail. |

---

## ✅ RESOLVED — A1 was never an assumption at all

### A1. ~~Users will populate their Evidence pool~~ → **IT WAS A BUG** (closed 2026-07-20)

- **What it looked like:** `evidence_items` → 0 rows across 7 users. Read as a behavioural
  finding: "users won't do the capture step."
- **What it actually was:** the extraction failed **100% of the time**, for everyone,
  from the day it shipped. The one user with a real history (3,751 chars), a working
  Groq key and a resolved provider still got zero items.
- **Root cause:** `poolSchema` used `.optional()` and `.default([])`. OpenAI-compatible
  structured output only *enforces* a schema in strict mode, and strict mode requires
  every property to be `required`. One `.optional()` silently demoted the call to a
  non-strict schema, the model was then merely advised of the shape, and it returned an
  object with no `items` key → `ZodError: expected array, received undefined`.
- **Why it stayed invisible for weeks:** the `catch` discarded the exception and returned
  "please try again." A swallowed error on the product's core path is an outage nobody
  can see. The catch now logs cause, `historySource` and block size.
- **Verified, not inferred:** `.optional()` failed on every attempt; `.nullable()`
  returned 9 then 10 items on consecutive runs; the production path then created **10
  real evidence items** with both `tags` and `market_tags` populated.
- **Guarded by:** `pool-schema.test.ts` — a pure test pinning "no optional fields
  anywhere", watched failing by reintroducing `.optional()` on one field.

> **The methodological lesson, which outlives the bug.** A1 was filed as CONTRADICTED —
> "the data says users won't." The data said no such thing. Zero rows is an *observation*;
> "users won't" was an *interpretation*, and the interpretation went in the ledger as if
> it were the observation.
>
> Had we run the dogfood spike first, the author would have pasted their history, seen
> nothing appear, and concluded the capture UX was too heavy — then "fixed" a UX that was
> never broken, while the real bug survived.
>
> **Before attributing a zero to human behaviour, prove the machine works.** This is the
> same shape as the folklore stat (R1): a conclusion that felt obviously right, resting on
> a step nobody checked.

### A2. Momentum motivates continued use

- **Depends on it:** the resilience engine, the dashboard's primary emotional loop.
- **Evidence against:** `resilience_events` → **0 rows**. F1 (missing writers) was fixed
  and pinned by `wiring.test.ts`, yet no real action has ever produced an event. A
  passing wiring test proves the call exists, not that a human ever triggered it.
- **Cheapest test:** complete one real learning commitment end to end and confirm a row
  appears.

---

## ⛔ BLOCKS SEVERAL ENTRIES BELOW — the schema defect is a CLASS, not one bug

The `.optional()` failure that emptied the evidence pool is present in **six more
structured-output schemas**. Verified 2026-07-20 with an identical prompt against the
live model: the `.optional()` shape threw on every attempt, the `.nullable()` shape
returned results.

| schema | file | `.optional()`/`.default()` | feature affected |
|---|---|---|---|
| `reviewSchema` | `lib/documents/cv-review.ts` | **13** | CV review |
| `briefSchema` | `lib/interview/company-brief.ts` | 4 | Interview prep |
| `suggestionSchema` | `lib/learning/suggest.ts` | 4 | Learning suggestions ✅*verified broken* |
| `scoreSchema` | `lib/interview/mock.ts` | 3 | Mock interview scoring |
| `prepSchema` | `lib/interview/jd-prep.ts` | 2 | JD prep |
| `questionsSchema` | `lib/interview/mock.ts` | 2 | Mock interview |

Clean (correctly built): `aqsSchema`, `fitSchema`, `insightSchema`,
`resumeGenerationSchema`, `turnSchema`.

### FIXED 2026-07-20 — all 28 occurrences removed

Verified against the live model through each feature's real production entry point:

| feature | result |
|---|---|
| Learning suggestions | ✅ returns real projects |
| Interview company brief | ✅ returns a real brief |
| JD prep | ✅ returns STAR questions |
| Mock interview questions | ✅ returns questions |
| Mock interview scoring | ✅ returns a score |
| CV review | ✅ verified 2026-07-20 (once Groq quota reset) — `runDocReview` returns ok:true through its real entry point. |

**Scope of the rule, measured not assumed:** only `.optional()` and `.default()` break
strict mode. `.max(n)`, `z.coerce.number()`, `z.number()` and nested object arrays were
each tested and all succeeded — do not "fix" those.

**Guarded by** `lib/ai/structured-schemas.test.ts`, a source-scanning test covering all
10 schema files, so a newly written schema is protected without anyone remembering to
add it. It carries its own anti-vacuity assertion (it fails if it finds fewer than 9
schemas) and was watched failing by reintroducing `.optional()` into `reviewSchema`.

**Both swallowing `catch {}` blocks now log their cause** (`evidence/pool.ts`,
`documents/cv-review.ts`). A bare catch on an AI path converts a 100%-reproducible
failure into an invisible one — that is *why* this survived six weeks, and it is the
more durable of the two fixes.

**Why this matters more than the bugs themselves:** it invalidates the reasoning behind
several pending product decisions. The rebuild plan proposes cutting features on the
grounds that they are unused. But Interview, Learning suggestions and CV review have
**never worked for any user** — `learning_commitments` holds 1 row. Low usage of a
feature that returns an error 100% of the time is not evidence about user demand.

**No feature may be cut for "low usage" until it has worked at least once.** Judging a
feature that has never executed is the same error as reading 0 evidence rows as "users
won't" (A1).

### A3. Decorrelation changes what a user does

- **Depends on it:** this is **the differentiator** — the one feature grounded in real
  research (FAccT 2026, Kleinberg & Raghavan PNAS 2021).

- **2026-07-20 — it was STRUCTURALLY DEAD, now fixed. Same class as A1.** Before assuming
  the blocker was "users haven't reached 5 applications," the mechanism was checked. The
  insight attributes a channel from `application.url` — which is **null on the primary
  creation path** (`createApplicationAction` never captured it). So `analyseChannelMix`
  excluded almost every row as "unknown" and the insight could not fire **at any volume**.
  Measured: 7 of 8 live applications had a null `application.url`. Meanwhile the linked
  `jobs` row — present for every discovered job, **1,114 of 1,119 with a real URL** —
  carried exactly the channel needed and was ignored.
  - **Fix:** attribute from `application.url ?? job.url` (read-side, retroactive, no
    migration). `channelUrl()` helper + `listChannelSignalsForUser()` repo join.
  - **Verified end-to-end against the live DB:** 5 applications linked to real discovered
    LinkedIn jobs (all `application.url` null) → **before fix: 0 attributable, dead;
    after fix: 5 attributable, concentrated, insight fires** with the correct headline.
    Throwaway user, deleted after; the real user's data was not touched.
  - **Guarded by** two new tests in `channel.test.ts` (job-url attribution; app-url
    precedence) + `channelUrl` precedence test.

- **What remains genuinely a user-behaviour question (A3 proper):** does the sentence,
  once seen, change what the user does next? That still needs a real user to reach 5+
  *attributable* applications. The mechanism is now proven; the behavioural claim is not.
  The real user has 3 (2 manual with no channel, 1 LinkedIn) — the fix does not fabricate
  signal that isn't there for them, which is correct.

- **Threshold note:** `MIN_FOR_CLAIM = 5` is itself an unverified guess — a reasonable
  one (below it the concentration ratio is noise), but never validated. Do not treat 5 as
  load-bearing truth.

### A4. Job seekers will supply their own AI API key

- **Depends on it:** every AI feature; effectively the whole product.
- **Status:** untested. No funnel data, no comparison, no user ever asked. Chosen for
  architectural convenience (BYO-key means no inference cost and no spend liability),
  never validated as a *product* decision.
- **Stage note:** this is **launch-blocking, not now-blocking.** With no acquisition
  funnel there is nothing to damage. Do not spend on it before there are real users.
- **Range other products take:** BYO-key to technical audiences (Continue.dev, early
  Cursor) · hosted free tier + BYO-key to unlock more (Raycast, Cline) · fully hosted
  with hard rate limits (most consumer AI).

### A5. The audience wants a career *operating system*, not a point tool

- **Depends on it:** the existence of 11 nav sections.
- **Status:** untested, and this is the assumption with the largest sunk cost behind it.
  The day-one docs asserted *"traditional tools fragment… CareerOS unifies them"* with no
  named competitor and no evidence. Build order shows commodity features first
  (jobs #13, applications #17, documents #41) and the actual bet last (#172).
- **Cheapest test:** which section does a real user return to twice? Nothing else in the
  product answers this.

### A6. AI-drafted, evidence-grounded documents outperform generic ones

- **Depends on it:** the extractive-first anti-slop architecture, the humanize layer.
- **Status:** untested against any outcome. `documents` → 4 rows. Note this assumption is
  currently *unfalsifiable* because A1 is contradicted — with an empty pool there is no
  evidence-grounded document to compare.

---

## ⚪ NOT ASSUMPTIONS — decisions never made

These are not beliefs awaiting evidence. They are choices that defaulted.

### A7. Data retention — **DECIDED: ADR 0007 Accepted (Option A), shipped 2026-07-20**

**Resolved.** Option A adopted: "kept until you delete it," now stated explicitly rather
than defaulted by omission. Account-closure gap closed — `closeAccountAction` deletes
both identity tables atomically, verified against the live DB (full closure → all zero;
mid-transaction failure → account preserved). Two labelled actions in the profile Danger
Zone. Automated purge (B/C/D) deferred until a second user and real autopsy rows exist.
Full record in `docs/adr/0007-data-retention-and-erasure.md`.

Original finding, for the audit trail:

There is **no retention policy in code**. No purge, no expiry, no TTL on career data. The
day-one doc promised "hard-delete according to retention policy"; the policy was never
written. This product stores résumés, rejection autopsies and career anxieties
indefinitely, by omission rather than decision.

**Options, trade-offs and a recommendation are in `docs/adr/0007-data-retention-and-erasure.md`.**
Status is PROPOSED — no code exists for it, which is the point.

Two facts established while writing it, both correcting earlier claims:

- **Erasure is stronger than the audit implied.** 26 tables carry `ON DELETE CASCADE`
  from `users.id`, verified against the live DB. App data really is removed.
- **The gap is narrower and more specific than "leaves the auth identity."** There are
  two identity tables — `users` (app, 7 rows) and `user` (better-auth, 8 rows). Deletion
  touches only the first, so the credentials still authenticate afterwards.

### A8. Pricing

No prices were ever chosen and no billing code was ever written. The day-one monetization
doc said *"launch monetization only after product value is validated"* — that deferral was
deliberate and has been honoured. Recorded here so it is not mistaken for an oversight.

---

## ✅ VERIFIED

| # | claim | evidence |
|---|---|---|
| V1 | Job ingest works across multiple sources | `jobs` → 1,103 rows (2026-07-20) |
| V2 | LinkedIn guest scraping returns real postings | live probe, 19 Dublin jobs (2026-07-20) |
| V3 | Indeed public HTML blocks server-side fetch | 403 from Node *and* curl after ~1 request |
| V4 | Portfolio replace was destructive pre-fix | live-DB probe: old path left 0 items, new path preserved 3 |

## 🗄 RETIRED

| # | claim | why |
|---|---|---|
| R1 | "1 referral ≈ 40 cold applications" | Directionally right, numerically unsourceable. Replaced by the decorrelation argument, which is verified and explains *why*. **Cleanup incomplete** — still asserted as fact in `CAREER_PERFORMANCE_TRAJECTORY.md:133`. |
| R2 | "73% of employers are skills-based" | Vendor PR figure. |
| R3 | "75% of résumés never seen by human eyes" | Traces to a 2012 marketing claim by a company that closed the next year. |
