# Production Checklist

## Verdict

CareerOS can proceed to a very small private alpha only after the production-like smoke test passes with Better Auth active, production PostgreSQL, and production OpenAI credentials configured.

## Required Before Private Alpha

| Status | Item | Owner | Notes |
| --- | --- | --- | --- |
| Not done | Choose production PostgreSQL provider | Engineering | Neon, Supabase Postgres (as DB only), RDS, or equivalent |
| Not done | Configure production `DATABASE_URL` with SSL and pooling | Engineering | Avoid local Docker credentials |
| Not done | Run production migrations from `packages/database/migrations` | Engineering | Document rollback process |
| Not done | Configure `NEXT_PUBLIC_APP_URL` | Engineering | Must be exact production URL |
| Not done | Configure `BETTER_AUTH_SECRET` as production server-only secret | Engineering | Strong, unique value |
| Not done | Configure `BETTER_AUTH_URL` for production domain | Engineering | Must match deployed app |
| Not done | Configure `OPENAI_API_KEY` as server-only secret | Engineering | Never expose to browser |
| Done | Add AI report generation rate limiting | Engineering | In-process; upgrade to distributed before wider beta |
| Done | Add structured logging | Engineering | Basic redacted server-action logs |
| Done | Add AI/privacy consent copy | Product | Required before report generation |
| Not done | Add privacy policy and terms of service | Product/Legal | Required before real users |
| Not done | Add backup policy | Engineering | Provider backups plus restore test |
| Not done | Implement niche validation conversation | Product/Engineering | Core of Fadi's Phase 1 identity |
| Not done | Run browser E2E smoke test | Engineering | Sign up, onboarding, report, jobs |

## Environment Variables

Production required:

```env
NEXT_PUBLIC_APP_URL=
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Production optional/reserved:

```env
JOB_SOURCE_API_KEY=
```

Rules:

- Do not use local Docker PostgreSQL credentials in production.
- Do not expose `OPENAI_API_KEY`, `DATABASE_URL`, or `BETTER_AUTH_SECRET` to client code.
- Keep `.env.local` out of git.
- Use deployment platform secret storage (Vercel environment variables, AWS Secrets Manager, etc.).

## Database Checklist

| Status | Item |
| --- | --- |
| Done locally | Docker PostgreSQL starts on port `5433` |
| Done locally | Drizzle migrations run |
| Done locally | Local job seed runs |
| Not done | Production PostgreSQL provider selected |
| Not done | Production migration workflow tested |
| Not done | Backup and restore tested |
| Not done | Connection pooling configured for serverless |
| Not done | Production seed policy defined |

## Auth Checklist

| Status | Item |
| --- | --- |
| Done | Email/password auth implemented (Better Auth) |
| Done | Server routes redirect unauthenticated users |
| Done | Better Auth users map to app-owned `users` through `auth_identities` |
| Not done | Production `BETTER_AUTH_SECRET` configured and rotated |
| Not done | Production callback and redirect URLs configured and tested |
| Partial | Rate limiting configured for AI report generation |
| Not done | Account deletion/export process defined |

## AI Checklist

| Status | Item |
| --- | --- |
| Done | OpenAI SDK used server-side only via model gateway abstraction |
| Done | Report response parsed with Zod schema |
| Done | API key kept server-only |
| Done | User consent before AI processing |
| Done | Provider error sanitization |
| Partial | AI usage/cost controls (in-process rate limit) |
| Partial | Report generation repeated-call guardrails |
| Not done | Niche validation conversation design implemented |

Current AI guardrails:

- Required user acknowledgement before report generation.
- In-process per-user rate limit of 3 report attempts per hour.
- Persistent cooldown based on latest saved report: 10 minutes before another report can be generated.
- OpenAI errors are logged internally with sanitized metadata and shown to users as safe generic messages.
- Raw resume text, LinkedIn text, prompts, provider keys, and tokens must not be logged.

## Job Discovery Checklist

| Status | Item |
| --- | --- |
| Done | Local seeded jobs |
| Done | Deterministic matching service |
| Done | Save/unsave jobs |
| Done | Manual application status |
| Not applicable Phase 1 | External job APIs |
| Not applicable | Scraping |
| Not applicable | Auto-apply |

## Production-Like Browser Smoke Test

Run in a production-like environment:

1. Create a new user account.
2. Confirm Better Auth sign-up redirects correctly.
3. Complete onboarding with resume text and LinkedIn text.
4. Confirm rows in PostgreSQL: `users`, `auth_identities`, `profiles`, `career_profiles`, `resumes`, `linkedin_profiles`.
5. Go through the niche discovery conversation.
6. Open the dashboard and confirm the Generate Report button is disabled until AI/privacy consent is accepted.
7. Accept the AI/privacy notice and generate a Career Intelligence Report.
8. Confirm row in `career_reports`.
9. Try to generate another report immediately and confirm cooldown/rate-limit messaging prevents repeated expensive calls.
10. Seed jobs if needed with `npm run db:seed:jobs`.
11. Visit `/dashboard/jobs`.
12. Save a job.
13. Unsave a job.
14. Set application status to `interviewing`.
15. Refresh and confirm state persists.
16. Sign out and confirm protected pages redirect.
17. Review server logs and confirm no secrets, resume text, LinkedIn text, prompts, or provider tokens were logged.

## Go/No-Go Criteria

Go for 5-20 trusted alpha users only when:

- All required checklist items are complete.
- Smoke test passes in production-like environment.
- Basic server logs are available to the operator during the test window.
- OpenAI consent and repeated-call guardrails are active.
- Privacy/AI consent language is visible before report generation.
- Niche validation conversation is implemented at minimum Phase 1 level.
