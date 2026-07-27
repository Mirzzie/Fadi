# Architecture assessment — solid pillars or weak ones?

*Run: 2026-07-16 · measured, not opined. Every number below came from the codebase or
the live database.*

> ## Status re-verified 2026-07-20 — read this before trusting anything below
>
> Findings were re-checked against the current tree. Several are closed, and one was
> **overstated and is corrected in place**:
>
> | finding | status |
> |---|---|
> | 🔴 Zero rate limiting on money paths | **CLOSED** — the limit moved into `getUserDocGenerate` itself (`lib/ai/user-generate.ts`); all 5 action files and the MCP route inherit it |
> | 🔴 "Five import cycles / the dependency graph is a lie" | **OVERSTATED — see correction below** |
> | 🟠 Load-bearing writes not atomic | **CLOSED for the two worst paths**; the general ratio still stands |
> | 🟡 Dead scaffolding (`packages/shared`/`types`/`ui`) | **CLOSED** — deleted; only `packages/database` remains |
> | 🟡 One error boundary | **CLOSED** — `app/global-error.tsx` added |
> | 🟠 Test coverage inverted | **STILL OPEN** — the honest remaining item |

**Scale:** 41,328 LOC · 24 pages · 12 API routes · 21 server-action files · 99
components · 143 lib modules · 46 test files / 322 tests · 28 migrations.

**Verdict in one line:** the *materials* are good and the *foundation* is real, but
there is one rotten pillar (`lib/ai`), the load is unevenly distributed (the biggest
modules are the least tested), and about a fifth of the building is a room nobody
enters.

*Revised 2026-07-20:* "rotten pillar" does not survive re-verification — see the
correction under that heading. The accurate version: **the load is unevenly
distributed — `lib/ai` carries 35 dependents across 14 domains on 2 tests — and about
a fifth of the building is a room nobody enters.** The foundation claim stands.

---

## The pillars that ARE solid

These are genuinely well-built and should not be touched:

1. **The repository layer** (`packages/database`) — consistent, typed, one pattern
   throughout, `TrackScope` handled uniformly. This is the strongest part of the codebase.
2. **A pure-function core for the actual intelligence.** `applications/channel.ts`,
   `evidence/pool.ts`, `resilience/engine.ts`, `documents/dictation.ts`,
   `documents/dictation-target.ts` are pure: no I/O, no React, no DB. That is *why*
   they're testable, and it's why the honesty rules can be pinned by tests rather than
   by good intentions. This is the right instinct and it's already load-bearing.
3. **The event bus** (`lib/events`) — a real extension seam with an ADR behind it.
4. **The schema** — coherent, disciplined migrations, no drift found against the live DB.

## 🔴 The rotten pillar: `lib/ai` is a god module inside five cycles

| measure | value |
|---|---|
| modules in `lib/ai` | 19 |
| domains it reaches into | **14** |
| files depending on it | **35** |
| **import cycles** | **5** |
| tests | **2** |

```
CYCLE: lib/ai <-> lib/evidence
CYCLE: lib/ai <-> lib/documents
CYCLE: lib/ai <-> lib/jobs
CYCLE: lib/ai <-> lib/career
CYCLE: lib/ai <-> lib/interview
```

This violates the Acyclic Dependency Principle five ways, and it is the single biggest
structural risk in the platform. `lib/ai` both *serves* the domain layer and *depends*
on it, so there is no direction to the dependency graph — you cannot reason about,
test, or extract any of these five domains in isolation.

**The tell is the workaround:** 25 `await import()` calls across 16 files, concentrated
in exactly the cycle domains (`interview`, `documents`, `ai`, `jobs`). Dynamic imports
break cycles *at runtime* while hiding them from the type checker. The graph looks
acyclic to `tsc` and isn't. **The dependency graph is currently a lie**, and every
`await import()` is a load-bearing lie.

### ⚠️ CORRECTION (2026-07-20) — the section above overstates the case

The cycle table was produced by a **directory-coupling heuristic**, not a module-graph
tool: it flagged "`lib/ai` imports from `lib/documents` somewhere AND `lib/documents`
imports from `lib/ai` somewhere" as a cycle. That is co-occurrence between *folders*,
not a cycle between *modules*, and the two are not the same claim.

What re-verification actually found:

- **`madge` reports 0 cycles.** That result was itself distrusted and tested — a known
  `@/`-alias cycle was planted deliberately and madge failed to detect it, proving the
  alias was unresolved. So madge's zero is *not* positive evidence of acyclicity either.
  **Neither tool has demonstrated a real module cycle. The honest status is "unproven",
  not "five cycles".**
