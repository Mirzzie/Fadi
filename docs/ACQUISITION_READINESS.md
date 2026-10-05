# Acquisition readiness

**Status:** Target standard and evidence plan

**Updated:** 5 October 2026

**Applies to:** Fadi as a consumer career platform and any later employer, university or
workforce edition

## Verdict

Fadi has an acquirable product thesis and valuable technical assets. It is not yet an
acquisition-grade product.

The valuable thesis is a proof-backed career operating system: one career record feeds job
decisions, practical learning, verified lab work, documents, interview preparation, portfolio
publishing and outcome learning. Current products commonly cover only parts of that path:
[Teal](https://www.tealhq.com/how-it-works) combines job tracking and career documents,
[Huntr](https://help.huntr.co/en/articles/12824077-understanding-huntr-s-resume-builder)
separates base and tailored resumes,
[Simplify](https://help.simplify.jobs/help/articles/2415391-using-copilot-to-autofill-applications)
focuses on application autofill and tracking, and
[Final Round AI](https://docs.finalroundai.com/docs/core-concepts/turn-gate) focuses on live
interview assistance. Fadi can differentiate by closing the loop from a market goal to proven
work and then to a truthful application and public presence.

That potential is currently held back by unfinished core loops and missing evidence that an
acquirer needs to trust the code, data, operations and legal boundary. A large feature count
does not compensate for these gaps.

## Current diligence position

| Area | Position | Evidence and blocking gap |
|---|---|---|
| Product thesis | Strong | The canonical career record, work kernel, labs and projections form a defensible closed loop. The loop is not fully automatic or reliable end to end. |
| Architecture | Emerging | A modular monolith, scoped repositories and domain services are appropriate at this stage. Cross-domain delivery, background work and provider operations still need durable execution. |
| Data integrity | Emerging | Sources, record history, selections and projection links exist. Legacy reconciliation, stable portfolio identity and external-CV round trips remain open. |
| Security | Blocked for scale | Authentication, ownership scoping, approval gates and redacted logging exist. There is no current ASVS evidence, independent penetration test, vulnerability disclosure process, production key-management proof or incident exercise. |
| Privacy | Blocked for scale | Data classification and deletion intent are documented. There is no completed processing inventory, retention schedule, DPIA where required, subprocessor register, or tested export/deletion evidence for every store. |
| Reliability | Blocked | CI runs typecheck, lint, tests, migrations, build and route smoke tests. No production SLOs, telemetry coverage, capacity results, backup restore drill, RTO/RPO or incident runbooks are demonstrated. |
| AI governance | Emerging | Model routing, structured outputs, consent and some domain evaluations exist. There is no complete model/prompt register, risk classification, adversarial evaluation gate, drift process or human-override evidence across every agent capability. |
| Supply chain | Blocked | Dependencies are locked, but several runtime images use mutable tags. There is no SBOM, signed provenance, image/dependency scan gate or licence inventory in the release evidence. |
| Accessibility | Unknown | No WCAG 2.2 AA audit or automated/manual release gate is recorded. |
| Enterprise readiness | Not started | No demonstrated organization tenancy, SSO/SAML, SCIM, RBAC, admin controls, contractual audit export, entitlements, support operation or SLA. These are unnecessary for the personal product until a B2B edition is chosen. |
| Commercial evidence | Unknown | No acquisition data room currently demonstrates retention, activation, successful applications, learning completion, unit economics or willingness to pay. |

## Product boundary

Fadi should remain a candidate-side system that acts for the person. If a future edition scores,
filters or recommends candidates for an employer, it crosses a materially different legal and
ethical boundary. The EU AI Act lists certain employment and worker-management systems as
high-risk; that edition would need its own risk management, data governance, logs, testing,
human oversight and conformity work. See the
[EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689).

The personal edition must still follow privacy by design and data minimisation because resumes,
applications, recordings and inferred career preferences are sensitive personal data. See the
[European Commission's GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en).

## Acquisition-grade engineering gates

### 1. Security and privacy gate

Release evidence must include:

- an asset and data-flow inventory with owner, classification, purpose, processor, region,
  retention and deletion path for each data class;
- threat models for authentication, career imports, portfolio publishing, agent tools, machine
  access, labs, voice, A2A/MCP and external URL retrieval;
- an [OWASP ASVS](https://owasp.org/projects/asvs/) control matrix with automated evidence where
  possible, plus an independent penetration test and tracked remediation;
- tenant-isolation tests for every repository and route, even while the product is single-user;
- secrets in managed key storage, rotation evidence and separate production/staging access;
- verified account export and deletion across PostgreSQL, object/media stores, logs, caches,
  vector/search stores, model-provider retention and published copies;
- a subprocessor register, privacy notice, terms, vulnerability disclosure policy, incident
  response plan and one tabletop exercise.

### 2. AI and agent governance gate

Use the [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework),
its generative-AI profile and [OWASP guidance for LLM and agentic applications](https://genai.owasp.org/initiative/owasp-top-10-for-llm-and-genai/)
as control baselines. Each capability needs:

- a named owner, user purpose, models/providers, data sent, prompt/schema version and permitted
  tools;
- a risk class and explicit human-control boundary;
- representative quality, hallucination, bias, prompt-injection, data-exfiltration and excessive
  agency evaluations;
- a minimum score and critical-failure rule that blocks release;
- production sampling with privacy-safe metrics, drift review and rollback;
- inspectable receipts and a user path to correct, reject, stop and forget.

The lab-plan evaluation introduced on 5 October 2026 is the first implementation of this model:
dated cases, a scored rubric and critical failures. Apply the same pattern to job matching,
career-record reconciliation, truth checking, interview feedback and agent tool selection.

### 3. Reliability and operability gate

- Define user-facing SLIs and SLOs for sign-in, Today, job search, document generation, agent
  actions, lab start/check, voice turns and publishing. Follow a measured error-budget policy;
  Google's reliability guidance explains why SLOs must reflect user-visible reliability:
  [Choose SLOs](https://cloud.google.com/architecture/framework/reliability/choose-slos).
- Instrument requests, queues, model calls, provider calls and lab operations with correlated
  traces, metrics and structured logs using a vendor-neutral standard such as
  [OpenTelemetry](https://opentelemetry.io/docs/concepts/observability-primer/).
- Establish staging and production environments, health/readiness checks, capacity and load
  tests, on-call ownership and incident runbooks.
- Set RTO/RPO, automate backups and prove a restore in a clean environment at least quarterly.
- Move required cross-domain work to a transactional outbox with idempotent consumers. Persist
  external operations with retry, timeout, cancellation and reconciliation states.

### 4. Software supply-chain gate

- Pin production container images by digest and use a dated refresh process. Remove mutable
  `latest` tags from deployable configuration.
- Generate an SPDX or CycloneDX SBOM for every release, scan dependencies and images, review
  licences and block known exploitable critical vulnerabilities.
- Sign release artifacts and attach build provenance. Target the controls in
  [SLSA 1.2](https://slsa.dev/spec/v1.2/) incrementally rather than claiming a level before the
  evidence exists.
- Protect the main branch, require reviewed CI, restrict release credentials and keep an auditable
  deployment record.

### 5. Product-quality gate

- Test critical paths in a signed-in production-like environment with realistic data and failure
  injection, including resume import, source conflict, job discovery, application, interview,
  learning/lab completion, proof capture, portfolio sync, sharing, export and deletion.
- Meet [WCAG 2.2 AA](https://www.w3.org/WAI/news/2023-10-05/wcag22rec/) with automated checks,
  keyboard/screen-reader testing and disabled/slow-network states.
- Measure time to first useful action, task completion, recovery from failure and user correction.
  Do not optimize generated-content volume or engagement loops that do not improve career outcomes.

## Product completeness required for the thesis

These are the smallest coherent capabilities; they are not invitations to add more menus.

1. **Trusted career core.** Import external sources, preserve them, reconcile candidate facts,
   keep provenance and history, and render different directions without cloning facts.
2. **Reliable opportunity engine.** Report source health and coverage, normalize and deduplicate
   roles, verify liveness, explain ranking and capture the application outcome. Browser autofill
   must preview every field and never submit autonomously.
3. **One application workspace.** Show the role decision, next action, selected evidence,
   materials, interview practice, contacts and outcome as stages of one work item. Advanced
   diagnostics stay out of the primary flow.
4. **Practice that produces proof.** Recommend a current problem, create a safe reproducible lab,
   validate the plan in the actual target, capture checks and artifacts, and create one reviewed
   completion package.
5. **Human interview practice.** Use the job and career record, sustain interruptible voice turns,
   distinguish measured audio features from transcript inference, save the session and turn weak
   results into specific practice work.
6. **Projection and distribution.** Resume, portfolio, interview story and social variants link to
   the same approved fact. Publishing has separate consent, preview, idempotency, revocation and a
   receipt.
7. **Outcome learning.** Application, interview and publishing outcomes update recommendations
   transparently. The person can inspect and correct the preference or inference.

## Delivery sequence

### Days 0–30 — make claims auditable

- Stop adding isolated feature models or primary navigation.
- Create the security/privacy/AI registers and owners.
- Add SBOM, dependency/image scanning, secret scanning and accessibility smoke checks to CI.
- Pin deployable images and record their update policy.
- Define the first SLOs and instrument the five most important user journeys.
- Make production backup/restore and export/deletion tests pass.

### Days 31–60 — make the core loop reliable

- Close career reconciliation and portfolio identity defects.
- Add job-source health, traceable dedupe and honest zero-result diagnostics.
- Finish the one Practice completion path and transactional outcome handoff.
- Complete lab stacks, target validation, automatic proof and lifecycle cleanup.
- Persist interview sessions and connect results to practice work.

### Days 61–90 — prove the product

- Run an invited cohort through the full choose → apply/practise → prove → share → learn loop.
- Measure activation, successful task completion, weekly return for an active goal, correction
  rate, provider failure, lab success, interview-session completion and user-reported outcome.
- Conduct penetration, accessibility and recovery exercises; close severe findings.
- Produce the first diligence room and a release candidate with known residual risks.

### After evidence — choose the commercial branch

- **Personal subscription:** reliable local/cloud operation, portability, privacy controls,
  browser extension, publishing connections and clear entitlements.
- **Institution/enterprise:** only after demand is proven, add organization tenancy, SSO/SAML,
  SCIM, RBAC, admin/audit export, regional controls, support and SLAs.
- **Employer-side intelligence:** treat as a separate regulated product and governance program.

## Acquisition data room

An acquirer should be able to inspect, without relying on a verbal claim:

- product strategy, user research, cohort/retention and outcome metrics;
- system, deployment, trust-boundary and data-flow diagrams plus current ADRs;
- repository ownership, IP assignments, third-party licences and dependency inventory;
- threat models, ASVS matrix, vulnerability history, penetration report and incident record;
- privacy processing inventory, subprocessors, retention/deletion/export tests and legal terms;
- AI capability/model/prompt registers, evaluation reports and production drift reports;
- SLO dashboards, incident reviews, capacity results, backup and restore evidence;
- CI/CD controls, SBOMs, signed artifacts, provenance and deployment history;
- test strategy, flaky-test register, accessibility report and supported-platform matrix;
- roadmap with named owners, cost model, provider concentration and known technical debt.

## Definition of ready

Fadi is ready for serious acquisition diligence when it can demonstrate the full product loop on
production-like infrastructure, meet its stated SLOs for a measured period, restore and delete
data on demand, pass independent security and accessibility reviews, reproduce each release from
an attested build, and show that users achieve outcomes that point tools do not. Until then,
describe it as a high-potential product under active hardening, not as enterprise-ready or
certified.
