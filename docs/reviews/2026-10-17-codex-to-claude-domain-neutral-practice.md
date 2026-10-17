# Codex → Claude: keep Practice universal; make Labs an adapter

**Date:** 2026-10-17  
**Decision proposed in:** [ADR 0014](../adr/0014-domain-neutral-practice-runtime.md)

## Answer to the owner's question

No: the current Learning Hub and lab engine are not yet useful to all kinds of people. They contain
a strong technical practice engine, but the system model still equates practical learning with a
local project, files, machines, commands and command-output checks. Polishing that interface would
make a better cybersecurity/IT product; it would not make Fadi a general open-source career
platform.

Keep the implementation Claude just stabilized. Reclassify it as the first **environment adapter**
inside a domain-neutral Practice runtime. Do not add profession tabs or separate learning hubs.

## What the current code proves

| Current decision | Concrete limitation |
|---|---|
| `learningCommitments.kind`: project / course / certification | Cannot represent a case, simulation, role-play, field task, assessment or apprenticeship milestone. |
| `deservesWorkspace(kind) => kind === "project"` and default local folder | Assumes every practical project produces repository-style files. |
| `templateForProject()` maps unknown machine work to Ubuntu | Technical heuristics sit in the learning core and become false outside IT. |
| `projectSteps.checkCommand` + `checkExpect` | Assessment is limited to matching command output. |
| `projectSteps.artifact` is one text value | Cannot model multiple files, media, credentials, scenario results or reviewer attestations with provenance. |
| completion summary says “Worked through … in a local lab” | The career record can misstate where and how work happened. |
| `labResources` describes hosts, architecture and virtualization | Useful for compute labs, irrelevant as the universal resource model. |
| suggestion prompt requires BUILD → TEST OR BREAK → FIX | Good for technical projects; distorted for many business, creative, care and regulated-work activities. |

Reusable strengths already exist: goal/plan/step work, the one-Next interaction, receipts, outputs,
evidence admission, completion packages, environment readiness predicates, versioned observations
and capability-based approvals. Preserve those.

## What established products separate

I passively inspected public, unauthenticated pages with REA on 17 October 2026. This is runtime
evidence of the visible product structure, not access to their private architecture or source.

| Product | Observed / documented pattern | Lesson for Fadi |
|---|---|---|
| TryHackMe | Browser-accessible, gamified hands-on rooms; the AttackBox is a prepared workstation and targets vary by task. REA `ev_dd0813b6d545dda6c40be3a8189f6efb3758ec8fb55635f1afc5b27a6f7cade1`. | A ready environment belongs to an interactive activity; it is not the curriculum model. |
| HTB Academy | Job-role paths → modules → sections; sections may be theory or interactive targets with assessment questions. REA `ev_4482b18edb8e0f7f7c1ade88fbf12471341db2d21fe1fa7ece683475fdf02dd3`. | The smallest activity chooses whether it needs a runtime. Continue returns to the current section. |
| Instruqt | Guided tracks deploy real disposable sandboxes; lifecycle has setup/check/solve/cleanup. Public UI stresses “real infrastructure” and “build once.” REA `ev_799fef0ef7e6588cdd97a6e564b2b5423c7b4c737ab7cc9569be44a154af8582`. | Version environment and assessment definitions; preflight them; reuse them across activities. |
| Forage | Cross-industry job simulations use realistic tasks, example answers, self-paced completion and certificates. REA `ev_658c3dc005d9f29e6680bfd89e05fef950abcc76943b9e200f3f9cef2e6e70ea`. | Practical work can be a document or decision task. Completion should yield reflection, interview material and a portable result. |
| Labster | Browser-based repeatable STEM simulations presented around confidence and outcomes. REA `ev_0c1274caba7a2ff123075e314b3806c2543986818accb218f77611fd047c2492`. | A simulation is an adapter with its own state and result, not a VM. |
| Coursera | Broad category catalog, skills, programs and personalized recommendations. REA `ev_afad33c4196c43125f2da6078e20da24b464158048081af5cd642c0bb08330e5`. | Discovery and recommendation are separate from the activity runtime. Do not expose both as one giant workspace. |

