# Architecture Decision Records

## Purpose

Architecture Decision Records document important technical decisions, the context behind them, and their consequences. They prevent the repository from accumulating invisible architectural drift.

## ADR Naming

Store future ADRs in:

```text
docs/adr/
```

Use this naming format:

```text
0001-use-nextjs-app-router.md
0002-use-supabase-for-mvp.md
0003-model-client-abstraction.md
```

## ADR Statuses

- `Proposed`
- `Accepted`
- `Rejected`
- `Superseded`
- `Deprecated`

## ADR Template

```markdown
# ADR 0000: Decision Title

## Status

Proposed

## Date

YYYY-MM-DD

## Context

Describe the problem, constraints, business needs, and technical forces.

## Decision

Describe the decision clearly.

## Alternatives Considered

- Option A: pros and cons.
- Option B: pros and cons.
- Option C: pros and cons.

## Consequences

Positive:

- Outcome.

Negative:

- Tradeoff.

## Implementation Notes

- Migration steps.
- Required follow-up work.
- Operational considerations.

## Review Date

YYYY-MM-DD or "Not scheduled".
```

## ADRs Required Before Implementation

Before coding begins, create ADRs for:

- Next.js App Router as the web framework.
- Supabase as MVP database, auth, and storage.
- Vercel as MVP hosting provider.
- OpenAI API behind a model client abstraction.
- MVP repository package boundaries.

