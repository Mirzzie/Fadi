# CareerOS System Architecture

## Architecture Intent

CareerOS is an agentic career operating system where Kai — the AI — is the entire product. The architecture supports persistent user memory, AI reasoning, proactive background workflows, real-time external data ingestion, explainable recommendations, and human approval for all external actions.

Kai is powered by a pluggable AI core. The architecture never assumes a specific model provider. Claude, GPT, Gemini, local models, or future agentic entities can be swapped into the model gateway layer without changing product behavior.

## System Principles

- **Kai-first**: there is no non-Kai part of the product. Every screen and workflow expresses Kai's intelligence.
- **Pluggable AI core**: the model powering Kai is a replaceable backend behind a model gateway abstraction.
- **User-controlled automation**: Kai may prepare actions autonomously, but sensitive external actions require explicit user approval.
- **Proactive and always-on**: Kai monitors opportunities, market shifts, and deadlines continuously — not only when the user is actively using the app.
- **Persistent memory**: user preferences, goals, progress, and outcomes improve future recommendations over time.
- **Explainability**: scores, rankings, and recommendations must include reasoning and evidence, especially when Kai challenges a user's direction.
- **Real-time grounding**: market intelligence, job discovery, and trend analysis must be grounded in current data from trusted sources, not static caches.
- **Honest-no-fake**: Kai never fabricates data, never hypes, never confirms what is not true.
- **Modular intelligence**: career analysis, job discovery, applications, learning, market intelligence, networking, and motivation are separable domains.
- **Compliance-aware**: personal data, employment history, profile information, and application activity must be treated as sensitive.

## High-Level Components

### Kai Interface Layer (Client Experience)

The user-facing application is Kai. There is no part of the UI that exists outside of Kai's operating context.

Interaction modes:

- Voice input and output (Phase 2, Browser Web Speech API)
- Text conversation and commands
- Action feed and approval queue
- Career command center surface
- Opportunity and intelligence cards
- Task queue and timeline
- Dynamic recommendation cards

### API Layer (Next.js Server Actions and Route Handlers)

The API layer exposes product capabilities to the Kai interface layer and coordinates authenticated access to user data, agent state, workflow status, documents, and integrations.

Core responsibilities:

- Authentication and session handling (Better Auth)
- User profile and identity management
- Career data access (Drizzle repositories)
- Agent task dispatch
- Recommendation retrieval
- Application workflow management
- Integration callbacks and webhooks

### Agent Orchestration Layer

The agent orchestration layer is the control plane for Kai. It interprets user intent, retrieves memory, selects tools, coordinates domain engines, requests approvals, executes approved actions, and writes auditable outcomes.

Core responsibilities:

- Classify user intent and system events
- Retrieve relevant user memory and career context
- Select the right engine or tool
- Produce plans with expected value and required approvals
- Execute safe steps; request approval for external actions
- Emit events for downstream analytics, memory updates, and recommendations
- Track task state and reasoning traces

### Intelligence Engines

The product is decomposed into major engines:

- **Career Intelligence Engine**: profile analysis, niche validation, readiness scoring, growth prescription
- **Job Discovery Engine**: job ingestion, normalization, matching, proactive monitoring
- **Application Automation Engine**: resume tailoring, cover letters, interview plans, approval-gated submission
- **Learning Intelligence Engine**: skill gap analysis, learning plans, proof-of-work scaffolding
- **Market Intelligence Engine**: labor market data, geo-political signals, salary intelligence, hiring trends
- **Networking Intelligence Layer**: who to meet, where, why — tied to goals and target roles
- **Recommendation Engine**: prioritized action feed and next-best-action system
- **Motivation Engine**: progress tracking, momentum maintenance, system adherence

Each engine owns a clear domain and exposes capabilities to the agent orchestration layer.

### Memory and Data Layer

The memory and data layer stores durable career context, profile facts, preferences, history, scores, application status, learned patterns, and agent activity.

Memory categories:

- **Explicit memory**: user-provided goals, preferences, constraints, and corrections.
- **Inferred memory**: patterns learned from behavior, outcomes, and accepted recommendations.
- **Episodic memory**: historical interactions, tasks, applications, interviews, and feedback.
- **Semantic career memory**: normalized facts about roles, skills, companies, industries, and learning paths.
- **Operational memory**: active tasks, deadlines, and workflow state.

### Integration Layer

The integration layer connects CareerOS to external sources for real-time data.

Job sources:

- LinkedIn Jobs
- Indeed
- IrishJobs
- Glassdoor
- Wellfound
- Reed
- TotalJobs
- EURES
- Company career pages

Market intelligence sources:

- Government labor reports and statistics
- Economic indicators
- Industry reports and publications
- Trusted news feeds
- Hiring trend datasets
- Salary datasets

All source access must be reviewed for API availability, terms, rate limits, and data permissions before implementation.

### Model Gateway

The model gateway is the pluggable interface between CareerOS and AI model providers. All AI calls go through this gateway. The gateway abstracts provider-specific APIs, manages routing, cost controls, fallbacks, and evaluation.

Supported model types (pluggable):

- OpenAI (current wiring)
- Anthropic Claude
- Google Gemini
- Local models
- Future agentic entities

No engine, service, or product feature should directly depend on a specific model provider's SDK. Everything goes through the model gateway interface.

## Conceptual Data Flow

1. The user authenticates with Better Auth.
2. Kai begins niche discovery and profile intelligence.
3. The system imports or receives resume, LinkedIn, preference, and goal data.
4. The Career Intelligence Engine creates an initial profile analysis and niche validation.
5. The AI Memory System stores user facts, preferences, scores, and recommendations.
6. The Job Discovery Engine begins proactive 24x7 opportunity monitoring.
7. The Market Intelligence Engine pulls real-time signals from trusted sources.
8. The Agent Orchestration Layer ranks actions and produces an action feed.
9. The user reviews, approves, edits, or rejects recommended actions.
10. The Application Automation Engine prepares tailored documents for review.
11. The Learning Intelligence Engine converts gaps into learning plans and proof-of-work scaffolding.
12. Outcomes are stored and used to improve future recommendations.

## Automation Safety Model

CareerOS uses progressive automation levels:

- Level 0: User manually asks for help.
- Level 1: Kai recommends actions and explains reasoning.
- Level 2: Kai drafts assets for review.
- Level 3: Kai executes low-risk internal tasks after approval.
- Level 4: Kai monitors continuously and prepares actions proactively.
- Level 5: Kai executes pre-authorized workflows within user-defined boundaries.

External actions always require explicit approval:

- Submitting job applications
- Sending messages on behalf of the user
- Updating external profiles
- Sharing personal documents
- Scheduling interviews or meetings
- Connecting new third-party accounts

## Current Technical Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui
- **Auth**: Better Auth with Drizzle adapter
- **Database**: PostgreSQL (Docker for local, production TBD), Drizzle ORM
- **AI**: Pluggable model gateway — currently wired to OpenAI SDK
- **Monorepo**: npm workspaces (`apps/web`, `packages/database`, `packages/shared`, `packages/types`, `packages/ui`)
- **Voice**: Browser Web Speech API (Phase 2)
- **Real-time data**: Third-party trusted APIs (Phase 3+)

## Non-Negotiable Guardrails

- No external submissions without explicit user approval.
- No invented job data, salary facts, market trends, or credentials.
- No memory leakage across users or tenants.
- No sensitive data in analytics payloads.
- No unreviewed scraping strategy.
- No opaque scores without explanation.
- No hard-coded model provider assumptions in feature design.
- No static market data presented as current intelligence.
