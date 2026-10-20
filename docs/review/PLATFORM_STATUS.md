# Fadi platform status — working, gimmick, or needs re-architecture?

**Verdict in one line:** the code is **real, not a gimmick, and does not need a rewrite** — but it has **one structural flaw** that makes it *feel* like a gimmick to a real user: it is an **output generator bolted onto a hollow record.** Fix the record, and the projections become trustworthy.

## The evidence for that verdict (the repo's own numbers)

From [FEATURE_AUDIT.md:99](../FEATURE_AUDIT.md#L99), across real users and months of use:

| Auto-generated (has data) | rows | User must capture (empty) | rows |
|---|---|---|---|
| portfolio_items | 33 | **evidence_items** | **0** |
| agent_runs | 31 | **referral_targets** | **0** |
| interview_stories | 18 | **saved_jobs** | **0** |
| career_reports | 6 | **learning completed / resilience_events** | **0** |

Everything that *generates* works and fills up. Everything that *captures a truth* is empty. The doctrine is "one truthful record, projected into every output" — but **there is no record; there are only projections of a résumé.** That is the whole problem, stated in data.

## Feature-by-feature (works? real vs gimmick? role in the spine)

| Feature | Works | Real vs gimmick | Role & verdict |
|---|---|---|---|
| **Jobs** (discovery/board) | ✅ | **Real** — rebuilt this session: owner/private split, occurrences, provenance, freshness | INPUT. Strong. |
| **Applications** (pipeline + workspace) | ✅ | **Real** — the apply flow, one-click packet | HUB of the loop. Strong. |
| **Guardian** (Apply/Stretch/Skip) | ✅ | **Real, deterministic** (`evaluateApply`) | Doctrine-aligned decision. Keep. |
| **Documents** (résumé/cover gen) | ✅ | **Real writing, unproven truth** — extractive-first + humanity gate, but **no fact gate, no provenance, AI-gated** | OUTPUT. The trust gap. |
| **Evidence** (the record) | ✅ but **empty** | **Real code, hollow in practice** | **THE SPINE — and it's the flaw.** |
| **Network** (referrals) | ✅ but empty | Real handler, 0 use — *and you told me referrals are how people actually get hired* | HIGH-value, hollow. |
| **Portfolio** | ✅ | **Real** (extracted to `@careeros/portfolio` this session) | OUTPUT. Works. |
| **Interview** (stories/mock) | ✅ | Auto-generates stories (real); capture side unused | Stage 6. Secondary. |
| **Learning / Resilience** | ✅ but empty | Real handlers, 0 rows | Capture-starved. Secondary. |
| **Profile / Settings** | ✅ | **Real** (fixed the provider-key leak this session) | Record inputs. Solid. |
| **Niche-finder / Career-report** | ✅ | AI one-shot analyses | Nice-to-have. |
| **Fadi chat / voice / agent** | ✅ AI-gated | Chat real; **voice the repo itself recommends cutting** ([FEATURE_AUDIT:86](../FEATURE_AUDIT.md#L86)) | Trim. |

## Relationships — the spine is inverted

Intended: **Profile/Jobs/Evidence (record) → Applications (decide) → Documents/Portfolio/Interview (project) → Resilience (learn) → back into the record.**

Actual: the record node (Evidence) is empty, so every projection is drawn straight from résumé prose, and nothing flows *back* into a record. Outputs don't cite inputs; inputs don't accumulate from outcomes. It's a wheel with no hub.

## So: re-architecture or redesign?

**Neither a rewrite nor cosmetic.** One structural correction, which both this pass and the [core-loop audit](CORE_LOOP_TRUTH_AUDIT.md) independently arrived at:

> Make the **evidence record the mandatory, provenance-carrying spine** that every output *derives from and links back to* — with a **claim-state** (`verified / user_attested / inferred / contradicted / unsupported`) and a **deterministic truth gate** so an unsupported claim can never silently reach an exported document.

That single change turns "an AI that rewrites your résumé" (a gimmick a hundred tools do) into "a truthful career record that proves every claim" (the defensible product). It's ~the same 5-change build the core-loop audit scoped.

## Build order (starting now)

1. **Deterministic truth gate** (`lib/documents/truth-gate.ts`) — flag invented numbers, JD-only skill terms, and seniority inflation in a generated doc against the candidate's real corpus. Pure, testable, **no AI required**. ← *building this first: it's the brick that proves the doctrine is architectural, not just a prompt.*
2. Thread claim→evidence provenance through generation; surface "▸ from: [evidence]".
3. Evidence claim-state schema + make capture the guided first step.
4. No-AI template assembly path.
5. Instrument the loop.

Deferred (not gimmicks, just not the bottleneck): durable queue, more scrapers, per-occurrence liveness, dependency upgrades, interview/learning depth, voice.
