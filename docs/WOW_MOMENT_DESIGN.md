# Wow Moment Design

## Purpose

The first wow moment is the point where the user feels the AI genuinely understood their career context instead of producing generic advice.

## Wow Moment Definition

The first wow moment happens at the top of the Career Intelligence Report, when the AI gives one specific, evidence-based insight that connects:

- What the user has done.
- What the user wants.
- What is missing or under-expressed.
- What the user should do next.

## Wow Moment Formula

```text
You are currently positioned as [current identity].
Your target direction is [target role].
The strongest evidence in your profile is [specific strength].
The main gap is [specific missing skill/evidence].
The fastest next move is [specific action].
```

## Example

> I see you as an operations-focused professional with strong coordination and stakeholder experience. Your target role is Product Analyst, but your profile does not yet show enough evidence of SQL, dashboards, or product metrics. The fastest next move is to build one small analytics project and make your existing process improvement results more measurable on your CV.

## Why This Works

- It names the user's current position.
- It respects their target.
- It identifies a real strength.
- It gives a constructive gap.
- It suggests a specific next action.

## Placement

The wow moment appears:

1. At the top of the report reveal.
2. As the first dashboard insight after report completion.
3. As the assistant's first contextual prompt.

## Report Reveal Wireframe

```text
------------------------------------------------
[Career Intelligence Report]

[AI Insight]
"I see you as..."

[Why I think this]
- Evidence from CV
- Evidence from LinkedIn
- Goal you selected

[Your fastest lever]
Specific next action

[View full report]
------------------------------------------------
```

## AI Copy Variants

### Strong Fit

> You are already close to your target role. Your experience shows [evidence], and the main improvement is making that evidence easier for hiring teams to see.

### Career Switch

> You are not starting from zero. Your experience in [source domain] gives you transferable strengths in [strengths]. The gap is proving [target capability] with clearer evidence.

### Underdeveloped CV

> Your experience is stronger than your CV currently shows. The main issue is not lack of value; it is that your achievements need clearer outcomes, tools, and measurable impact.

### Skill Gap

> Your target role is realistic, but [skill] is the clearest missing signal. Improving that one area would make your profile significantly easier to match.

## Success Metrics

- User reads report insight.
- User clicks "Why I think this".
- User rates report useful.
- User asks assistant a follow-up question.
- User clicks first recommended next action.
- User returns to dashboard within 7 days.

## Failure Modes

Generic wow moment:

- "You have many skills and should keep improving."

Why it fails:

- It could apply to anyone.

Overconfident wow moment:

- "You are guaranteed to get a Product Analyst job."

Why it fails:

- It overpromises and breaks trust.

Harsh wow moment:

- "You are not ready for this career."

Why it fails:

- It may be true that gaps exist, but the tone destroys momentum.

## Quality Checklist

Before showing the wow moment, confirm:

- It names a specific target role.
- It references evidence from the user profile.
- It identifies one specific gap or leverage point.
- It recommends one next action.
- It does not promise an outcome.
- It does not invent experience or market facts.

