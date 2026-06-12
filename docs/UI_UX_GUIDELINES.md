# CareerOS UI and UX Guidelines

## Experience Direction

CareerOS is Scout. Every screen the user sees is Scout's operating surface. The interface is not a dashboard with an AI assistant widget attached — it is the physical form that Scout takes in the browser. The entire product should feel like entering the mind of a calm, intelligent career strategist who is working on your behalf.

The interface must never feel like:

- A traditional job board
- A generic analytics dashboard
- A static applicant tracker
- A chatbot widget bolted onto a conventional app

The interface must feel like:

- A mission control center for career growth
- A professional command hub driven by intelligence
- A dynamic AI action workspace
- A personal career strategy environment where Scout is always present

## Core UX Principles

### Scout-First, Always

Scout is present as the central product experience on every screen. The user should always see what Scout is doing, what Scout has prepared, what Scout recommends, and what needs their attention. There is no screen where Scout is absent.

### Low Friction

The product reduces user effort. The user should not need to search, compare, rewrite, track, and remember everything manually. Scout does the heavy lifting; the user approves and adjusts.

### Action Oriented

Every major screen helps the user answer:

- What is happening?
- What should I do next?
- What is Scout doing for me right now?
- What needs my approval?
- What changed since I last logged in?

### Explainable Intelligence

Scores, rankings, and recommendations include clear reasoning and evidence sources. The user must understand why Scout recommends something — especially when Scout challenges a decision.

### Honest, Not Comfortable

Scout's interface reflects Scout's honest-mentor identity. The UI does not hide bad news. If a niche is risky, if a score is low, or if a direction is not supported by data, the interface surfaces that clearly and constructively — with a path forward.

### Calm Professionalism

The product feels supportive and strategic, not noisy, gimmicky, or anxious. Scout is calm even when the market is not.

## Main Screens

### Welcome Experience

Purpose:

- Introduce Scout as the career operating system.
- Establish trust.
- Communicate that Scout will actively work on the user's career.

Key elements:

- Scout introduction in first person.
- Clear authentication path.
- Short explanation of what Scout will do after onboarding.

### Authentication

Purpose:

- Create a durable account so Scout can remember everything.

Current options:

- Email/password (Better Auth).
- OAuth providers (future).

### Profile Discovery and Niche Discovery

Purpose:

- Gather career data AND have Scout begin the first substantive conversation about the user's direction.

Key UX requirements:

- Scout guides the process conversationally, not through a cold form sequence.
- Show what data is being gathered and why.
- Niche discovery: Scout asks about the user's goals, interests, and ambitions.
- Niche validation: Scout returns a candid assessment of that direction with evidence — not just confirmation.
- Let users review and correct important profile facts.
- Keep the process guided, intelligent, and lightweight.

### Career Analysis

Purpose:

- Present Scout's honest, evidence-grounded understanding of the user's career state and direction.

Key elements:

- Career summary: who the user is professionally.
- Niche assessment: is the stated direction viable? What does the data say?
- Strengths with evidence.
- Gaps and missing evidence — presented constructively.
- Opportunity score and market readiness score with component breakdown.
- Growth system prescription: a concrete ordered plan.

### Career Command Center

Purpose:

- The main Scout operating surface after onboarding. This is where the user lives in CareerOS.

Key elements:

- Scout action feed: what Scout has prepared, found, or wants to surface.
- Priority recommendations with evidence.
- Active agent tasks and status.
- Upcoming deadlines.
- Career progress snapshot.
- Market signals relevant to the user's direction.
- Opportunities requiring review.
- Learning and application next steps.
- Voice input entry point (Phase 2).

### Opportunity Center

Purpose:

- Show Scout-discovered opportunities and explain fit.

Key elements:

- Ranked opportunities with match and gap explanations.
- Salary and location fit.
- Market context for each opportunity.
- Save, reject, and prepare application actions.

### Application Workspace

Purpose:

- Help users prepare, track, and improve applications — with Scout's help.

Key elements:

- Application status.
- Tailored resume draft (role-specific).
- Cover letter draft.
- Interview plan.
- Deadline tracking.
- Next action.
- Approval controls for every external action.

### Learning and Proof-of-Work Hub

Purpose:

- Convert skill gaps into practical learning progress and visible portfolio evidence.

Key elements:

- Target role and gap mapping.
- Recommended courses prioritized by market demand.
- Portfolio project suggestions (proof-of-work, not just courses).
- GitHub repo scaffolding suggestions.
- Progress tracking tied to readiness score.

### Market Intelligence Hub

Purpose:

- Show the real-time market context Scout is using to assess the user's direction.

Key elements:

- Hiring and layoff trends.
- Salary intelligence.
- Industry and technology shift summaries.
- Geo-political and economic context.
- Source attribution and freshness dates.
- How signals connect to the user's specific goals.

### AI Agent Workspace

Purpose:

- Make Scout's work transparent: what it is doing, what it has prepared, what is pending approval.

Key elements:

- Agent task queue and history.
- Completed tasks.
- Pending approvals with content preview.
- Reasoning summaries per task.
- Memory updates visible to the user.
- User feedback controls.

## Interaction Patterns

Preferred patterns:

- Scout conversation cards with evidence inlining.
- AI action feeds with approval queues.
- Timeline of Scout activity.
- Voice interaction (Phase 2, Browser Web Speech API).
- Real-time market signal updates.
- Smart recommendations with source attribution.
- Inline reasoning and challenge surfaces.
- Approval queues for external actions.

Avoid:

- Large static tables as the primary interface.
- Generic chatbot-only workflows.
- Opaque scores without explanation.
- Overwhelming dashboards.
- Actions without context or reasoning.
- Hiding negative or challenging information to keep the UX "positive."

## Tone and Content Guidelines

The product voice matches Scout's persona:

- Intelligent
- Professional
- Calm
- Honest — sometimes challenging
- Strategic
- Specific
- Evidence-backed

Scout should:

- Explain reasoning and cite evidence.
- Surface uncomfortable truths constructively.
- Offer practical, grounded next steps.
- Avoid robotic or generic phrasing.
- Avoid exaggerating certainty or suppressing uncertainty.

## Trust and Control

The user must always understand:

- What data Scout has used and where it came from.
- What Scout recommends and why.
- When Scout is being contrarian and what data supports that position.
- What Scout wants to do next.
- Whether an action will affect an external system.
- How to approve, edit, reject, or undo actions.

Scout's transparency is the foundation of trust. Never hide the reasoning.
