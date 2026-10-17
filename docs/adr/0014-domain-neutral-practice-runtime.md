# ADR 0014: Domain-neutral practice runtime

**Status:** Proposed
**Date:** 2026-10-17

## Context

Fadi is open source and is intended to support a person's whole career. Its current practical
learning path grew from cybersecurity and infrastructure work. That produced useful capabilities:
ordered work, disposable machines, deterministic checks, approval before consequential changes,
receipts, evidence and a completion package. It also embedded one profession's delivery mechanism
into the learning model.

The coupling is visible in current code:

- `learningCommitments.kind` has only project, course and certification;
- committing to a project creates a local filesystem workspace;
- project placement chooses Docker, VMware or no machine from keywords and otherwise tends toward
  an Ubuntu lab;
- a step's observable check is a command plus expected output;
- completion text says work happened “in a local lab” even when it did not;
- resource inventory primarily describes compute hosts and hypervisors.

That can serve a technical homelab. It cannot honestly represent a designer producing a critique,
a nurse working through a branching patient case, a manager handling a simulated inbox, a lawyer
drafting advice, a salesperson role-playing a call, a trades learner doing supervised physical
work, or an external course that issues a credential.

Established products separate curriculum from the way practice is delivered. HTB has paths,
modules and sections, with a live target only for interactive sections. Forage uses workplace tasks,
example answers and completion credentials across many industries. Labster uses repeatable virtual
science simulations. Instruqt deploys a sandbox for a guided track and runs lifecycle checks.
Open edX keeps its core extensible through components, external graders and LTI tools. These are
different runtimes behind a similar learning journey.

## Decision

Fadi's product concept is **Practice**, not **Labs**. A lab is one environment adapter.

The durable journey remains the ADR 0013 work journey:

```text
Goal → Plan → Step → Execution → Receipt → Output → Evidence → Projection → Outcome
```

Practice adds four domain-neutral contracts to that journey:

1. **Activity definition** — the intended outcome, competencies, ordered steps, prerequisites,
   expected outputs, estimated effort and versioned source.
2. **Environment adapter** — prepares and observes the place where a step happens. Initial adapter
   kinds are `none`, `browser`, `document`, `conversation`, `external_tool`, `simulation`,
   `local_workspace`, `container`, `virtual_machine` and `physical_world`.
3. **Assessment adapter** — decides what can be established from the result. Initial kinds are
   `machine_predicate`, `submission`, `rubric`, `scenario_outcome`, `external_credential`,
   `reflection` and `attestation`. `unknown`, `observed`, `self_reported` and `verified` remain
   different states.
4. **Proof/output adapter** — records files, links, text, media, machine receipts, scenario results,
   credentials and supervisor attestations as typed outputs. Evidence is admitted from those
   outputs through the existing evidence gate; Practice does not become a second career record.

An activity may use several adapters. A marketing project can combine a document, a live website
and a presentation role-play. A cybersecurity project can combine a VM, a browser dashboard and a
written incident report. A course may require no environment and still yield a credential and a
reflection.

The learner UI remains one work surface:

- one current outcome;
- one next action;
- the working surface required for that action;
- help and explanation on demand;
- one completion review.

Environment selection, setup, checks and recovery stay behind that surface. Advanced controls live
with the adapter and appear only when the next action requires them. Voice, text and direct controls
use the same work item and capability policy.

The existing project-run tables will be migrated in place. We will not create a second generic
learning system beside them. During migration, old names may remain as storage details while domain
services expose the new contracts. New features must not branch directly on Docker, VMware or
cybersecurity terms outside an environment adapter.

Interoperability follows open standards at boundaries:

- use xAPI's actor–verb–object–result–context shape for portable activity events without requiring
  an LRS internally;
- use LTI 1.3 for launching compatible external learning tools and receiving outcomes when a real
  integration is added;
- use Open Badges 3.0 / CLR 2.0 for portable, learner-controlled achievement records;
- align competencies to external frameworks when confidence is high while preserving the person's
  own words and an explicit unmapped state.

## Alternatives considered

### Expand the current lab engine with more machine types

Rejected. Healthcare, law, design, sales and trades do not become supported by adding more
hypervisors. Their practice surfaces and proof types are different.

### Build separate learning hubs per profession

Rejected. It duplicates progress, completion, evidence, approvals and UI. Domain packs should
provide activities, competency mappings and adapters while the journey stays shared.

### Embed a complete LMS

Rejected for the core product. Open edX and Moodle solve course administration, enrolment and
institutional delivery; importing that whole model would reintroduce the navigation and
administration Fadi is simplifying. Standards-based adapters are a better boundary.

### Let the model invent environments and graders

Rejected. Models may propose an activity from current market context, but environment IDs,
assessment kinds, capabilities and executable checks must validate against versioned registries.
Unknown work is experimental until a reviewed adapter can prepare and assess it.

## Consequences

- Fadi can support practical learning across professions without pretending all work is a terminal.
- The current VM/container engine remains valuable as a technical adapter.
- A completed external activity can enter the same evidence and branding loop as an internal one.
- Domain packs become distributable open-source units instead of core-code forks.
- Existing `project_runs`, `project_steps`, workspace rules, shell checks and completion summaries
  require staged migration.
- Assessment strength must be shown honestly; self-report, rubric review, deterministic observation
  and third-party credential verification are not interchangeable.
- Physical-world activity needs clear limits: Fadi can guide and collect proof, but it cannot claim
  to have observed work it did not observe.

## Verification and review

Before acceptance, the same runtime must pass end-to-end fixtures for at least:

1. a container/VM cybersecurity project with deterministic checks;
2. a browser-and-document business task assessed with a rubric;
3. a branching healthcare-style simulation with critical-fail outcomes;
4. an external course that returns or imports a credential;
5. a physical or supervised task completed with media and attestation.

For every fixture, verify resume/portfolio evidence provenance, direction relevance, retry and
resume behavior, accessibility, data export and deletion. Run WCAG 2.2 AA checks and cognitive
walkthroughs. No fixture may add profession-specific controls to the shared Practice shell.

Research and observed product evidence are recorded in
`docs/reviews/2026-10-17-codex-to-claude-domain-neutral-practice.md`.
