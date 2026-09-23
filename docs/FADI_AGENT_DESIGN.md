# Fadi: the design

**Written for:** the owner, and Codex, as the target both of us build against.
**Date:** 23 September 2026
**Status:** Built, in the order below. Supersedes the "assistant panel" model in earlier UI notes.

| Step | State |
|---|---|
| 1. Sources — keep only what works | **Done** (`2f82ba0`, `aad0785`) |
| 2. The running plan on Today | **Done** (`8a75c91`) |
| 3. The intent bar | **Done** (`0c6aa84`) |
| 4. Capability contract + MCP client | **Done** (`f92491d`) — consent is per connection, not per call |
| 5. Triggers | **Done** (`2b59b04`) — background work proposes, never starts |

What is deliberately NOT built, and should be next:

- **Consent per call.** A connected server's tools are allowed or not allowed as a whole, decided
  once. The exact arguments shown on Today before anything runs is the missing piece, and the
  refusal message is written to be replaced by it.
- **Stop mid-step.** A plan stops between steps, not during one. Nothing currently running can be
  cancelled halfway, so "Stop" puts the plan down rather than interrupting a call.
- **More templates.** Only `apply-to-role` exists. Follow-up-after-silence and
  prepare-for-interview are the obvious next two, and both are refs + steps, not new machinery.
- **Voice as an intent input.** The bar takes typing; hold-to-talk is not wired to it yet.

## The one sentence

**Fadi is not a window. It is the runtime. Every screen is a view of its work.**

A chat window makes the person the orchestrator: they hold the goal in their head, decide the
order, type each request, copy the result to the next place. That is the opposite of what a
JARVIS is. In a JARVIS the machine holds the plan, does the steps, and reports; the person
states intent, watches, and decides the things only they can decide.

Fadi already has the parts for this. What it does not have is the shape.

## What exists, and what the shape costs

| Part | State |
|---|---|
| Work kernel — goal → plan → step, receipts, outputs | **Built** (migrations 0055–0057) |
| Capability contract — every tool declares risk and effect | **Built** |
| One execution funnel — every tool call receipted | **Built** |
| Context envelope — route, entity, work item | **Built** |
| Work-scoped conversation | **Built** |
| Background pass that finds things | **Built**, but can only write findings |
| A visible running plan | **Missing** |
| One intent input, everywhere | **Missing** (there is a ⌘K that navigates and a chat that talks) |
| Capabilities from outside Fadi | **Missing** (Fadi is an MCP server; it is not an MCP client) |
| Triggers that start work | **Missing** |

So the gap between Fadi and a JARVIS is four pieces, not a new product.

## The architecture

```
  intent ──▶ planner ──▶ work items ──▶ executor ──▶ capabilities ──▶ receipts
   (one line)  (template   (goal/plan/   (risk gate)   (internal or      (durable)
                first)       step)                      external)
                                  ▲                                         │
                                  └───────────── triggers ◀─────────────────┘
```

**1. Intent, not conversation.** One line in, from anywhere: ⌘K, hold-to-talk, or a button on a
job ("apply to this"). It is a request, not a turn in a thread. Nothing about it implies a
transcript, and the answer is not text — it is work appearing.

**2. Planner, template first.** Known journeys have written plans, not improvised ones. "Apply
to this role" is always: verify the role is live → check fit against the record → tailor the CV →
draft the message → you submit. The model fills in the specifics; it does not invent the shape.
Free-form planning is the fallback for the unknown, not the default. A plan is `work_items`, so
it is visible, resumable and revertible the moment it exists.

**3. Capabilities are the extension point.** A capability declares what it is called, what it
touches (`read | write | external`), what it does in the person's words, and — next — its scopes
and whether it can be undone. Everything downstream already keys off that declaration: routing,
approval, receipts. **This is the answer to "connect Fadi to other tools later."** An external
tool becomes a capability provider that meets the same contract. Fadi is already an MCP server;
it needs to be an MCP client, and then a connected server's tools are Fadi's capabilities, with
its own risk tier, approval rule and receipts, with no other code changing.

**4. Executor, with the gate in the data.** Read runs. Write runs and is receipted and
reversible. External asks first. The rule is read from the capability, not written into each
call site — which is why a new connector inherits the safety instead of re-implementing it.

**5. Receipts are the report.** Already durable, already survive the work being deleted. This is
what "Fadi did X" means; nothing else may claim it.

**6. Triggers.** The background pass may **start a bounded plan on the active goal**, not merely
leave a note. Bounded means: templated plan, no external step without approval, one announcement,
one undo. This is the difference between an assistant that waits and one that works.

