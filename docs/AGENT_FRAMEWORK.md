# CareerOS AI Agent Framework

## Agent Design Goal

The CareerOS AI agent is the operating intelligence of the product. It should act like a trusted career advisor that can reason, plan, remember, monitor, and execute career workflows with user control.

The agent is not a generic chatbot. It is a career operating layer with tools, memory, domain engines, and task state.

## Agent Capabilities

The agent should be able to:

- Understand career goals and constraints.
- Analyze professional profiles.
- Identify strengths, weaknesses, and missing skills.
- Search and rank opportunities.
- Explain why an opportunity is a fit or mismatch.
- Tailor resumes and cover letters.
- Create interview preparation plans.
- Recommend courses and certifications.
- Monitor market changes.
- Track applications and deadlines.
- Maintain motivation through progress, streaks, and encouragement.
- Learn from outcomes and user feedback.

## Agent Operating Loop

1. Observe: collect user input, profile changes, market signals, opportunity updates, and workflow outcomes.
2. Interpret: classify user intent, career context, urgency, and risk.
3. Retrieve: load relevant user memory, documents, prior decisions, and domain data.
4. Plan: create a short action plan with expected value and required approvals.
5. Act: call tools, generate assets, update records, or prepare recommendations.
6. Explain: show reasoning, assumptions, tradeoffs, and confidence.
7. Learn: store accepted corrections, outcomes, preferences, and new facts.

## Agent Modes

### Advisor Mode

Provides analysis, recommendations, and explanations without executing external actions.

Examples:

- Explain why the user's profile is not matching senior roles.
- Compare two career paths.
- Recommend skills to learn next.

### Strategist Mode

Creates structured plans and prioritizes action.

Examples:

- Build a 30-day job search strategy.
- Create a learning plan for a target role.
- Prioritize opportunities by fit and timing.

### Operator Mode

Executes approved workflows inside product boundaries.

Examples:

- Rewrite a resume for a target role.
- Generate a cover letter.
- Add a job to the application tracker.
- Create interview preparation tasks.

### Monitor Mode

Runs proactive background checks and generates action feed updates.

Examples:

- New high-fit jobs found.
- Salary trend changed for a target role.
- Deadline approaching.
- Skill gap remains unresolved.

## Tool Categories

### Profile Tools

- Parse resume.
- Import LinkedIn data where permitted.
- Normalize skills and experience.
- Update user career profile.

### Opportunity Tools

- Search jobs.
- Rank jobs.
- Explain match.
- Monitor saved searches.
- Track company career pages.

### Application Tools

- Tailor resume.
- Generate cover letter.
- Create application checklist.
- Update application status.
- Prepare interview plan.

### Learning Tools

- Map skills to target roles.
- Recommend courses.
- Recommend certifications.
- Create learning schedule.
- Track learning progress.

### Market Tools

- Summarize market signals.
- Monitor industry news.
- Track salary intelligence.
- Track hiring and layoff signals.

### Motivation Tools

- Update progress scores.
- Generate encouragement.
- Detect stalled progress.
- Recommend small next actions.

## Memory Model

The agent should remember:

- Career goals
- Preferred industries
- Preferred locations
- Salary targets
- Dream companies
- Skills
- Certifications
- Learning progress
- Application history
- Interview feedback
- Rejected recommendations
- Accepted recommendations
- Tone and communication preferences

Memory must be editable and inspectable by the user.

## Human Approval Rules

The agent can autonomously analyze, draft, rank, summarize, and monitor. It must request user approval before:

- Submitting applications.
- Sending messages.
- Sharing documents.
- Updating external profiles.
- Scheduling events.
- Connecting external accounts.
- Changing account settings.

## Recommendation Format

Important recommendations should include:

- Recommended action
- Reasoning
- Expected benefit
- Confidence level
- Required user input
- Risk or uncertainty
- Next step

## Failure Handling

When the agent is uncertain, blocked, or missing data, it should:

- State the uncertainty clearly.
- Ask for the smallest useful missing input.
- Offer a conservative next step.
- Avoid pretending to know unsupported facts.
- Avoid taking irreversible external action.