- **The dynamic imports are not all workarounds.** Of the 21 remaining, the ones
  audited fall into two groups, and only the second is a smell:
  - **Deliberate boundary management** — `@/lib/env.server` and `@/lib/database/client`
    are lazy because eager imports would drag `server-only` / `pg` into a client
    bundle. Making these static would break the build, not clean it.
  - **Genuine noise** — 6 lazy imports of `@/lib/observability/logger`, a module with
    **zero imports of its own**. A leaf module cannot participate in a cycle, so these
    bought nothing and cost static analysability. **Now converted to static imports
    (21 → 15).**

**What remains true, and is the finding worth keeping:** `lib/ai` is reached by 35 files
across 14 domains and has 2 tests. That is a real concentration-of-risk problem and the
`DocGenerate` interface extraction (`lib/ai/doc-generate.ts`) was the right first move.
But "rotten pillar" and "the dependency graph is a lie" were not earned by the evidence,
and this document asserted them as measured fact. **The lesson is the same one F1 taught
and it applies to auditing too: probe the behaviour, don't infer it from a grep.**

This is also why my own earlier audit was wrong: I grepped `lib/documents/` for
`createEvidenceRepository`, found nothing, and declared the evidence pool unwired — the
call was a dynamic import. **The architecture defeated a static read of itself.** If it
can fool a reader, it will fool a refactor.

*Fix (mechanical, not a redesign):* invert the dependency. `lib/ai` should depend on
nothing but providers and types; domains call *into* AI, never the reverse. Then the 25
dynamic imports become static ones and the cycles disappear.

## 🔴 Zero rate limiting on every path that spends money — **FIXED**

**All six** files that call `getUserDocGenerate` / `getUserGenerate` are unprotected:

```
app/dashboard/documents/actions.ts
app/dashboard/applications/board-actions.ts
app/dashboard/applications/actions.ts
app/dashboard/applications/[jobId]/workspace/actions.ts
app/dashboard/portfolio/actions.ts
app/api/mcp/route.ts          <-- token-authenticated, still unmetered
```

Rate limiting exists (`lib/security/rate-limit.ts`, `consumeRateLimit`) and is used in
four *other* places — the discipline is real, it just isn't applied where the cost is.

**Fixed by moving the limit to the chokepoint, not to the call sites.** It now lives
inside `getUserDocGenerate` (`lib/ai/user-generate.ts`), which every one of those files
routes through — including `api/mcp/route.ts`. Guarding the seam rather than the 12
call sites is deliberate: a limit that each new feature must remember to call is the
exact pattern that produced F1, where a "single chokepoint" was simply never invoked by
some callers. 60 calls/hour/user, failing open on KV errors.
A held-down "Draft" button, a retry loop, or a leaked MCP token bills the user's own
OpenAI/Groq key with no ceiling. This is BYO-key, so the blast radius lands directly on
the person we're building for.

## 🟠 Load-bearing writes are not atomic — **two worst paths FIXED 2026-07-20**

**4 uses of `.transaction(` in 41k LOC.** Multi-step writes — `importPortfolio`'s
replace, learning completion (evidence insert → commitment update → momentum award →
event publish) — are sequences of independent writes. A failure midway leaves the user
half-migrated with no rollback. Nothing observed corrupted today; the exposure is real
but the volume is low, hence 🟠 not 🔴.

### Fixed, and verified against the live database

The severity call above was too generous on one of them. `importPortfolio` in `replace`
mode deleted every item in a loop and *then* inserted — so a failure at the insert
destroyed the user's entire portfolio and replaced it with nothing. That is silent total
data loss triggered by a routine import, and it was 🔴, not 🟠.

Both paths were fixed and **both directions were then proven against real Postgres**,
because the standing lesson here is that an unwatched test is not evidence:

| probe | result |
|---|---|
| Pre-fix code path (delete loop → failing insert) | **0 items left — portfolio destroyed** |
| Post-fix `repo.replaceItems` (one transaction) | **3 items preserved — rolled back** |
| Post-fix happy path | replaced correctly |

- `portfolio.repository.ts` → new `replaceItems()`: single scoped `DELETE` + `INSERT`
  inside one transaction, so it cannot partially apply.
- `learning/actions.ts` → the evidence insert and commitment update are now one
  transaction. Previously a failure between them orphaned the evidence item *and* left
  the commitment in-progress, so the natural retry inserted it a second time — the
  idempotence guard only holds if the status update lands with the insert.
- Momentum + event publish stay deliberately **outside** the transaction: they are
  downstream effects, and a failed momentum write should not cost the user the evidence
  they earned.
- `packages/database/src/client.ts` gained `Transaction` / `DbOrTx` so repositories can
  accept either a pool or an open transaction. Note the compiler-enforced constraint:
  `Transaction` has no `.transaction()`, so a repository that opens its own transaction
  internally (e.g. `reorderItems`) cannot accept `DbOrTx` — the type system catches that
  rather than leaving it to reviewer memory.

**Still open:** the broad ratio (4 → 6 transactions against ~80 writes). The remaining
multi-step sequences were not audited individually.

