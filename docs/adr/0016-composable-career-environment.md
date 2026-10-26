# ADR 0016: Composable, user-owned career environment

**Status:** Proposed (design phase). No implementation or merge of runtime beyond this document and
its contracts until the shared interfaces below are reviewed and signed by Claude, Codex and the
owner. Builds on ADR 0014 (Practice adapters) and ADR 0015 (Adaptive Career Loop).
**Date:** 2026-10-26
**Deciders:** the owner (product), Claude and Codex (contracts). Reviewed with ChatGPT.
**Related:** ADRs 0006 (event bus), 0007 (retention & erasure), 0011 (lab/evidence), 0012
(permission broker), 0013 (work surface), 0014 (domain-neutral practice), 0015 (adaptive loop).

## Prerequisites (Phase 0 — stabilise, before any 0016 implementation)

- **Verified 26 Oct 2026:** ADRs 0006–0015 are present on `origin/main`; the 0014 adapter model and
  0015 loop are the accepted foundation. (Codex's "0014/0015 not found" was a stale-branch checkout,
  not a missing merge.)
- **Still to reconcile before implementation:** the worker/evaluation/fetch candidates (the "0072/0073"
  track and `codex/research-fetch-snapshot`) against current main, keeping the worker protocol,
  shared-DB approval and evidence gate intact. No ADR-0016 migration number is reserved here.

## Context

FADI is open source and meant to support a person's whole career. Today its surfaces (labs,
portfolio builder, job workflow, the lab engine) carry one profession's assumptions — IT/security.
A nurse, mechanical engineer, artist or executive cannot use the same foundation without being
pushed into the same dashboard; and two cybersecurity professionals may want entirely different
experiences. ADR 0014 already proved the fix for *Practice* (adapters, not Docker-branching). This
ADR generalises that to the **whole application** and adds AI-driven composition **and** direct user
control.

The owner's framing: **FADI is a house you buy empty and furnish yourself.** The building and its
purpose — a *calm, honest place to grow a career* — are fixed. The furniture (portfolio, labs,
trackers, interview prep, reflection) is chosen, added, modified and removed by the person, phone-
settings style. Nothing profession-specific is hard-coded into the core. The AI proposes a
furnishing from the person's verified situation and plan; the person disposes.

A second, equally important observation from the owner and the review: **a plan can be factually
sound and progressing while the person quietly disbelieves in it, feels overwhelmed, or is following
it out of fear.** Measuring only tasks, hours and applications would mislabel that as success. FADI
must account for the human — satisfaction, confidence, concerns, intuition — without becoming a
therapist or inferring mental state from behaviour.

## Decision — the defining concept

> **FADI is a personal career operating environment that assembles, adapts and retires capabilities
> as a person's needs change — without losing their history, imposing a fixed career path, or
> surrendering control to AI.**

### Nine decisions

| # | Decision | Purpose |
|---|---|---|
| 1 | **Domain-neutral kernel** | One universal career foundation; zero profession branching in core |
| 2 | **User-owned capability control** | The person chooses their own application |
| 3 | **Calm, evidence-based philosophy** | No fear-driven or coercive engagement; motivation, not fear |
| 4 | **Declarative composition** | Personalisation without unrestricted AI-generated executable code |
| 5 | **Situation-aware, optionally plan-driven setup** | Serves both clear and uncertain users |
| 6 | **Workspace / Capability separation** | Flexible interfaces without duplicating business logic |
| 7 | **Lifecycle & dependency contracts** | Safe install, update, removal, migration |
| 8 | **Resource, permission & provenance enforcement** | Predictable, auditable, cost-controlled |
| 9 | **Portability & outcome accountability** | User-owned data; meaningful long-term progress |

Plus a cross-cutting kernel principle, detailed in §7: **Human Alignment** — never equate activity
with satisfaction.

## 1. Four layers and three authorities

```text
User-owned Career Environment   preferences · routines · country · goals · Plans A/B/C · capability choices · budgets
        │
Adaptive Career Intelligence    situation · evidence · research · planning · learning · adaptation · alignment
        │
Capability Composer + Runtime   propose → resolve → configure → assemble → revise → retire; run installed capabilities
        │
FADI Kernel                     identity · permissions · provenance · events · storage · scheduling · evaluation · safety · audit · consent
```

