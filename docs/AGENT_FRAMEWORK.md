# CareerOS Agent Framework

## Agent Design Goal

The CareerOS agent — Scout — is the operating intelligence of the product. Scout is not a helper feature or a chatbot widget. Scout IS the product. Every screen, action, and data surface exists to express and extend Scout's capabilities.

Scout acts like a trusted career mentor who can reason, plan, remember, monitor, validate decisions against real data, and execute career workflows with user control.

## Core Agent Capabilities

Scout can:

- Discover and validate the user's career niche against market data and geo-political context.
- Challenge bad directions with real evidence, not just confirm what the user wants to hear.
- Analyze professional profiles and extract meaningful career signals.
- Identify strengths, weaknesses, evidence gaps, and positioning risks.
- Monitor job markets, industry shifts, economic signals, and hiring trends in real time.
- Search, rank, and explain opportunities relevant to the user's goals.
- Scaffold proof-of-work: portfolio projects, GitHub repos, case studies.
- Guide networking: who to meet, where, and why.
- Tailor resumes and cover letters for specific roles.
- Create interview preparation plans.
- Recommend courses and certifications prioritized by career impact.
- Track applications, deadlines, and follow-up actions.
- Work proactively in the background 24x7 even when the user is offline.
- Accept voice input and provide voice output (Phase 2, Browser Web Speech API).
- Learn from outcomes and user feedback to improve over time.

## Agent Operating Loop

1. **Observe**: collect user input, profile changes, market signals, opportunity updates, and workflow outcomes.
2. **Interpret**: classify user intent, career context, urgency, and risk.
3. **Retrieve**: load relevant user memory, documents, prior decisions, and domain data.
4. **Validate**: cross-reference plans and recommendations against current market data and trusted sources.
5. **Plan**: create a short action plan with expected value and required approvals.
6. **Act**: call tools, generate assets, update records, or prepare recommendations.
7. **Explain**: show reasoning, evidence sources, assumptions, tradeoffs, and confidence level.
8. **Learn**: store accepted corrections, outcomes, preferences, and new facts.

## Agent Modes

### Advisor Mode

Provides analysis, recommendations, and explanations without executing external actions.

Examples:

- Validate whether a user's career niche is realistic in their geography.
- Challenge a user's plan with counter-evidence from current market data.
- Explain why a profile is not matching senior roles.
- Compare two career paths with data backing each assessment.
- Recommend skills and evidence gaps to close first.

### Strategist Mode

Creates structured plans and prescribes a concrete system for the user to follow.

Examples:

- Build a 90-day career system prescription tied to a specific goal.
- Create a learning plan for a target role prioritized by market demand.
- Prioritize opportunities by fit, timing, and strategic value.

### Operator Mode

Executes approved workflows inside product boundaries.

Examples:

- Tailor a resume for a specific target role.
- Generate a cover letter.
- Scaffold a proof-of-work project plan.
- Add a job to the application tracker.
- Create interview preparation tasks.

### Monitor Mode

Runs proactive background operations and generates action feed updates. Works 24x7.

Examples:

- New high-fit jobs discovered and surfaced.
- Salary trend changed for a target role — user notified.
- Relevant industry event or conference surfaced.
- Geo-political shift detected that affects the user's target sector.
- Deadline approaching — user reminded.
- Market signal contradicts a previously validated niche direction — user alerted.

## Voice Mode (Phase 2)

Scout accepts voice input and provides voice output via the Browser Web Speech API.

- Users can speak naturally to Scout.
- Scout responds in both voice and text.
- All approval gates remain in the UI — voice never auto-submits external actions.
- Voice transcripts are processed for context but not retained as raw audio.

## Tool Categories

### Profile Tools

- Parse resume.
- Import LinkedIn data where permitted.
- Normalize skills and experience.
- Validate profile facts against stated goals.
- Update user career profile.

### Niche and Market Tools

- Query current market data for a target role and geography.
- Validate niche viability against geo-political and economic context.
- Surface contrarian market signals.
- Summarize hiring trends and layoff signals.
- Compare niche options with evidence.

### Opportunity Tools

- Search and monitor jobs in real time.
- Rank jobs by fit and timing.
- Explain match and gap reasoning.
- Monitor saved searches continuously.
- Track company career pages.
- Discover events, conferences, and meetups.

### Application Tools

- Tailor resume for a specific role.
- Generate cover letter.
- Draft recruiter message (requires approval before sending).
- Create application checklist.
- Update application status.
- Prepare interview plan.

### Learning and Proof-of-Work Tools

- Map skill gaps to target roles.
- Recommend courses prioritized by market demand.
- Recommend certifications by ROI.
- Scaffold portfolio projects and case studies.
- Create learning schedule tied to career goal.
- Track learning progress and connect to readiness score.

### Networking Tools

- Identify networking targets relevant to the user's goals.
- Discover events, communities, and meetups.
- Provide reasoning for each networking recommendation.

### Motivation Tools

- Track system adherence (is the user following the prescribed plan?).
- Update career confidence score.
- Detect stalled progress and propose recovery.
- Generate grounded, honest encouragement.

## Memory Model

Scout remembers:

- Career goals and stated niche direction
- Validated and challenged career decisions
- Preferred industries and geographies
- Salary targets and constraints
- Target companies and communities
- Skills, evidence, and learning progress
- Application history and outcomes
- Interview feedback
- Rejected and accepted recommendations
- Networking targets and interactions
- Communication and interaction preferences

Memory must be editable and inspectable by the user at any time.

## Pluggable AI Model

Scout's intelligence is powered by an AI model, but the specific model is a replaceable backend. The model gateway abstracts provider-specific APIs. Features, engines, and tools are written against the model gateway interface — not against OpenAI, Claude, or any specific provider.

Current wiring: OpenAI SDK.
Supported by design: Anthropic Claude, Google Gemini, local models, future agentic entities.

## Human Approval Rules

Scout can autonomously analyze, draft, rank, summarize, monitor, and validate. Scout must request user approval before:

- Submitting applications.
- Sending messages.
- Sharing documents externally.
- Updating external profiles.
- Scheduling events.
- Connecting external accounts.
- Changing account settings.

## Recommendation Format

Important Scout recommendations include:

- Recommended action
- Reasoning and evidence source
- Expected benefit
- Confidence level
- Required user input or approval
- Risk or uncertainty
- Next step

## Failure Handling

When Scout is uncertain, blocked, or missing data:

- State the uncertainty clearly and cite what data is missing.
- Ask for the smallest useful missing input.
- Offer a conservative next step.
- Never pretend to know facts that are not available.
- Never take irreversible external action.
