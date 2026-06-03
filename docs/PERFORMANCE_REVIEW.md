# Performance Review

## Summary

The Phase 1 MVP is small and performs acceptably for private alpha scale with a correctly configured PostgreSQL connection. The main performance risks are database connection management, AI report latency, absence of caching, and lack of observability.

## Findings

| ID | Area | Issue | Severity | Recommendation | Effort |
| --- | --- | --- | --- | --- | --- |
| PERF-001 | Database connections | Web app creates a global PostgreSQL pool; production pooling strategy not defined | High | Configure provider-compatible pooling; set pool size for serverless deployment | Medium |
| PERF-002 | AI latency | Career report generation is synchronous in a server action | Medium | Accept for alpha; later move to queued background job with status polling | Medium |
| PERF-003 | Dashboard queries | Dashboard loads profile summary, report, and job preview on every request | Low | Fine for alpha; add caching or query consolidation if usage grows | Low |
| PERF-004 | Job matching | Matching recomputes scores on each jobs page load | Low | Fine for seeded local jobs; persist recommendation snapshots later | Medium |
| PERF-005 | Missing indexes | Core user/status indexes exist; some composite lookup indexes could improve queries | Low | Add indexes when query plans show need | Low |
| PERF-006 | Payload size | Resume and LinkedIn text are truncated before AI call but stored raw in database | Medium | Add length limits and retention policy | Medium |
| PERF-007 | Observability | No timing metrics for database queries or AI calls | Medium | Add basic request/action timing logs before alpha | Medium |
| PERF-008 | Niche validation | Niche validation will add additional AI calls to the onboarding flow | Medium | Design niche validation as a separate async-ready step; don't block onboarding completion | Medium |

## Current Performance Profile

### Server Rendering

The app uses dynamic server-rendered dashboard and onboarding pages. Page complexity is low. The `/dashboard/jobs` page renders local jobs and client action controls.

### Database Access

The app uses Drizzle repositories and a global PostgreSQL pool in the web process. This works locally. In serverless production, connection count must be controlled using provider pooling or a serverless-compatible driver strategy.

### AI Report Generation

Report generation is the slowest user-initiated action. It:

1. Reads career context from PostgreSQL.
2. Sends resume summary, LinkedIn summary, and goals to the AI model gateway.
3. Parses a structured response via Zod.
4. Saves the report.

This is acceptable for very small alpha if users understand generation may take several seconds. It is not designed for high concurrency.

### Niche Validation

Niche validation will introduce additional AI calls during onboarding. It should be designed as a step that can run asynchronously or in the background if needed — not blocking the core onboarding completion.

### Job Discovery

Local seeded jobs are loaded and scored in memory. Acceptable while the job table is small. Future external job ingestion should use stored recommendation snapshots.

## Scale Readiness

| Scale | Readiness | Notes |
| --- | --- | --- |
| Local development | Ready | Docker PostgreSQL and migrations work |
| 5-20 private alpha users | Conditional | Needs production DB/pooling/logging |
| 100 Phase 1 users | Not ready yet | Needs rate limits, observability, AI cost tracking |
| 1,000+ users | Not ready | Needs async AI jobs, recommendation snapshots, telemetry |

## Recommended Performance Work Before Alpha

1. Select production PostgreSQL provider and configure pooling for serverless deployment.
2. Add action-level timing logs.
3. Add AI model gateway request duration and failure counters.
4. Add max input lengths for resume/LinkedIn paste fields.
5. Document expected report generation latency for users.
6. Design niche validation as async-ready from the start.