Only **installed and activated** capabilities appear in a workspace. "An AI agent selecting
capabilities is not the same as an agent making career decisions" — they are independently testable,
independently permissioned processes.

**Three sources of authority (trust boundaries) — this supersedes the earlier "AI proposes → you
dispose" shorthand:**

- **User authority — decides.** Goals, plans, presentation, feature selection, budgets, preferences,
  data sharing, approvals.
- **AI authority — suggests and prepares.** Research, recommendations, workflow drafts, feature
  proposals, explanations. Always inspectable and overridable.
- **Kernel authority — enforces invariants.** Auth, tenant boundaries, declared permissions, data
  integrity, execution isolation, verification status, auditable consequences, consent.

The composer agent **cannot** approve its own permissions, execute code because it proposed it, read
another capability's private data without user authorisation, or rewrite evidence to make a plan
look successful.

## 2. Capability / Instance / Workspace separation

> A **capability** is what FADI *can do*. A **workspace** is how a particular person *wants to work*.

```text
Capability Definition  →  Capability Instance  →  Workspace Composition
(what it is, versioned)   (this person's configured copy, with state/data)   (the person's arrangement of instances)
```

Two people studying AZ-104 both use the Learning capability but have different workspaces (one wants
a timetable + resources + practice + notes + an external-platform link; the other wants only
resource tracking + reminders). No predefined interface is imposed.

## 3. Capability lifecycle (state machine)

```text
                 install                 activate
 (catalog) ───────────────▶ installed ───────────▶ active ◀─┐
                               │  ▲                  │  │    │ configure (self-loop on active/installed)
                     remove    │  │ restore          │  │ pause
                 (data choice) ▼  │                  ▼  │
                            removed                paused ──┘
 active/installed ──hide──▶ hidden (data kept, out of view) ──unhide──▶ previous
 active/installed ──archive──▶ archived (records kept, activity stopped) ──reactivate──▶ installed
 any version ──update──▶ (migrated instance) ; ──export──▶ portable bundle ; import ──restore──▶ installed
```

Rules:
- **Removing a capability never silently destroys canonical career evidence.** Removing *Portfolio*
  keeps the projects/qualifications/evidence it displayed; those live in the career record
  (ADR 0015 / evidence gate), not inside the capability. Removal always carries an explicit
  data-handling choice.
- **Pause stops background work**, not just the menu item: paused capabilities run no agents,
  reminders, searches or scheduled tasks.
- **Hide** removes from view but keeps data; **Archive** preserves records but halts normal activity.
- **Update** runs a versioned instance migration; an older version must never corrupt data on upgrade.

## 4. Dependency & compatibility resolver

The composer emits a **composition proposal**, never an instant install. A resolver then checks, per
proposal: required/optional **capabilities & adapters** exist and are version-compatible; **permissions**
are declared and grantable; **resource** requirements fit the user's budget (§6); **preferences** are
respected. Only after resolution and user approval does activation happen. (Example: an AI-drafted
interview-prep workspace requesting career profile + role description + voice + rubric + feedback
journal is resolved before anything is installed.)

## 5. The four-level AI evolution ladder

