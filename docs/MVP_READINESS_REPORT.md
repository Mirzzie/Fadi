# MVP Readiness Report

## Executive Summary

CareerOS is close to a private alpha candidate, but it is not ready for real-user private alpha until the launch blockers below are resolved. The MVP has a coherent product loop: Supabase Auth, PostgreSQL-owned app users, onboarding, AI Career Intelligence Report generation, local job discovery, saved jobs, and manual application tracking. The codebase validates cleanly and the Supabase-to-app-user decoupling is directionally sound.

Readiness verdict after Phase 14: **Ready for a very small private alpha after a production-like smoke test passes.**

Recommended alpha gate: complete the P0 and P1 items in this report, then run a browser-level smoke test against a production-like environment with real Supabase Auth, production PostgreSQL, and OpenAI keys.

## Validation Summary

Last validation run:

| Check                              | Result                          |
| ---------------------------------- | ------------------------------- |
| `npm run lint`                     | Passed                          |
| `npm run typecheck`                | Passed                          |
| `npm run build`                    | Passed                          |
| `npm audit --audit-level=moderate` | Failed with moderate advisories |

Build routes:

- `/`
- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/callback`
- `/dashboard`
- `/dashboard/jobs`
- `/onboarding`

## Audit Scope

Reviewed areas:

1. Authentication
2. Authorization
3. Route protection
4. Database schema
5. Repository layer
6. AI report generation
7. Job discovery
8. Application tracking
9. Error handling
10. Logging
11. Environment variables
12. Secrets handling

Required code searches:

| Search                                          | Result                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| TODO                                            | No matches                                                                                  |
| FIXME                                           | No matches                                                                                  |
| Direct Supabase domain table access in app code | No matches                                                                                  |
| Hardcoded production secrets                    | No production secrets found                                                                 |
| Untyped API response risk                       | OpenAI response is Zod-validated; Supabase claims and provider profile remain loosely typed |

Note: legacy Supabase migration files still reference `auth.users` and `auth.uid()`. These are historical infrastructure files and are no longer the active PostgreSQL-first domain migration path.

## MVP Capability Status

| Capability                    | Status          | Notes                                                   |
| ----------------------------- | --------------- | ------------------------------------------------------- |
| Email/password auth           | Implemented     | Supabase Auth remains temporary auth provider           |
| App-owned users               | Implemented     | Supabase user maps to `users` through `auth_identities` |
| Route protection              | Implemented     | Middleware/proxy plus server-page redirects             |
| Onboarding                    | Implemented     | Saves to PostgreSQL repositories                        |
| Dashboard                     | Implemented     | Reads from PostgreSQL repositories                      |
| AI Career Intelligence Report | Implemented     | Server-side OpenAI SDK with Zod response parsing        |
| Job discovery                 | Implemented     | Local seeded jobs only                                  |
| Saved jobs                    | Implemented     | PostgreSQL repository-backed                            |
| Application tracking          | Implemented     | Manual status updates                                   |
| File upload                   | Not implemented | Explicit MVP exclusion                                  |
| LinkedIn OAuth/import         | Not implemented | Text/URL paste only                                     |
| External job APIs             | Not implemented | Explicit Phase 12 exclusion                             |

## Launch Blockers

| ID      | Issue                                                                                                     | Severity | Recommendation                                                                                               | Effort     |
| ------- | --------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| MVP-001 | No durable distributed rate limiting for all server actions                                               | Medium   | Phase 14 added in-process AI report rate limiting and cooldown; add Redis/provider-backed limits before beta | Medium     |
| MVP-002 | No external error monitoring or audit event trail                                                         | Medium   | Phase 14 added basic structured logs; add Sentry/Axiom/etc. after first alpha cohort                         | Medium     |
| MVP-003 | AI processing needed explicit per-action consent and repeated-call guardrails                             | Resolved | Phase 14 added required consent, safe errors, sanitized logs, hourly limit, and cooldown                     | Done       |
| MVP-004 | Production database provider and deployment configuration are not finalized                               | High     | Choose production PostgreSQL provider, configure SSL, migration process, backups, and connection pooling     | Medium     |
| MVP-005 | Dependency audit has moderate advisories in `drizzle-kit`/`esbuild` and `next`/`postcss` dependency trees | Medium   | Track upstream fixes; avoid exposing dev servers; update when compatible versions are available              | Low-medium |

## Non-Blocking Risks

| ID      | Issue                                                                                                 | Severity | Recommendation                                                                                                              | Effort |
| ------- | ----------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| MVP-006 | Database authorization relies on repository scoping, not PostgreSQL RLS                               | Medium   | Keep repository ownership checks; consider portable RLS later using app user context                                        | Medium |
| MVP-007 | Onboarding creates a new career profile/resume on each submission instead of versioning intentionally | Medium   | Add explicit profile revision strategy or update-latest behavior                                                            | Medium |
| MVP-008 | `auth_identities.provider_profile` stores full Supabase claims JSON                                   | Medium   | Store only minimum provider metadata required for support/debugging                                                         | Low    |
| MVP-009 | AI report action returns raw provider error messages to the user                                      | Medium   | Map model/provider errors to safe user-facing messages and log details server-side                                          | Low    |
| MVP-010 | Job matching is deterministic and basic                                                               | Low      | Accept for alpha; label recommendations as early/local matches                                                              | Low    |
| MVP-011 | No automated integration/E2E test suite                                                               | Medium   | Add Playwright smoke tests and repository integration tests against local Postgres                                          | Medium |
| MVP-012 | No analytics or funnel telemetry                                                                      | Medium   | Add privacy-conscious product events for onboarding completion, report generation, job save, and application status changes | Medium |

## Area-by-Area Readiness

### Authentication

Status: alpha-usable with caveats.

Supabase Auth handles sign-up, sign-in, sign-out, callback, and claims. The app now maps Supabase Auth users into app-owned `users` records. The main risk is dependency on Supabase Auth configuration plus lack of rate limiting and limited observability.

### Authorization

Status: acceptable for controlled alpha, not hardened for broad launch.

Domain data access uses repositories scoped by app-owned `userId`. Server actions call `getCurrentAuthUser()` and use that app user ID. However, there is no database-level RLS in the active PostgreSQL schema, so repository discipline is the enforcement point.

### Route Protection

Status: implemented.

Protected routes are guarded by Supabase proxy logic and server-page redirects. `/dashboard`, `/dashboard/jobs`, and `/onboarding` enforce signed-in state. Dashboard routes also enforce completed onboarding.

### Database Schema

Status: solid MVP foundation.

The PostgreSQL-first schema uses app-owned users, auth identities, UUID primary keys, timestamps, foreign keys, and indexes. Remaining risk is that some status fields are plain `text` without check constraints.

### Repository Layer

Status: good MVP direction.

Current MVP domain reads/writes use Drizzle repositories. No direct Supabase domain table access was found in app code. Future work should keep service methods above repositories to avoid server actions becoming business logic containers.

### AI Report Generation

Status: functional but privacy and cost controls are incomplete.

OpenAI is server-side only. Output is validated with Zod. Input context is truncated. Missing: explicit consent, rate limiting, cost tracking, safe error mapping, and model-use telemetry.

### Job Discovery

Status: alpha-usable.

Local seeded jobs, deterministic matching, saved jobs, and application statuses work. The feature is intentionally limited and should be described to users as early local matching.

### Application Tracking

Status: alpha-usable.

Manual status updates are repository-backed and scoped by app user. The current implementation does not yet support notes, deadlines, reminders, or history.

### Error Handling

Status: partial.

User-facing form and server-action errors exist. Centralized error handling and safe provider error normalization are missing.

### Logging

Status: not production-ready.

There is no structured logging, error tracking, audit logging, or security event logging.

### Environment Variables

Status: adequate for local development, incomplete for production.

Templates exist for app URL, Supabase Auth, local Postgres, and OpenAI. Production-specific requirements such as SSL database URLs, deployment secrets, and variable ownership need a checklist.

### Secrets Handling

Status: acceptable locally, production process missing.

No production secret values were found. Local Postgres passwords are intentionally documented. Secret rotation, storage, and deployment procedures need to be defined before real-user alpha.

## Private Alpha Recommendation

Proceed to a very small private alpha only after:

1. Choose and configure a production PostgreSQL provider.
2. Configure production Supabase Auth callback URLs.
3. Configure server-only OpenAI credentials.
4. Run the production-like browser smoke test in `PRODUCTION_CHECKLIST.md`.
5. Confirm structured logs contain no secrets, prompts, resume text, or LinkedIn text.

After those are complete, CareerOS is suitable for a small private alpha of 5-20 trusted users. Keep the alpha small because rate limiting is currently in-process and not distributed across multiple runtime instances.
