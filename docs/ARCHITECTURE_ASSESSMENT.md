# Architecture assessment — solid pillars or weak ones?

*Run: 2026-07-16 · measured, not opined. Every number below came from the codebase or
the live database.*

**Scale:** 41,328 LOC · 24 pages · 12 API routes · 21 server-action files · 99
components · 143 lib modules · 46 test files / 322 tests · 28 migrations.

**Verdict in one line:** the *materials* are good and the *foundation* is real, but
there is one rotten pillar (`lib/ai`), the load is unevenly distributed (the biggest
modules are the least tested), and about a fifth of the building is a room nobody
enters.

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

This is also why my own earlier audit was wrong: I grepped `lib/documents/` for
`createEvidenceRepository`, found nothing, and declared the evidence pool unwired — the
call was a dynamic import. **The architecture defeated a static read of itself.** If it
can fool a reader, it will fool a refactor.

*Fix (mechanical, not a redesign):* invert the dependency. `lib/ai` should depend on
nothing but providers and types; domains call *into* AI, never the reverse. Then the 25
dynamic imports become static ones and the cycles disappear.

## 🔴 Zero rate limiting on every path that spends money

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
A held-down "Draft" button, a retry loop, or a leaked MCP token bills the user's own
OpenAI/Groq key with no ceiling. This is BYO-key, so the blast radius lands directly on
the person we're building for.

## 🟠 Load-bearing writes are not atomic

**4 uses of `.transaction(` in 41k LOC.** Multi-step writes — `importPortfolio`'s
replace, learning completion (evidence insert → commitment update → momentum award →
event publish) — are sequences of independent writes. A failure midway leaves the user
half-migrated with no rollback. Nothing observed corrupted today; the exposure is real
but the volume is low, hence 🟠 not 🔴.

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

## 🟡 Dead scaffolding

`packages/shared`, `packages/types`, `packages/ui` — **0 files each**. Monorepo
structure that was never populated. Harmless, but it advertises an architecture that
doesn't exist. Delete or fill.

Also: **one error boundary** in the entire app (`app/dashboard/error.tsx`), no
`global-error.tsx`.

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
