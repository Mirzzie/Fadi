# Architecture Decision Records

## Purpose

Architecture Decision Records document important technical decisions, the context behind them, and their consequences. They prevent the repository from accumulating invisible architectural drift.

## ADR Naming

Store ADRs in:

```text
docs/adr/
```

Use this naming format:

```text
0001-use-nextjs-app-router.md
0002-use-better-auth-not-supabase.md
0003-use-drizzle-orm-not-prisma.md
0004-pluggable-model-gateway.md
0005-postgresql-first-architecture.md
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

## ADRs Already Decided (Capture As Formal ADRs)

These decisions have been made and should be captured as formal ADRs:

1. **Next.js 16 App Router as the web framework**: full-stack TypeScript, server actions, React 19.
2. **Better Auth as the MVP auth provider**: replaces Supabase Auth; first-party TypeScript auth with Drizzle adapter.
3. **PostgreSQL as the database**: Docker locally, managed provider for production; all migrations must run against vanilla PostgreSQL.
4. **Drizzle ORM with committed migrations**: type-safe, SQL-forward, portable; chosen over Prisma for its SQL visibility and service extraction compatibility.
5. **Pluggable AI model gateway**: OpenAI currently wired; Claude, Gemini, and local models supported by design; no feature code imports provider SDKs directly.
6. **Scout as the entire product**: not a chatbot widget or a supplementary assistant; the entire UI is Scout's operating surface.

## ADRs Required Before Implementation Expands

Create ADRs for:

- Managed PostgreSQL hosting provider selection (Neon vs Supabase Postgres vs RDS).
- Vercel as MVP hosting provider.
- Object storage provider (S3 vs Cloudflare R2 vs equivalent).
- Job source API selection for Phase 3.
- Voice implementation approach (Browser Web Speech API specifics for Phase 2).
- Background job queue approach (lightweight queue vs scheduled API jobs for Phase 3 monitoring).
- Real-time market data API selection for Phase 3.
