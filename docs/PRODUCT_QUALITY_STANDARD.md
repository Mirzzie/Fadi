# Industry product quality and growth standard

**Status:** Current assessment and target standard

**Updated:** 5 October 2026

**Applies to:** Fadi as a consumer career platform and any later employer, university or
workforce edition

## Verdict

Fadi has a credible open-source product thesis and valuable technical foundations. It is an
advanced alpha, not yet a dependable public product.

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

The strongest initial user is a technically oriented career changer or job seeker who wants to
turn real work and practical labs into trustworthy applications, interview preparation and a
public portfolio. The current claim that Fadi works for **any career** is ahead of the product:
its deepest learning, lab, evidence and market paths are in IT, cloud, security and software.

That potential is held back by unfinished core loops, unreliable external data and insufficient
release evidence. A large feature count does not compensate for a user being unable to trust a
job result, understand the next action, finish a project once, or know what Fadi changed.

## Current product position

| Area                  | Position                   | Evidence and blocking gap                                                                                                                                                                                                                           |
| --------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product thesis        | Strong                     | The canonical career record, work kernel, labs and projections form a defensible closed loop. The loop is not fully automatic or reliable end to end.                                                                                               |
| Architecture          | Emerging                   | A modular monolith, scoped repositories and domain services are appropriate at this stage. Cross-domain delivery, background work and provider operations still need durable execution.                                                             |
| Data integrity        | Emerging                   | Sources, record history, selections and projection links exist. Legacy reconciliation, stable portfolio identity and external-CV round trips remain open.                                                                                           |
| Security              | Blocked for public release | Authentication, ownership scoping, approval gates and redacted logging exist. There is no current ASVS evidence, independent penetration test, vulnerability disclosure process, production key-management proof or incident exercise.              |
| Privacy               | Blocked for public release | Data classification and deletion intent are documented. There is no completed processing inventory, retention schedule, DPIA where required, subprocessor register, or tested export/deletion evidence for every store.                             |
| Reliability           | Blocked                    | CI runs typecheck, lint, tests, migrations, build and route smoke tests. No production SLOs, telemetry coverage, capacity results, backup restore drill, RTO/RPO or incident runbooks are demonstrated.                                             |
| AI governance         | Emerging                   | Model routing, structured outputs, consent and some domain evaluations exist. There is no complete model/prompt register, risk classification, adversarial evaluation gate, drift process or human-override evidence across every agent capability. |
| Supply chain          | Blocked                    | Dependencies are locked, but several runtime images use mutable tags. There is no SBOM, signed provenance, image/dependency scan gate or licence inventory in the release evidence.                                                                 |
| Accessibility         | Unknown                    | No WCAG 2.2 AA audit or automated/manual release gate is recorded.                                                                                                                                                                                  |
| Open-source readiness | Emerging                   | Setup, contribution and coding documents exist. The project still needs release signing, a vulnerability policy, maintainer/governance rules, supported-version policy and reproducible release evidence.                                           |
| Adoption evidence     | Unknown                    | There is no measured activation, task completion, retention, successful application, learning completion or contributor health baseline.                                                                                                            |

On 5 October 2026 a clean install of the committed lockfile reported 28 production dependency
findings: 1 critical, 17 high, 8 moderate and 2 low. The direct affected packages included Next.js
and Better Auth. This blocks a public release until the direct upgrades are tested and the
remaining reachable findings are triaged. It is a measured result, not a claim that every
transitive advisory is exploitable in Fadi.

## Claims audit

| Visible claim                               | Judgement                           | Required wording or exit condition                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “AI operating system for a person's career” | Directionally credible              | Keep as the vision. The product must complete one goal across data, action, proof and outcome without manual relay.                                                                |
| “Always-present intelligent environment”    | Overstated                          | Say “work-scoped assistant” until voice, text, UI, tools, approvals and receipts share one durable session everywhere.                                                             |
| “For any career”                            | Unsupported                         | Lead with technical career changers. Expand only after non-technical directions have real sources, plans, examples and usability evidence.                                         |
| “One truthful history”                      | Emerging                            | Source preservation, canonical facts and projections exist; external-CV reconciliation and legacy identity repair must close.                                                      |
| “Find the right opportunities”              | Unproven                            | Publish source health, coverage, freshness, duplicate rate and failed-query diagnostics. Do not present thin results as the market.                                                |
| “Live voice”                                | Partial                             | Local turn-taking and interview voice exist. Call it live only when interruption, pause handling, transcript continuity, recovery and shared action context pass end-to-end tests. |
| “Hands-on learning and labs”                | Useful but narrow                   | State the supported templates and host requirements. A plan must run in its target, capture proof and finish through one outcome path.                                             |
| “Honest AI”                                 | Good doctrine, incomplete assurance | Every high-impact capability needs a dated evaluation, critical-failure gate, source/provenance display and correction path.                                                       |

## Will people use it?

Some will, if Fadi becomes excellent for one painful journey before broadening. The clearest
early-adopter profile is:

- changing into or progressing through IT, cloud, security, DevOps or software roles;
- has experience scattered across CVs, labs, courses and projects;
- wants local control and is willing to connect an AI provider;
- needs to decide what to do next and convert completed work into credible proof.

