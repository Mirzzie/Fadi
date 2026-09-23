# Fadi roadmap

**Status:** Current implementation sequence  
**Updated:** 23 September 2026

This roadmap orders work by user harm and architectural dependency. It is not a feature inventory.

## Landed foundation

- One work kernel for goals, plans, steps, executions, and outputs.
- Today as the primary surface.
- Four visible destinations.
- Work-scoped agent conversations.
- Per-turn capability routing.
- Required risk classification and effects for agent tools.
- Receipts for consequential tool calls and background work.
- Versioned career sources, canonical-record history, selections, and generation snapshots.

## Now: close correctness defects

1. Fix interview story matching so zero-relevance candidates return no match.
2. Rename transcript-only “delivery” feedback and remove claims that require audio measurements.
3. Finish legacy career-record repair and external-CV reconciliation without guessing historical meaning.
4. Put safe floors and explicit identity states around portfolio reconciliation; preserve media and intentional exclusions.
5. Measure job-source health, coverage, duplicates, freshness, and failed searches before expanding sources.

Exit condition: Fadi does not confidently present an irrelevant story, false delivery analysis, wrong career identity, duplicate portfolio projection, or silent empty search as trustworthy.

## Next: simplify Practice and completion

1. Replace Learning's overlapping paths, gaps, blueprints, and commitments with Now, Plan, and Completed.
2. Link project runs and interview practice to work items rather than creating parallel workflow models.
3. Create one outcome service for lab projects, courses, and external activities.
4. Replace manual machine relay with Check and continue where the environment is observable.
5. Produce one reviewed completion package for record, portfolio, résumé, interview story, and sharing.
6. Move Machines and Activity out of primary Practice navigation.

Exit condition: a person can start from Today, complete practical work, verify it once, and review every downstream update without navigating among subsystems.

## Then: make Fadi one live agent

1. Give voice the same work-scoped thread, context envelope, tools, approvals, and receipts as text.
2. Use a server-issued Realtime session over WebRTC with semantic turn detection and interruption.
3. Show live transcript, listening state, action proposals, and handoff between voice and UI.
4. Add a durable approval inbox available from every destination.
5. Add capability scopes, expiry, idempotency, reversibility, taint policy, and policy versioning.

Exit condition: voice, text, and UI can continue one task safely without repeating context.

## Then: durable cross-domain orchestration

1. Add a transactional outbox for cross-domain events that must survive a process crash.
2. Make consumers idempotent and observable.
3. Persist resumable external operations and provider cursors.
4. Add explicit compensation or retry policy for partially completed publication and machine work.

Exit condition: an accepted career outcome cannot disappear between evidence, portfolio, document, and publishing updates because a process restarted.

## Then: personal brand distribution

1. Build a campaign object from an approved career outcome.
2. Generate channel-specific variants from the same facts and media.
3. Keep copy/download/open-share as a reliable baseline.
4. Add social publishing connections with separate OAuth consent, encrypted tokens, scope health, revocation, scheduling, and receipts.
5. Add direct LinkedIn publishing only after its dedicated permission and review flow exist.

Exit condition: one truthful outcome can be reviewed and distributed without copy-paste drift or hidden publishing authority.

## Later

- Durable interview sessions, rubric snapshots, measured audio features, and longitudinal coaching.
- Additional hypervisors through a common provider contract after VMware end-to-end execution is proven.
- Browser consoles only when they materially improve a project flow.
- User memory and preferences with inspect, correct, forget, and expiry controls.
- Portfolio and résumé experiments measured against user outcomes, not generation volume.

## Explicit non-goals

- More top-level navigation.
- A new workflow table for each feature.
- Always-on microphones.
- Autonomous job applications or social posts without explicit user policy and consent.
- Cloning career facts for each direction.
- Scores without visible standards and evidence.
- A microservice split before the modular boundaries and workload require it.
