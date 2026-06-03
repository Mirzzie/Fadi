# Production Checklist

## Verdict

CareerOS should not be opened to real users until the required items are complete. The current MVP is suitable for local development and internal demos.

## Required Before Private Alpha

| Status   | Item                                                          | Owner         | Notes                                                  |
| -------- | ------------------------------------------------------------- | ------------- | ------------------------------------------------------ |
| Not done | Choose production PostgreSQL provider                         | Engineering   | Neon, Supabase Postgres, RDS, or equivalent            |
| Not done | Configure production `DATABASE_URL` with SSL/pooling          | Engineering   | Avoid local Docker credentials                         |
| Not done | Run production migrations from `packages/database/migrations` | Engineering   | Document rollback process                              |
| Not done | Configure Supabase Auth project for production domain         | Engineering   | Callback URLs must match deployed app                  |
| Not done | Configure `NEXT_PUBLIC_APP_URL`                               | Engineering   | Must be exact production URL                           |
| Not done | Configure `OPENAI_API_KEY` as server-only secret              | Engineering   | Never expose to browser                                |
| Not done | Add rate limiting                                             | Engineering   | Auth, AI generation, mutations                         |
| Not done | Add error monitoring                                          | Engineering   | Sentry, Axiom, Highlight, or equivalent                |
| Not done | Add structured logging                                        | Engineering   | Avoid logging PII/prompt payloads                      |
| Not done | Add AI/privacy consent copy                                   | Product/Legal | Required before sending resume/LinkedIn text to OpenAI |
| Not done | Add privacy policy and terms                                  | Product/Legal | Required before real users                             |
| Not done | Add backup policy                                             | Engineering   | Provider backups plus restore test                     |
| Not done | Run browser E2E smoke test                                    | Engineering   | Sign up, onboarding, report, jobs                      |

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
| Not done | Rate limiting configured                                          |
| Not done | Account deletion/export process defined                           |

## AI Checklist

| Status   | Item                                          |
| -------- | --------------------------------------------- |
| Done     | OpenAI SDK used server-side only              |
| Done     | Report response parsed with Zod schema        |
| Done     | API key kept server-only                      |
| Not done | User consent before AI processing             |
| Not done | AI usage/cost tracking                        |
| Not done | Provider error sanitization                   |
| Not done | Report generation idempotency/status handling |

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

## Manual Alpha Smoke Test

Run in a production-like environment:

1. Create a new user account.
2. Confirm auth callback redirects correctly.
3. Complete onboarding with resume text and LinkedIn text.
4. Confirm rows in PostgreSQL: `users`, `auth_identities`, `profiles`, `career_profiles`, `resumes`, `linkedin_profiles`.
5. Generate Career Intelligence Report.
6. Confirm row in `career_reports`.
7. Seed jobs if needed with `npm run db:seed:jobs`.
8. Visit `/dashboard/jobs`.
9. Save a job.
10. Unsave a job.
11. Set application status to `interviewing`.
12. Refresh and confirm state persists.
13. Sign out and confirm protected pages redirect.

## Go/No-Go Criteria

Go for 5-20 trusted alpha users only when:

- All required checklist items are complete.
- Smoke test passes in production-like environment.
- Error monitoring is active.
- OpenAI cost and abuse limits are in place.
- Privacy/AI consent language is visible.
