# CareerOS AI System Architecture

## Architecture Intent

CareerOS AI should be designed as an agentic career operating system rather than a conventional job search application. The architecture must support persistent user memory, AI reasoning, workflow execution, external data ingestion, explainable recommendations, and human approval for sensitive actions.

This document defines the initial conceptual architecture only. It does not prescribe a frontend framework, backend framework, hosting provider, or package stack yet.

## System Principles

- Agent-first: the AI career agent is the primary interaction and orchestration layer.
- User-controlled automation: the system may prepare actions autonomously, but sensitive actions require explicit user approval.
- Persistent memory: user preferences, goals, progress, and outcomes improve future recommendations.
- Explainability: important scores, rankings, and recommendations must include reasoning.
- Modular intelligence: career analysis, job discovery, applications, learning, market intelligence, and motivation should be separable services or domains.
- Compliance-aware: personal data, employment history, profile information, and application activity must be treated as sensitive.

## High-Level Components

### Client Experience

The user-facing application presents the AI career agent, command center, opportunity workflows, learning plans, application workspace, and market intelligence.

Expected interaction modes:

- Conversational command interface
- Action feed
- Task queue
- Timeline
- Dynamic recommendation cards
- Voice input and output where supported

### API Layer

The API layer exposes product capabilities to the client and coordinates authenticated access to user data, agent state, workflow status, documents, and integrations.

Core responsibilities:

- Authentication and session handling
- User profile management
- Career data access
- Agent task dispatch
- Recommendation retrieval
- Application workflow management
- Integration callbacks and webhooks

### Agent Orchestration Layer

The agent orchestration layer coordinates AI planning, tool use, memory retrieval, and workflow execution.

Core responsibilities:

- Interpret user intent.
- Retrieve relevant user memory and career context.
- Select the right engine or tool.
- Produce plans and recommendations.
- Request approval for sensitive actions.
- Execute approved tasks.
- Track task state and outcomes.

### Intelligence Engines

The product should be decomposed into major engines:

- Career Intelligence Engine
- Job Discovery Engine
- Application Automation Engine
- Learning Intelligence Engine
- Market Intelligence Engine
- Motivation Engine

Each engine owns a clear domain and can expose capabilities to the agent orchestration layer.

### Memory and Data Layer

The memory and data layer stores the user's durable career context, profile facts, preferences, history, scores, application status, learned patterns, and agent activity.

Memory categories:

- Explicit memory: user-provided goals, preferences, constraints, and corrections.
- Inferred memory: patterns learned from behavior, outcomes, and accepted recommendations.
- Episodic memory: historical interactions, tasks, applications, interviews, and feedback.
- Semantic career memory: normalized facts about roles, skills, companies, industries, and learning paths.

### Integration Layer

The integration layer connects CareerOS AI to external sources such as job platforms, profile providers, learning platforms, market data sources, email/calendar systems, and document tools.

Potential sources from the brief:

- LinkedIn Jobs
- Indeed
- IrishJobs
- Glassdoor
- Wellfound
- Reed
- TotalJobs
- EURES
- Company career pages
- Government reports
- Labor statistics
- Industry reports
- News feeds
- Economic indicators

## Conceptual Data Flow

1. The user authenticates and starts profile discovery.
2. The system imports or receives resume, LinkedIn, preference, and career goal data.
3. The Career Intelligence Engine creates an initial profile analysis.
4. The AI Memory System stores user facts, preferences, scores, and recommendations.
5. The Job Discovery Engine monitors external opportunities.
6. The Agent Orchestration Layer ranks actions and produces an action feed.
7. The user approves, edits, or rejects recommended actions.
8. The Application Automation Engine prepares resumes, cover letters, trackers, and interview plans.
9. The Learning Intelligence Engine converts gaps into learning plans.
10. Outcomes are stored and used to improve future recommendations.

## Automation Safety Model

CareerOS AI should use progressive automation levels:

- Level 0: User manually asks for help.
- Level 1: AI recommends actions only.
- Level 2: AI drafts assets for review.
- Level 3: AI executes low-risk approved tasks.
- Level 4: AI monitors continuously and prepares actions proactively.
- Level 5: AI executes pre-authorized workflows within user-defined boundaries.

Sensitive actions should require confirmation, including:

- Submitting job applications.
- Sending messages on behalf of the user.
- Updating external profiles.
- Sharing personal documents.
- Scheduling interviews or meetings.
- Connecting new third-party accounts.

## Initial Non-Goals

- No frontend scaffold yet.
- No backend scaffold yet.
- No package installation yet.
- No production infrastructure decisions yet.
- No autonomous job application submission without explicit approval.
- No scraping strategy without legal and platform policy review.

## Future Technical Decisions

Future architecture work should decide:

- Application framework and API style.
- Database and vector memory storage.
- Identity provider.
- LLM provider and model routing.
- Agent framework or custom orchestration approach.
- Queue and background job system.
- Observability, evaluation, and safety tooling.
- Data retention and user deletion model.