That user has a real reason to choose Fadi over a resume editor or job tracker: Fadi can create
the missing proof, not only rewrite the claim. Most ordinary job seekers will currently leave
during setup, data reconciliation or a crowded specialist screen before they feel that value.

The activation test should be achievable in fifteen minutes with sample or imported data:

1. state one goal;
2. import and review a trustworthy career record;
3. receive one explained next action;
4. complete or preview that action;
5. see exactly what changed and how to undo or correct it.

If a new user cannot do that without reading architecture concepts, the product is not ready for
growth regardless of how many features exist.

## UI and UX judgement

The four destinations—Today, Opportunities, Practice and My career—are the right top-level model.
Today's four questions are the strongest design decision: goal, next action, what Fadi did and
what needs a decision. Every other screen should follow it.

Current friction remains:

- **Opportunities:** the role workspace is becoming stage-aware, but fit, documents, reviews,
  company context, interview and outcome are still separate panels. Show one primary action for
  the current stage, one compact status strip and an expandable “Everything for this role”.
- **Practice:** the page now chooses Continue and Recommended, but commitments, gaps, routes,
  blueprints and project runs remain different underlying concepts. The user should see Now,
  Plan and Completed; internal object names must not leak into choices.
- **My career:** canonical facts, alternate wording, per-direction selection, documents and
  portfolio projections are powerful but cognitively expensive. Default to Fadi's explained
  recommendation and ask only on a real conflict. Put variants and provenance in “History and
  sources”.
- **Machines and permissions:** these are an advanced control plane. Show machine status and an
  approval only when a task needs them; keep raw capabilities, denials and audit events under
  Advanced.
- **Voice:** the orb should continue the visible task, not open a second product. Listening,
  thinking, speaking, proposed action and interruption must be visible and keyboard accessible.

Use progressive disclosure as a system rule:

1. one plain-language goal or state;
2. one recommended action;
3. up to two alternatives when the decision is meaningful;
4. reasons, provenance and diagnostics on demand;
5. infrastructure only in Advanced or at the moment it is required.

No primary screen should require a person to understand “evidence pool”, “canonical”, “rendering”,
“commitment”, “work item”, “capability grant” or “projection”. Those are architecture terms.

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

## Industry-grade engineering gates

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

### After evidence — choose the sustainable project model

- **Free local-first core:** keep career records, labs, documents and export usable without a
  hosted account or proprietary service.
- **Optional hosted service:** only if maintainers want it, offer sync, managed providers and
  convenience without weakening the open-source core.
- **Community ecosystem:** versioned project/lab packs, provider adapters and career-direction
  packs with compatibility tests and maintainers.
- **Institution edition:** only after demand is proven, add organization tenancy, SSO, admin and
  support rather than burdening the personal product now.
- **Employer-side intelligence:** treat as a separate regulated product and governance program.

## Open-source release evidence

A user or contributor should be able to inspect, without relying on a verbal claim:

- product strategy, user research, activation/retention and outcome metrics;
- system, deployment, trust-boundary and data-flow diagrams plus current ADRs;
- repository ownership, IP assignments, third-party licences and dependency inventory;
- threat models, ASVS matrix, vulnerability history, penetration report and incident record;
- privacy processing inventory, subprocessors, retention/deletion/export tests and legal terms;
- AI capability/model/prompt registers, evaluation reports and production drift reports;
- SLO dashboards, incident reviews, capacity results, backup and restore evidence;
- CI/CD controls, SBOMs, signed artifacts, provenance and deployment history;
- test strategy, flaky-test register, accessibility report and supported-platform matrix;
- roadmap with named owners, provider concentration and known technical debt;
- `SECURITY.md`, supported versions, governance, maintainer and release process, contributor
  guide and code of conduct;
- an [OpenSSF Scorecard](https://scorecard.dev/) baseline and progress toward the
  [OpenSSF Best Practices badge](https://www.bestpractices.dev/en), without using either as a
  substitute for threat modelling or testing;
- project-health metrics based on the [CHAOSS metrics](https://chaoss.community/kb-metrics-and-metrics-models/):
  active contributors, response time, issue age, review latency and release frequency.

## Growth design

Growth should come from user outcomes and useful open-source artifacts:

- a completed project can export a high-quality public case study and optional “Built with Fadi”
  attribution;
- versioned lab and direction packs let contributors add current market paths without changing
  the core product;
- importers and browser capture reduce switching cost from other resume and job tools;
- a public compatibility matrix and evaluation reports make Fadi trustworthy to recommend;
- privacy-preserving templates and sample data let someone experience value before importing
  personal information.

Track activation, time to first useful action, completion rate, correction rate, job-source
success, lab-check success, interview-session completion, weekly return while a goal is active,
export/share completion and self-reported career outcomes. Do not optimize chat volume, generated
documents, streaks or notifications.

## Definition of ready

Fadi is ready for a stable public release when it can demonstrate the full product loop on
production-like infrastructure, meet its stated SLOs for a measured period, restore and delete
data on demand, pass independent security and accessibility reviews, reproduce each release from
an attested build, and show that real users complete the core journey. Until then, describe it as
an open-source alpha under active hardening, not as universally capable, production-ready or
certified.
