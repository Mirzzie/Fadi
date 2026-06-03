# Production Checklist

## Verdict

CareerOS can proceed to a very small private alpha only after the production-like smoke test passes with real Supabase Auth, production PostgreSQL, and production OpenAI credentials. Phase 14 added the minimum app-level guardrails that were blocking alpha: AI consent, report-generation rate limiting, safer errors, and structured server-action logs.

## Required Before Private Alpha

| Status   | Item                                                          | Owner         | Notes                                         |
| -------- | ------------------------------------------------------------- | ------------- | --------------------------------------------- |
| Not done | Choose production PostgreSQL provider                         | Engineering   | Neon, Supabase Postgres, RDS, or equivalent   |
| Not done | Configure production `DATABASE_URL` with SSL/pooling          | Engineering   | Avoid local Docker credentials                |
| Not done | Run production migrations from `packages/database/migrations` | Engineering   | Document rollback process                     |
| Not done | Configure Supabase Auth project for production domain         | Engineering   | Callback URLs must match deployed app         |
| Not done | Configure `NEXT_PUBLIC_APP_URL`                               | Engineering   | Must be exact production URL                  |
| Not done | Configure `OPENAI_API_KEY` as server-only secret              | Engineering   | Never expose to browser                       |
| Done     | Add rate limiting                                             | Engineering   | Implemented for AI report generation          |
| Deferred | Add external error monitoring                                 | Engineering   | Strongly recommended after first alpha cohort |
| Done     | Add structured logging                                        | Engineering   | Basic redacted server-action logs             |
| Done     | Add AI/privacy consent copy                                   | Product/Legal | Required before report generation             |
| Not done | Add privacy policy and terms                                  | Product/Legal | Required before real users                    |
| Not done | Add backup policy                                             | Engineering   | Provider backups plus restore test            |
| Not done | Run browser E2E smoke test                                    | Engineering   | Sign up, onboarding, report, jobs             |

## Environment Variables

Production required:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Production optional/reserved:

```env
SUPABASE_SERVICE_ROLE_KEY=
JOB_SOURCE_API_KEY=
```

Rules:

- Do not use local Docker Postgres credentials in production.
- Do not expose `OPENAI_API_KEY`, `DATABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Keep `.env.local` out of git.
- Use deployment platform secret storage.

## Database Checklist

| Status       | Item                                  |
| ------------ | ------------------------------------- |
| Done locally | Docker Postgres starts on port `5433` |
| Done locally | Drizzle migrations run                |
| Done locally | Local job seed runs                   |
| Not done     | Production PostgreSQL selected        |
| Not done     | Production migration workflow tested  |
| Not done     | Backup and restore tested             |
| Not done     | Connection pooling configured         |
| Not done     | Production seed policy defined        |

## Auth Checklist

| Status   | Item                                                              |
| -------- | ----------------------------------------------------------------- |
| Done     | Email/password auth implemented with Supabase                     |
| Done     | Server routes redirect unauthenticated users                      |
| Done     | Supabase users map to app-owned `users` through `auth_identities` |
| Not done | Production callback URLs configured and tested                    |
| Partial  | Rate limiting configured for AI report generation                 |
| Not done | Account deletion/export process defined                           |

## AI Checklist

| Status  | Item                                       |
| ------- | ------------------------------------------ |
| Done    | OpenAI SDK used server-side only           |
| Done    | Report response parsed with Zod schema     |
| Done    | API key kept server-only                   |
| Done    | User consent before AI processing          |
| Partial | AI usage/cost controls                     |
| Done    | Provider error sanitization                |
| Partial | Report generation repeated-call guardrails |

Current AI guardrails:

- Required user acknowledgement before report generation.
- In-process per-user rate limit of 3 report attempts per hour.
- Persistent cooldown based on latest saved report: 10 minutes before another report can be generated.
- OpenAI errors are logged internally with sanitized metadata and shown to users as safe generic messages.
- Raw resume, LinkedIn text, prompts, provider keys, and tokens must not be logged.

## Job Discovery Checklist

| Status         | Item                           |
| -------------- | ------------------------------ |
| Done           | Local seeded jobs              |
| Done           | Deterministic matching service |
| Done           | Save/unsave jobs               |
| Done           | Manual application status      |
| Not applicable | External job APIs              |
| Not applicable | Scraping                       |
| Not applicable | Auto-apply                     |

## Production-Like Browser Smoke Test

Run in a production-like environment:

1. Create a new user account.
2. Confirm auth callback redirects correctly.
3. Complete onboarding with resume text and LinkedIn text.
4. Confirm rows in PostgreSQL: `users`, `auth_identities`, `profiles`, `career_profiles`, `resumes`, `linkedin_profiles`.
5. Open the dashboard and confirm the Generate button is disabled until the AI/privacy consent checkbox is accepted.
6. Accept the AI/privacy notice and generate a Career Intelligence Report.
7. Confirm row in `career_reports`.
8. Try to generate another report immediately and confirm cooldown/rate-limit messaging prevents repeated expensive calls.
9. Seed jobs if needed with `npm run db:seed:jobs`.
10. Visit `/dashboard/jobs`.
11. Save a job.
12. Unsave a job.
13. Set application status to `interviewing`.
14. Refresh and confirm state persists.
15. Sign out and confirm protected pages redirect.
16. Review server logs and confirm no secrets, resume text, LinkedIn text, prompts, or provider tokens were logged.

## Go/No-Go Criteria

Go for 5-20 trusted alpha users only when:

- All required checklist items are complete.
- Smoke test passes in production-like environment.
- Basic server logs are available to the operator during the test window.
- OpenAI consent and repeated-call guardrails are active.
- Privacy/AI consent language is visible.
