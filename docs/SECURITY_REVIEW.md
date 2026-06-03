# Security Review

## Summary

CareerOS has reasonable MVP security foundations for local development and controlled testing: server-side auth checks, app-owned user IDs, repository-scoped data access, and server-only OpenAI calls. Phase 14 added minimum alpha guardrails for AI consent, report-generation rate limiting, safer user-facing errors, and redacted structured logs.

## Findings

| ID      | Area                  | Issue                                                                                                     | Severity | Recommendation                                                                                            | Effort     |
| ------- | --------------------- | --------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| SEC-001 | Rate limiting         | AI report generation now has in-process limits, but auth and job mutations do not have distributed limits | Medium   | Add Redis/provider-backed rate limiting before wider beta                                                 | Medium     |
| SEC-002 | AI privacy            | Report generation now requires just-in-time consent; formal privacy policy still needed                   | Medium   | Add privacy policy and retention/deletion language before broader launch                                  | Medium     |
| SEC-003 | Error disclosure      | AI provider errors are now mapped to safer user-facing messages                                           | Resolved | Continue logging sanitized internal error names only                                                      | Done       |
| SEC-004 | Auth metadata         | Full Supabase claims are stored in `auth_identities.provider_profile`                                     | Medium   | Store minimal metadata: provider, subject, email, email verification, last seen                           | Low        |
| SEC-005 | Authorization         | Active PostgreSQL schema has no RLS                                                                       | Medium   | Keep repository scoping; consider portable RLS using transaction-local app user context                   | Medium     |
| SEC-006 | Secrets process       | No production secret storage/rotation process documented                                                  | Medium   | Add secret ownership, rotation, and environment separation to production checklist                        | Low        |
| SEC-007 | Dependency advisories | `npm audit` reports moderate advisories in build/dev dependency paths                                     | Medium   | Track upstream updates; avoid unsafe dev server exposure                                                  | Low-medium |
| SEC-008 | CSRF posture          | Server actions rely on framework/session behavior; no explicit CSRF review documented                     | Medium   | Verify Next.js server action CSRF behavior and add origin checks where needed                             | Medium     |
| SEC-009 | Audit logging         | No audit/security event logs                                                                              | Medium   | Log auth mapping, report generation, job saves, and application status changes without sensitive payloads | Medium     |
| SEC-010 | Data retention        | No policy for raw resume/LinkedIn text retention                                                          | Medium   | Define retention/deletion policy before real-user alpha                                                   | Medium     |

## Authentication

Supabase Auth handles login/session. Auth pages redirect authenticated users to `/dashboard`. Protected pages redirect unauthenticated users to sign-in. The session helper maps Supabase claims to app-owned users.

Risk: if local PostgreSQL is unavailable, `getCurrentAuthUser()` catches the error and returns `null`, making the app behave as if the user is signed out. This is acceptable for failure safety but needs logging.

## Authorization

MVP domain rows reference app-owned `users.id`. Server actions use `getCurrentAuthUser()` and pass that user ID into repositories. This prevents client-supplied user IDs from driving ownership.

Risk: authorization depends on repository discipline rather than database RLS. Do not add direct SQL access in app routes.

## Route Protection

Protected routes:

- `/dashboard`
- `/dashboard/jobs`
- `/onboarding`

Protection exists in both proxy and server pages. Dashboard routes also enforce completed onboarding.

## Secrets Handling

No production secret values were found in the repository. Local database passwords are present in `.env.example` files and docs by design.

Required before alpha:

- Use deployment-managed secrets.
- Do not commit `.env.local`.
- Rotate OpenAI and Supabase keys if accidentally exposed.
- Remove unused `SUPABASE_SERVICE_ROLE_KEY` from runtime unless needed.

## Hardcoded Secrets Search

Search result:

- No OpenAI API keys found.
- No Supabase service role values found.
- Local PostgreSQL example credentials found in env templates and docs; these are acceptable local-only defaults.

## Direct Supabase Domain Access Search

Search result:

- No direct Supabase domain table access found in `apps/web/src`.
- Supabase usage remains in auth/session/callback/proxy code.
- Legacy Supabase migrations remain under `infrastructure/supabase`.

## Phase 14 Security Guardrails

Added:

- Required AI/privacy checkbox before report generation.
- Server-side AI report rate limit: 3 attempts per user per hour.
- Persistent report cooldown: 10 minutes after latest generated report.
- Sanitized structured logging for report generation, onboarding completion, and job mutations.
- Safer user-facing errors for AI/report and mutation failures.

Known limitation:

- The current rate limiter is in-process. It is acceptable for a single-instance very small alpha, but not sufficient for multi-instance production or broader beta.

## Dependency Audit

`npm audit --audit-level=moderate` found:

- Moderate `esbuild` advisory through `drizzle-kit` dependency chain.
- Moderate `postcss` advisory through `next` dependency chain.

Do not run `npm audit fix --force` blindly; suggested fixes may install breaking or incorrect versions. Track upstream compatible releases.
