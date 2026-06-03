# Empty State Design

## Purpose

Empty states should reduce anxiety, explain why a section is empty, and guide the user toward one useful action. They should not feel like errors or dead ends. All empty states come from Kai — there is no part of CareerOS that exists outside Kai.

## Empty State Principles

- Kai says what is missing.
- Kai explains why it matters.
- Offer one primary action.
- Keep Kai's tone calm and specific.
- Avoid blame.
- Never use a generic loading spinner without Kai narrating what is happening.

## Kai Command Center Empty State

When onboarding is incomplete:

```text
[Kai Command Center]
Your command center will be ready after your first Career Intelligence Report.

[Kai speaks]
[Continue onboarding button]
```

Kai says:

> I need your CV, profile details, and career goal before I can build a useful command center. Complete onboarding and I will prepare your first analysis — including an honest assessment of your direction.

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

Kai says:

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

Kai says:

> LinkedIn context helps me compare your public profile with your CV. You can skip this now, but the analysis may be less precise.

Primary action:

- Paste LinkedIn profile text

## Niche Validation Empty State

When niche discovery has not been completed:

```text
[Niche Assessment]
Not yet assessed.

[Start niche discovery]
```

Kai says:

> I have not yet assessed your career direction against market data. This is an important step — it tells you whether the path you are planning is supported by current hiring reality.

Primary action:

- Start niche discovery

## Career Analysis Empty State

When no report exists:

```text
[Career Intelligence Report]
No report generated yet.

[Generate report]
```

Kai says:

> Once your profile is ready, I can generate your first Career Intelligence Report — with strengths, gaps, an honest niche assessment, learning recommendations, and readiness scores.

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

Kai says:

> I do not have enough job data yet to surface strong matches. Search for a target role or update your goals so I can refine the recommendations.

Primary action:

- Search jobs

Secondary action:

- Update target role

## Application Tracker Empty State

When no applications exist:

```text
[Application Tracker]
No applications tracked yet.

[Review recommended jobs]
[Add application manually]
```

Kai says:

> When you save a role or apply somewhere, track it here so I can help you stay organised and follow up.

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

Kai says:

> I can recommend learning actions after I understand your target role and skill gaps. I prioritise recommendations by what the market currently values most for your direction.

Primary action:

- Generate from skill gaps

## Kai Assistant Empty State

Before the first message:

```text
[Kai]
Ask about your report, your direction, your skills, or what to do next.

[Starter prompts]
```

Kai says:

> Ask me about your career report, your niche assessment, your strongest opportunities, or the fastest way to improve your readiness score. I will give you a straight answer.

Starter prompts:

- Why did I get this readiness score?
- Is my career direction realistic?
- Which job should I target first?
- What skill or evidence gap matters most?
- How can I improve my CV?

## Error State Principles

When something fails:

- Preserve user data.
- Explain the failure simply.
- Offer retry or fallback.
- Do not blame the user.
- Do not expose technical errors.

Example:

> I could not complete that analysis, but your profile data is saved. Try again, or continue to the command center and generate the report later.