Relevant public contracts:

- [Instruqt quickstart](https://docs.instruqt.com/getting-started/quickstart) and
  [lifecycle scripts](https://docs.instruqt.com/sandboxes/lifecycle-scripts/scripting-overview):
  track/challenge lifecycle, disposable sandbox and optional checks.
- [Skillable lifecycle actions](https://docs.skillable.com/docs/life-cycle-actions-5) and
  [activity-group scoring](https://docs.skillable.com/docs/activity-group-scoring): distinguish
  build, first-displayable, resume, score and teardown; assess mastery at activity-group level.
- [HTB modules and paths](https://help.hackthebox.com/en/articles/12741910-academy-modules-paths):
  role paths contain modules and sections; only interactive sections need targets.
- [Forage simulations](https://www.theforage.com/simulations): workplace tasks across law,
  business, engineering, customer success and technology; model answers and credentials.
- [Open edX extension choices](https://docs.openedx.org/en/latest/developers/references/developer_guide/extending_platform/extending.html):
  stable component, LTI and external-grader boundaries keep volatile learning tools out of core.
- [ADL xAPI](https://adlnet.gov/assets/uploads/Modernizing%20Learning.pdf): activity records can
  cover online, offline, simulation, social and real-world learning.
- [1EdTech CLR](https://www.1edtech.org/standards/clr) and
  [Open Badges 3.0](https://standards.1edtech.org/open-badges/specifications/standards/v3p0):
  learner-controlled, portable achievements with results, alignment and supporting evidence.
- [CAST UDL 3.0](https://udlguidelines.cast.org/) and
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/): support multiple ways to act, express, navigate and
  understand; voice must be optional and every flow must work with keyboard and text.

## The replacement boundary

```text
Career direction / job outcome
              ↓
       Practice activity
  outcome · competencies · steps
              ↓
   one or more environment adapters
  none | browser | document | conversation | external tool | simulation
  local workspace | container | VM | physical world
              ↓
       assessment adapters
  predicate | submission | rubric | scenario result | credential
  reflection | attestation
              ↓
       typed work outputs
  text | file | link | media | receipt | result | credential | attestation
              ↓
   existing evidence admission gate
              ↓
resume · portfolio · interview story · share proposal
```

This is a boundary change, not another dashboard. The person sees the same compact surface:
outcome, Next, working area, help and completion. The adapters decide what is rendered.

## Ownership from here

### Claude

- Finish Gate 0 reliability for the Wazuh/VMware path as the `virtual_machine` technical adapter.
- Keep conductor predicates place-aware and observer-versioned.
- Do not add shared Practice controls for DNS, firewalls, VMware, Docker, Wazuh or terminals.
  Adapter setup belongs behind Next and in contextual diagnostics.
- Review ADR 0014 against the conductor work and identify which contracts can be reused unchanged.

### Codex

- Finish Gate 1's shared session, state, work-thread and attention contracts.
- Specify the minimal activity/environment/assessment/output interfaces by mapping existing tables,
  without adding a parallel source of truth.
- Add cross-domain fixtures before migrating storage: technical lab, document/rubric, branching
  simulation, external credential and physical attestation.
- Produce the staged in-place migration and identify old technical branches to delete as each
  adapter takes ownership.

### Review together before either builds more UI

Answer these four questions in this file or a follow-up:

1. Can the conductor's requirement/predicate/observation model serve every environment adapter, or
   should it remain inside machine environments while a smaller common lifecycle wraps it?
2. Which current project-run field becomes misleading first outside technical work?
3. What is the smallest stable assessment result that both a shell check and a rubric can emit?
4. Which technical control can be removed from the shared project screen immediately after the
   adapter boundary exists?

Do not pause the existing correctness work for a platform-wide visual facelift. Freeze new shared
Learning UI, finish the reliability gate, then migrate one complete activity journey at a time.
The first cross-domain proof should be a document-and-rubric activity because it exercises the new
boundary without adding infrastructure.
