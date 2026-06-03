# Security Review

## Summary

CareerOS has reasonable Phase 1 security foundations for local development and controlled alpha testing: server-side Better Auth session checks, app-owned user IDs, repository-scoped data access, and server-only AI model gateway calls. Phase 14 added minimum alpha guardrails for AI consent, report-generation rate limiting, safer user-facing errors, and redacted structured logs.

## Findings

| ID | Area | Issue | Severity | Recommendation | Effort |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Rate limiting | AI report generation has in-process limits; auth and job mutations do not have distributed limits | Medium | Add Redis or provider-backed rate limiting before wider beta | Medium |
| SEC-002 | AI privacy | Report generation requires just-in-time consent; formal privacy policy still needed | Medium | Add privacy policy and retention/deletion language before broader launch | Medium |
| SEC-003 | Error disclosure | AI provider errors now mapped to safer user-facing messages | Resolved | Continue logging sanitized internal error names only | Done |
| SEC-004 | Auth metadata | Full Better Auth claims are stored in `auth_identities.provider_profile` | Medium | Store minimal metadata: provider, subject, email, verification status, last seen | Low |
| SEC-005 | Authorization | Active PostgreSQL schema has no RLS | Medium | Keep repository scoping; consider portable RLS using transaction-local app user context | Medium |
| SEC-006 | Secrets process | No production secret storage/rotation process documented | Medium | Add secret ownership, rotation, and environment separation to production checklist | Low |
| SEC-007 | Dependency advisories | `npm audit` reports moderate advisories in build/dev dependency paths | Medium | Track upstream updates; avoid unsafe dev server exposure | Low-medium |
| SEC-008 | CSRF posture | Server actions rely on framework/session behavior; no explicit CSRF review documented | Medium | Verify Next.js server action CSRF behavior and add origin checks where needed | Medium |
| SEC-009 | Audit logging | No audit/security event logs | Medium | Log auth mapping, report generation, job saves, and application status changes without sensitive payloads | Medium |
| SEC-010 | Data retention | No policy for raw resume/LinkedIn text retention | Medium | Define retention/deletion policy before real-user alpha | Medium |

## Authentication

Better Auth handles login and session management. Auth pages redirect authenticated users to `/dashboard`. Protected pages redirect unauthenticated users to sign-in. The session helper maps Better Auth claims to app-owned users via `auth_identities`.

Risk: if local PostgreSQL is unavailable, `getCurrentAuthUser()` catches the error and returns `null`, making the app behave as if the user is signed out. This is acceptable for failure safety but needs operational logging.

## Authorization

Domain rows reference app-owned `users.id`. Server actions use `getCurrentAuthUser()` and pass that user ID into repositories. This prevents client-supplied user IDs from driving ownership.

Risk: authorization depends on repository discipline rather than database RLS. Do not add direct SQL access in route handlers or React components.

## Route Protection

Protected routes:

- `/dashboard`
- `/dashboard/jobs`
- `/onboarding`

Protection exists in both proxy and server pages. Dashboard routes also enforce completed onboarding.

## Secrets Handling

No production secret values were found in the repository. Local database passwords are present in `.env.example` files and docs by design — these are acceptable local-only defaults.

Required before alpha:

- Use deployment-managed secrets.
- Do not commit `.env.local`.
- Rotate OpenAI keys if accidentally exposed.
- Use a strong, unique `BETTER_AUTH_SECRET` in production.

## Sensitive Content Search

Search results:

- No OpenAI API keys found in code.
- No production secrets found.
- Local PostgreSQL example credentials found in env templates — acceptable.
- No direct Supabase domain table access found in `apps/web/src`.
- No active Supabase references outside historical files.

## Phase 14 Security Guardrails

Added:

- Required AI/privacy checkbox before report generation.
- Server-side AI report rate limit: 3 attempts per user per hour.
- Persistent report cooldown: 10 minutes after latest generated report.
- Sanitized structured logging for report generation, onboarding completion, and job mutations.
- Safer user-facing errors for AI/report and mutation failures.

Known limitation:

- The current rate limiter is in-process. Acceptable for single-instance very small alpha; not sufficient for multi-instance production or broader beta. Upgrade to Redis-backed or provider-level rate limiting before wider launch.

## Dependency Audit

`npm audit --audit-level=moderate` found:

- Moderate `esbuild` advisory through `drizzle-kit` dependency chain.
- Moderate `postcss` advisory through `next` dependency chain.

Do not run `npm audit fix --force` blindly — suggested fixes may install breaking or incorrect versions. Track upstream compatible releases.