## What the person sees

**Today is the console.** Not a card wall, not a transcript.

```
  Working towards     Land a cloud support role in Dublin        [Change]

  Fadi is working     Apply to Version 1 — Service Desk Engineer
                      ✓ Checked the role is still live            2s
                      ✓ Assessed fit against your record          6s
                      ⟳ Tailoring your CV…                     [Stop]
                      · Draft the message
                      · You submit

  Do this next        Reply to the recruiter at Zartis          [Open] [Done]

  What Fadi did       Drafted and saved a document — 2 hours ago
                      Checked your market and your record — nothing new
```

Rules for this surface:

- **The plan is the UI.** Steps tick over in place. No bubbles, no "thinking…" prose.
- **One thing at a time.** One running plan, one next action. More is a queue, not a dashboard.
- **Stop is always there.** Anything running can be stopped; anything done can be undone or
  explained by its receipt.
- **Fadi speaks only when it has something.** A state chip (idle / working / waiting on you), not
  a personality that fills silence.
- **Interruptions are decisions, and they sit on Today** — never only behind an icon.

**The panel that exists today becomes the thread of one piece of work**, opened from a step when
the person wants to argue with it. That is already built. It is no longer where you go to ask for
things — the intent bar is.

## What this deletes

A design is also what it removes:

- the chat window as a destination;
- "conversation mode" as a separate mental model from the command bar;
- per-feature assistant components;
- any screen whose job is to show the person what to copy into the next screen.

## Order of work

1. **Sources first** (below) — a JARVIS that reports noise is worse than no JARVIS.
2. **The running plan on Today**, read from `work_items` + `work_executions`.
3. **The intent bar**: ⌘K and hold-to-talk both submit an intent; the planner turns the five
   known journeys into plans. Chat panel demoted to "this work's thread".
4. **Capability contract v2**: scopes, reversibility, provider. Then the **MCP client**, so an
   external server's tools arrive as capabilities under the same gate.
5. **Triggers**: the background pass may start a bounded plan on the active goal.

---

# Job sources: what is actually working

Measured on the owner's own database, all postings ever pulled, 12 June – 23 September 2026.
"Useful" means: still active, in Ireland (or genuinely remote), and on one of the owner's roles.

| Source | Useful now | Ever pulled | Yield |
|---|---|---|---|
| **Fadi Job Scraper (Indeed)** | **351** | 601 | 58% |
| **Jooble** | **95** | 555 | 17% |
| **Fadi Web Surfer** (Greenhouse/Lever boards) | **48** | 389 | 12% |
| **Reed** | **22** | 263 | 8% |
| **Fadi Web Crawler** | **17** | 65 | 26% |
| LinkedIn via Apify | 29 | 299 | 10% — *no pull since 13 Aug, costs money* |
| Arbeitnow | 21 | **2,487** | **0.8%** — a German board; 2 of 2,487 in Ireland |
| JSearch | 15 | 259 | 6% — US-centric in practice |
| The Muse | 13 | 92 | 14% |
| Remotive | 3 | 68 | 4% |
| Adzuna | 3 | 377 | 0.8% — *its own code comment says "NOT Ireland"* |

**Keep five:** Fadi Job Scraper, Jooble, Fadi Web Surfer, Reed, Fadi Web Crawler.
They produce **533 of the 567 useful postings — 94%** — and three of them are Fadi's own.

**Remove six providers and their keys:** Arbeitnow, JSearch, Remotive, The Muse, Adzuna,
LinkedIn-via-Apify. Also remove `linkedin-guest` and `indeed-public`, which are registered but
have never produced a single row.

What this buys, beyond a shorter list: Arbeitnow alone has put **2,487 postings** into the
database, 2,023 of them still active, to yield 21. Every one is carried through dedupe,
relevance scoring and liveness checks on every search. The panel in the screenshot is mostly
reporting the health of sources that cannot help this person.

**The honest caveat:** these numbers are for one person, in Ireland, in IT. Adzuna is genuinely
good in nineteen other countries; Remotive is genuinely good for remote-first roles. The rule
that follows is not "these sources are bad" — it is **a source may only run for a market it
covers**, and the registry should select by the active direction's country rather than calling
everything and filtering afterwards. Deleting them now is right because Fadi has one user in one
market; the selection rule is what makes it right again when it has more.

**And the panel should change with it.** "Returning jobs" is not a useful thing to tell someone.
Per source, in their words: *"Reed — 22 roles you could apply to, last checked 10 minutes ago."*
A source that returns nothing for the person's market for two weeks should say so, and offer to
turn itself off.