## 🟠 Test coverage is inverted

Coverage is strongest where the code is simplest and weakest where it's biggest:

| domain | modules | tests |
|---|---|---|
| `ai` | 19 | **2** |
| `data-sources` | 19 | 4 |
| `voice` | 5 | **0** |
| `portfolio` | 4 | **0** |
| `learning` | 3 | **0** |
| `niche`, `labor-market`, `impact`, `guidance`, `geo`, `email` | 1–2 each | **0** |

322 tests is a real asset, but they cluster in the pure modules (which are easy) and
avoid the coupled ones (which are risky). That's backwards — and the two biggest
domains are the two with cycles running through them.

Worse, the tests that exist have been *vacuous* twice in one day: the momentum wiring
test passed while the bug was live until I made it match the call expression, and the
dictation guard passed the string "There is no text to clean." straight into a résumé.
**A test that has never been watched failing is not evidence.**

## 🟡 Dead scaffolding — **FIXED**

`packages/shared`, `packages/types`, `packages/ui` — **0 files each**. Monorepo
structure that was never populated. Harmless, but it advertises an architecture that
doesn't exist. Delete or fill. → **Deleted; only `packages/database` remains.**

Also: **one error boundary** in the entire app (`app/dashboard/error.tsx`), no
`global-error.tsx`. → **`app/global-error.tsx` added.** It catches failures in the root
layout itself, which a route-level boundary structurally cannot: that boundary renders
*inside* the layout, so when the layout is what threw there is nothing left to render
it. It ships its own `<html>`/`<body>` and inline styles rather than the design system —
if the root layout failed, the stylesheet may never have loaded and any imported
component could be part of what broke. A boundary that depends on what it is catching
is not a boundary.

---

# The noise: what does NOT survive the ideology

The doctrine's test (Principle 5): *every signal must change an action; macro earns its
place only if it shifts a decision, else it's "anxiety with a dashboard."*

## 🔴 Career Weather (`/dashboard/intelligence`) — the clearest noise

`getCareerWeather` is consumed in exactly two places: the page that displays it, and a
Fadi chat tool that reads it aloud. **It shifts no decision anywhere in the system.** It
doesn't weight tracks, doesn't reorder jobs, doesn't touch fit, doesn't influence a
document. It is a news feed with AI commentary attached.

Each card carries a `move:` string, so it *gestures* at an action — but a sentence
telling you to do something is not the system doing it. For a user whose confidence is
already collapsing, a rolling feed of macro forces he cannot influence is the precise
failure mode Principle 4 exists to prevent.

`lib/data-sources` is 1,472 LOC / 19 modules. **Not all of it is noise** — it also feeds
`lib/jobs/sync`, which is genuinely core. But the macro/news half exists to fill this
page.

*Recommendation:* cut to track-weighting only, as the doctrine already says. Keep the
ingestion that serves job sync; delete the feed. If macro can't change a number the
system acts on, it shouldn't have a page.

## 🟠 Fadi chat + voice — unvalidated, and now competing with itself

A conversational mentor is the platform's most expensive surface and its least
evidenced. The honest question the doctrine already asks: *is a talking mentor what you
need at 11pm with 90 minutes?* Speak-to-edit suggests the answer is no — you don't want
to *converse*, you want to *dictate into the document* and leave.

## 🟡 Wired but never used (0 rows, all of them)

`referral_targets`, `resilience_events`, `saved_jobs`, `resume_templates`,
`evidence_items` — see `DATA_FLOW_AUDIT.md`. Not noise by design (referrals are the #1
belief), but noise *in practice*: code carrying no load.

## ⚪ Ghost tables

`product_events`, `learning_recommendations` — zero references outside the schema.
Delete them or wire them. `product_events` is the one that would answer *"does this work
for people?"*

---

## Honest summary

**Is it built with proper materials?** Yes — repositories, pure cores, typed schema,
real tests, an event bus with an ADR. This is not a weak codebase.

**Are the pillars solid?** Four of five. `lib/ai` is structurally unsound: it's a god
module inside five cycles, propped up by 25 dynamic imports that hide the cycles from
the compiler. Nothing is falling down today, but that pillar cannot bear a refactor.

**Is there noise?** Yes — roughly a fifth of the surface. One feature (Career Weather)
fails the doctrine outright; several others are built and unused.

**The deeper pattern, unchanged from the alignment audit:** *everything aligned with the
doctrine is underbuilt; everything built is partly contradicting it.* The pure,
doctrine-shaped modules are small, tested, and correct. The big modules — `ai`,
`data-sources` — are the coupled, untested, cyclic ones. **The platform is best exactly
where it is smallest.**

Ranked by risk: **rate limiting** (costs real money today) → **`lib/ai` cycles**
(blocks every future change) → **Career Weather** (costs attention and morale) →
transactions → dead scaffolding.