| Level | What the AI may do | Control |
|---|---|---|
| 1 | **Personalise** an existing capability (layout, prompts, content, progress logic, settings) | Low risk |
| 2 | **Compose** a workflow from approved blocks (study tracker, interview routine, dashboard) | Controlled |
| 3 | **Generate a declarative feature** (typed form, table, scenario, assessment, visualisation, rules-based workflow) | Preview + validate |
| 4 | **Create genuinely new executable functionality** (source/integration primitives can't express) | Isolated dev + security review + tests + explicit release |

**No arbitrary runtime code execution.** Levels 1–3 ship *data* (manifests + content) the kernel runs
through trusted renderers/adapters — never new JavaScript to the browser. Level 4 is not reachable by
user approval alone: generated code must pass sandboxing, dependency restriction, security review,
tests and a release process. This gives the *feeling* of FADI "building its own features" without
giving a language model uncontrolled access to executable code.

## 6. Facts vs preferences vs inferences; resources; portability

- **Three kinds of knowledge, never equated:** `fact` (country, qualification, actual experience,
  work authorisation, available time), `preference` (learning style, schedule, interaction style,
  desired features), `inference` (possible interests, likely strengths, suggested activities). **An
  explicit user preference always overrides an AI inference.** An inference never overwrites a stated
  choice. Sensitive facts (health, finances, immigration) are **optional, purpose-limited, private by
  default**; the user sees which capabilities need them.
- **Resource budgets as a platform contract.** Every capability declares AI/token usage, search/API
  calls, storage, background frequency, external-service cost and required compute. The user sets
  global limits; a lightweight budget service pauses non-essential automation at the limit. **An
  activated capability never silently provisions paid cloud resources.**
- **Portability & graceful degradation.** Portable exports for plans, events, evidence, activities,
  credentials and user-generated workflows. Degrade gracefully: **no AI provider → saved plans,
  records and manual workflows still work**; research API down → last-verified evidence with
  freshness warnings; external platform disconnected → local progress preserved; feature removed →
  underlying records remain. Critical for an open-source platform.

## 7. Human Alignment — a kernel principle (proposed amendment to ADR 0015)

> FADI must continuously check not only whether a plan is *progressing*, but whether the person still
> **understands, believes in and voluntarily wants** to pursue it.

**Loop amendment (ADR 0015):** add a **Reflect** stage, so the loop reads
`Understand → Research → Verify → Plan → Agree → Act → Observe → Reflect → Adapt`. Reflect combines
outcome evidence with the person's self-reported satisfaction, confidence, concerns and intuitions.
Research and verification remain required; **composition and reflection never override them, and a
reflection event never silently rewrites an approved strategy.**

**Kernel responsibilities (ADR 0015):**
- Never equate activity/silence/compliance with satisfaction. A missed session is a missed session,
  not evidence of a mental state.
- Preserve uncertainties; require explicit approval for meaningful strategy changes.
- Distinguish **external plan assessment** (feasibility, market, requirements, constraints — cited)
  from **user-reported alignment** (interest, satisfaction, confidence, workload, concerns). Neither
  auto-overrides the other.
- **Do not optimise for user satisfaction** as a maximised metric — that invites sycophancy and false
  reassurance. Optimise for **informed decisions + genuine user autonomy + evidence-based guidance +
  psychological respect.**
- **Separate decisions:** a workspace change is not a career-strategy change. A rejected application
  may prompt an interview-practice suggestion; it must not auto-conclude "Azure was wrong" or abandon
  Plan A. Hiding the Job Tracker must not erase application history.

**Optional capabilities under this ADR (not kernel):** reflection journal, check-in prompts, values
exploration, a **career-guidance conversation** (voice/text), deliberation, and human-support
resources. A user can turn check-ins off entirely and use FADI normally.

**Mechanisms:**
- **Reflection Service** — optional, user-initiated or gently scheduled check-ins (after agreeing a
  plan, at user-chosen intervals, after major setbacks, on request). Default cadence configurable
  (e.g. weekly / twice-monthly / monthly / only-on-request / off), plus optional event-triggered
  check-ins. Declining a check-in records **no** conclusion.
- **Concern & Intuition Ledger** — records user-approved personal ideas, doubts and alternatives,
  *separate* from verified facts and AI inferences. Example: "I still want to explore AWS even though
  we chose Azure" becomes a recorded intuition + a time-boxed, reversible exploration offer — intuition
  as an *input* to decisions, not an automatic override of evidence.
- **Alignment Evaluator** — surfaces *possible* mismatches between plan and expressed preferences;
  proposes, never concludes.
- **Deliberation Engine** — compares options/trade-offs without pressure; the person can always choose
  **"talk it through without changing my plan."**
- **Human Support Boundary** — recognises when AI help is insufficient and points to qualified human
  career or mental-health support. FADI is **not** a therapist.

**Distinguish dissatisfaction types before acting:** "I'm tired" → maybe a break; "too difficult" →
method/pace; "no interviews" → application strategy; "I don't enjoy this field" → possible goal
mismatch; "visa fear" → factual constraint planning; "I have another idea" → exploration, not
dismissal. Ask before concluding; never diagnose from completion rates, response times or private
writing.

**Personal Career Alignment Engine (PCAE)** — the domain-neutral component linking the person's
*interests & values, ambitions, life circumstances, readiness & confidence, capabilities, intuition
& concerns* to research + planning + reflection. It uses primarily what the person **explicitly
states**, with fact/preference/inference kept distinct. For credible interest exploration FADI may
integrate a recognised instrument (e.g. **O*NET Interest Profiler**, freely available) rather than a
proprietary personality score. **Prohibited:** fabricated precision such as "83% potential to be a
security analyst", any happiness/psychological score, or presenting model-generated clinical/legal
exercises as accredited training or professional advice.

**Onboarding is a conversation, not an exam** (MVP includes a warm voice/text career companion over
these typed contracts). Only the immediate goal is required; background, interests, constraints,
confidence, intuition and interaction preference are optional and progressive. The agent is always
clearly an AI and never claims human feelings or experiences it cannot have. Consequential facts are
confirmed with a summary before being saved.

**Safeguards (enforced):** no diagnoses/scoring/hidden profiling; no guilt streaks, rankings or
fear-based retention; no mandatory emotional disclosure; no auto plan change from inferred emotion;
sensitive reflections are private, optional, editable, exportable and deletable *independently* of
career records; reflections never reach employers/external services without specific consent.

**Starting modes (Decision 5):** **Explore** (uncertain — use research/exploration), **Pursue** (has
an objective — wants a plan), **Maintain** (established — growth/occasional guidance). Not rigid
categories; a person moves between them. The composer uses a plan when one exists but does **not**
require a completed Plan A/B/C before showing useful capabilities.

## 8. The Career Outcome Contract

Personalisation must not become endless feature-rearranging. Every activated capability declares:
which goal/preference it serves, what outcome it supports, what evidence shows progress, what it
costs (time/attention/money), and when to review/pause/retire. Not every feature needs a measurable
employment outcome (a reflection space may exist "because it helps me think") — but the system must
know **why** a feature exists, rather than creating UI because the AI can.

## 9. Contracts

### 9.1 Capability manifest (versioned, server-validated)

Illustrative, not a claim of current implementation. Validated by schema; permission rules enforced
**server-side**; `ui.template` and `execution` reference only **approved** renderers/adapters.

```ts
type CapabilityManifest = {
  id: string; version: string; schemaVersion: number;
  category: "learning" | "career" | "research" | "reflection" | "custom";
  title: string;
  inputs:  { schemaRef: string; optionalContext: string[] };
  outputs: { schemaRef: string; evidenceTypes: string[] };          // evidence admitted via the 0015 gate
  dependencies: { capabilities: string[]; adapters: string[] };     // 0014 adapter kinds
  permissions:  { required: string[]; optional: string[] };         // enforced by the kernel, never self-granted
  execution: { mode: "manual" | "scheduled" | "event_driven"; maxRunsPerDay?: number; requiresApproval: boolean };
  resources: { maxAiCallsPerRun?: number; externalCostAllowed: false };
  lifecycle: { dataRetention: "user_controlled"; supportsPause: true; supportsExport: true; supportsRemoval: true };
  ui: { template: "tracker" | "form" | "timeline" | "workspace"; config: Record<string, unknown> };
  outcome: { servesGoalOrPreference: string; intendedOutcome: string; progressEvidence: string[]; reviewOn?: string };
};
```

The AI constructs e.g. a certification tracker from **trusted primitives**; it ships no new browser
JavaScript.

### 9.2 Human-alignment data contracts

Reuse existing event/situation/evidence infrastructure. Each record carries `source`
(`user_stated | assessment_result | ai_suggested`), `timestamp`, `provenance`, `userVisibility`,
`consentScope`, `retentionPolicy`.

- `CareerPreference` — values, interests, interaction preferences, priorities.
- `CareerReflection` — self-expressed satisfaction, doubts, confidence, workload concerns, optional notes.
- `ConcernHypothesis` — intuitions, unresolved questions, alternative career ideas.
- `AlignmentReview` — a proposed `continue | pause | adjust | explore | reconsider` decision, its
  rationale and approval status. **No universal psychological/happiness score.**

### 9.3 Capability → workspace rendering contract (SHARED — Codex owns the UI shell)

A stub to agree **before either side implements**: how an installed capability declares its surface
into Codex's single work surface (ADR 0013) — one current outcome, one next action, the working
surface, help on demand, one completion review. Advanced controls live with the adapter and appear
only when the next action needs them. Voice/text/direct controls use the same work item and
capability policy. Without this agreed first, Claude could build an extensibility engine Codex's UI
can't render cleanly.

## 10. Threat model (summary)

- A manifest **cannot** escalate: Gmail/filesystem/network permissions are kernel-granted, never
  self-asserted; the composer can't approve its own permissions.
- Cross-tenant/cross-capability isolation: one user's config and private context never leak into
  another's workspace; a capability reads another's private data only with explicit user authorisation.
- Untrusted content stays data (ADR 0015 §2.5); generated features are declarative (Levels 1–3);
  Level-4 code is sandboxed + reviewed.
- No silent paid operations; budgets enforced server-side.
- Evidence integrity: neither user nor AI can rewrite verified evidence to fake success.
- Higher-risk domains (medical/legal) get stronger verification and governance; model-generated
  exercises are never presented as accredited/verified competence.

## 11. Acceptance tests (must pass before broad migration)

1. A cybersecurity user disables Practice and keeps using FADI normally.
2. A healthcare user builds a learning workspace with no Docker/security assumptions.
3. A user refuses the AI's proposed capability; the system respects it.
4. A user changes Plan A but keeps manually chosen workspace features.
5. Removing Portfolio preserves career evidence.
6. An AI-generated workflow cannot gain Gmail/filesystem/network permissions via its manifest.
7. The same generated workflow can be previewed, exported and restored.
8. An older capability version doesn't corrupt data on upgrade.
9. A background capability stops executing when paused.
10. A user with no AI model configured still accesses records and operates existing tools.
11. Medical/legal practice assessments cannot silently claim professional accreditation.
12. One user's capability config and private context never leak to another user.
13. **(Alignment)** Ambiguous dissatisfaction is clarified by asking, not inferred from behaviour.
14. **(Alignment)** A user requests "talk it through, no plan change" and no plan changes.
15. **(Alignment)** An intuition (AWS) is recorded and offered as a reversible, time-boxed exploration
    without abandoning the approved plan.
16. **(Alignment)** Declining a check-in records no conclusion; check-ins can be turned fully off.
17. **(Alignment)** No psychological diagnosis/score is produced; no fear/guilt mechanics exist.

## 12. Phased implementation (modular monolith; reuse, don't duplicate)

Keep Next.js/PostgreSQL + existing permission, outbox/worker, evidence, event and practice
foundations. No microservices. Use the existing outbox/worker for composition jobs (give it a single
always-running worker process; do **not** build a second scheduler). Feature-flag context may
reference OpenFeature's evaluation-context shape, but flags alone are insufficient — durable
capability instances, permissions, user state and data lifecycle are required.

| Phase | Deliverable | Owner |
|---|---|---|
| 0 Stabilise | Verify ADRs/branches/migrations/tests; reconcile worker 0072 / eval 0073 / fetch candidate with main | Claude + Codex |
| 1 Architecture | This ADR; capability schema; lifecycle, permission & UI rendering contracts | Claude (Codex reviews) |
| 2 User control | Capability settings; activate/pause/hide/archive; workspace layout prefs | Codex |
| 3 First composition | Convert Learning/Practice into a configurable capability; add a general tracker | Claude + Codex |
| 4 Adaptive composition | AI drafts workspace changes from goals/feedback; user approves | Claude |
| 5 Extensibility | Community declarative capabilities; versioning; portability | Later |
| 6 Advanced evolution | Isolated generation/testing of genuinely new feature code (Level 4) | Research-stage |

**First proof (MVP target):** *two users, completely different careers, completely different
workspaces — same FADI kernel, zero profession-specific branching in core*, plus an optional
voice/text onboarding+reflection companion over the §9.2 contracts. That proof is worth more than an
agent generating a pretty dashboard.

## Consequences, risks, alternatives

**Consequences:** one domain-neutral foundation; users own their application and their data;
capabilities are safe to install/evolve/remove; the human stays in the loop emotionally as well as
factually.
**Risks:** composition sprawl (mitigated by the Career Outcome Contract); over-reach of the alignment
features into pseudo-therapy (mitigated by the Human Support Boundary + safeguards); contract drift
between the capability engine and Codex's UI (mitigated by agreeing §9.3 first); scope before the
owner's milestones.
**Rejected:** a microservices rewrite; arbitrary AI runtime code execution; satisfaction as a
maximised metric; a universal psychological/“fit” score; a second agent scheduler.

## What is NOT decided here

No migration number reserved; no runtime merged to main; the §9.3 rendering contract and the
ADR 0015 Reflect-stage amendment require Codex + owner sign-off before implementation.
