# Performance Review

## Summary

The MVP is small and should perform acceptably for private alpha scale if hosted with a correctly configured PostgreSQL connection. The main performance risks are not rendering complexity; they are database connection management, AI report latency, absence of caching, and lack of observability.

## Findings

| ID       | Area                 | Issue                                                                                               | Severity | Recommendation                                                                 | Effort |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ | ------ |
| PERF-001 | Database connections | Web app creates a global PostgreSQL pool but production pooling strategy is not defined             | High     | Configure provider-compatible pooling; set pool size for serverless deployment | Medium |
| PERF-002 | AI latency           | Career report generation is synchronous in a server action                                          | Medium   | Accept for alpha; later move to queued background job with status polling      | Medium |
| PERF-003 | Dashboard queries    | Dashboard loads profile summary, report, and job preview on every request                           | Low      | Fine for alpha; add caching or query consolidation if usage grows              | Low    |
| PERF-004 | Job matching         | Matching recomputes scores on each jobs page load                                                   | Low      | Fine for seeded local jobs; persist recommendation snapshots later             | Medium |
| PERF-005 | Missing indexes      | Core user/status indexes exist; some composite lookup indexes could improve application/job queries | Low      | Add indexes when query plans show need                                         | Low    |
| PERF-006 | Payload size         | Resume and LinkedIn text are truncated before OpenAI call but stored raw in database                | Medium   | Add length limits and retention policy                                         | Medium |
| PERF-007 | Observability        | No timing metrics for database queries or AI calls                                                  | Medium   | Add basic request/action timing logs before alpha                              | Medium |

## Current Performance Profile

### Server Rendering

The app uses dynamic server-rendered dashboard and onboarding pages. Page complexity is low. The `/dashboard/jobs` page renders local jobs and client action controls.

### Database Access

The app uses Drizzle repositories and a global PostgreSQL pool in the web process. This works locally. In serverless production, connection count must be controlled using provider pooling or a serverless-compatible driver strategy.

### AI Report Generation

Report generation is the slowest user action. It:

1. Reads career context from PostgreSQL.
2. Sends resume, LinkedIn context, and goals to OpenAI.
3. Parses a structured response.
4. Saves the report.

This is acceptable for very small alpha if users understand generation may take several seconds. It is not yet designed for high concurrency.

### Job Discovery

Local seeded jobs are loaded and scored in memory. This is acceptable while the job table is small. Future external job ingestion should introduce stored recommendations or query filters.

## Scale Readiness

| Scale                    | Readiness     | Notes                                                    |
| ------------------------ | ------------- | -------------------------------------------------------- |
| Local development        | Ready         | Docker Postgres and migrations work                      |
| 5-20 private alpha users | Conditional   | Needs production DB/pooling/logging                      |
| 100 MVP users            | Not ready yet | Needs rate limits, observability, AI cost tracking       |
| 1,000+ users             | Not ready     | Needs async AI jobs, recommendation snapshots, telemetry |

## Recommended Performance Work Before Alpha

1. Select production PostgreSQL provider and pooling approach.
2. Add action-level timing logs.
3. Add OpenAI request duration and failure counters.
4. Add max input lengths for resume/LinkedIn paste fields.
5. Document expected report generation latency.
