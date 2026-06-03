# Technical Debt Register

## Summary

This register tracks MVP technical debt discovered during the Phase 13 stabilization audit. Severity reflects launch risk, not implementation size.

## Debt Items

| ID     | Area           | Issue                                                                        | Severity | Recommendation                                                                                | Effort     |
| ------ | -------------- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ---------- |
| TD-001 | Architecture   | Server actions still contain business workflow logic                         | Medium   | Move onboarding, report generation, and job actions into service modules above repositories   | Medium     |
| TD-002 | Auth           | Supabase Auth is still coupled to route protection and session shape         | Medium   | Keep temporarily; later introduce an `AuthService` interface and evaluate better-auth/Auth.js | Medium     |
| TD-003 | Data integrity | Status fields are plain `text` across several tables                         | Medium   | Add check constraints or Drizzle enum types for profile/report/job/application statuses       | Medium     |
| TD-004 | Data modeling  | Onboarding creates new career profile/resume records on repeated submissions | Medium   | Define explicit revision model or update latest onboarding records                            | Medium     |
| TD-005 | Data modeling  | AI report JSONB fields are flexible but weakly queryable                     | Low      | Keep for MVP; normalize only once report sections stabilize                                   | High       |
| TD-006 | Repositories   | Some repositories expose low-level persistence methods only                  | Medium   | Add service-level use cases such as `completeOnboarding`, `generateReport`, `saveJob`         | Medium     |
| TD-007 | Testing        | No automated integration tests against local Postgres                        | Medium   | Add repository tests using local/test Postgres and seed fixtures                              | Medium     |
| TD-008 | Testing        | No browser E2E tests for auth/onboarding/report/jobs                         | High     | Add Playwright smoke tests for private alpha critical path                                    | Medium     |
| TD-009 | Observability  | No structured logs, trace IDs, or error tracking                             | High     | Add logging wrapper and error monitoring before alpha                                         | Medium     |
| TD-010 | Operations     | No production database migration runbook                                     | High     | Document migration, backup, rollback, and release procedure                                   | Medium     |
| TD-011 | UX             | Dashboard and job status actions rely on simple status text feedback         | Low      | Add clearer optimistic/pending states and persisted state confirmation                        | Low        |
| TD-012 | AI             | Prompt construction lives in server action                                   | Medium   | Move prompt/context assembly into a dedicated AI report service                               | Medium     |
| TD-013 | AI             | No report generation idempotency or in-progress status                       | Medium   | Create draft/generating report row before model call, then update status                      | Medium     |
| TD-014 | Security       | No rate limiting                                                             | High     | Add rate limits for auth-adjacent actions, AI generation, and mutation endpoints              | Medium     |
| TD-015 | Dependencies   | `npm audit` reports moderate advisories                                      | Medium   | Track compatible upstream updates; avoid force downgrade paths                                | Low-medium |

## Cleanup Order

Recommended order before private alpha:

1. TD-014: rate limiting.
2. TD-009: logging/error monitoring.
3. TD-008: browser E2E smoke tests.
4. TD-010: production database runbook.
5. TD-013: report generation status/idempotency.

Recommended order after private alpha:

1. TD-001 and TD-006: service layer extraction.
2. TD-003: enum/check constraints.
3. TD-004: onboarding revision strategy.
4. TD-012: AI report service extraction.
