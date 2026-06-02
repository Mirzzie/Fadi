# Empty State Design

## Purpose

Empty states should reduce anxiety, explain why a section is empty, and guide the user toward one useful action. They should not feel like errors or dead ends.

## Empty State Principles

- Say what is missing.
- Explain why it matters.
- Offer one primary action.
- Keep the AI calm and specific.
- Avoid blame.

## Dashboard Empty State

When onboarding is incomplete:

```text
[Career Dashboard]
Your dashboard will appear after your first Career Intelligence Report.

[AI message]
[Continue onboarding button]
```

AI says:

> I need your CV, profile details, and career goal before I can build a useful dashboard. Continue onboarding and I will prepare your first report.

Primary action:

- Continue onboarding

## Resume Empty State

When no CV is uploaded:

```text
[CV Upload]
No CV uploaded yet.

[Upload CV]
[Continue manually]
```

AI says:

> A CV helps me understand your experience quickly. If you do not have one ready, you can continue manually and add it later.

Primary action:

- Upload CV

Secondary action:

- Continue manually

## LinkedIn Empty State

When no LinkedIn context is added:

```text
[LinkedIn Context]
No LinkedIn profile added.

[Paste LinkedIn profile text]
[Skip for now]
```

AI says:

> LinkedIn context helps me compare your public profile with your CV. You can skip this now, but the report may be less complete.

Primary action:

- Paste LinkedIn profile text

## Career Analysis Empty State

When no report exists:

```text
[Career Intelligence Report]
No report generated yet.

[Generate report]
```

AI says:

> Once your profile is ready, I can generate your first Career Intelligence Report with strengths, gaps, opportunities, learning recommendations, and readiness scores.

Primary action:

- Generate report

## Job Recommendations Empty State

When no jobs are available:

```text
[Job Recommendations]
No recommendations yet.

[Search jobs]
[Update target role]
```

AI says:

> I do not have enough job data yet to recommend strong matches. Search for a target role or update your goals so I can try again.

Primary action:

- Search jobs

Secondary action:

- Update target role

## Application Tracker Empty State

When no applications exist:

```text
[Application Tracker]
No applications tracked yet.

[Add application]
[Review recommended jobs]
```

AI says:

> When you save a role or apply somewhere, track it here so I can help you stay organized.

Primary action:

- Review recommended jobs

Secondary action:

- Add application manually

## Learning Empty State

When no learning recommendations exist:

```text
[Learning Recommendations]
No learning path yet.

[Generate from skill gaps]
```

AI says:

> I can recommend learning actions after I understand your target role and skill gaps.

Primary action:

- Generate from skill gaps

## Assistant Empty State

Before first message:

```text
[AI Career Assistant]
Ask about your report, skills, jobs, or next steps.

[Starter prompts]
```

AI says:

> Ask me about your report, your strongest opportunities, or the fastest way to improve your readiness score.

Starter prompts:

- Why did I get this readiness score?
- Which job should I target first?
- What skill should I learn next?
- How can I improve my CV?

## Error State Principles

When something fails:

- Preserve user data.
- Explain the failure simply.
- Offer retry or fallback.
- Do not blame the user.

Example:

> I could not complete that analysis, but your profile data is saved. Try again, or continue to the dashboard and generate the report later.

