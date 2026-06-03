# Authentication Architecture

## Decision

CareerOS uses Better Auth with Drizzle adapter and PostgreSQL for authentication. This is the active auth stack; Supabase Auth has been removed.

Email/password authentication is enabled for Phase 1. OAuth providers, magic links, email verification sending, and enterprise SSO are intentionally out of scope for Phase 1.

## Runtime Components

```mermaid
flowchart TD
  Form[Sign-in / sign-up form] --> AuthClient[Better Auth React client]
  AuthClient --> AuthRoute[/api/auth/[...all]]
  AuthRoute --> BetterAuth[Better Auth server]
  BetterAuth --> Drizzle[Drizzle adapter]
  Drizzle --> PG[(PostgreSQL)]
  RSC[Protected server pages] --> Session[getCurrentAuthUser]
  Session --> BetterAuth
  Session --> UserRepo[users repository]
  UserRepo --> PG
```

## Tables

Better Auth owns these tables:

- `user`
- `session`
- `account`
- `verification`

CareerOS owns these domain identity tables:

- `users`
- `auth_identities`

Domain tables reference CareerOS `users.id`, not Better Auth `user.id`.

## Session Resolution

`apps/web/src/lib/auth/session.ts` performs the boundary mapping:

1. Read and validate the Better Auth session with `auth.api.getSession`.
2. Require a Better Auth user ID and email.
3. Find or create a CareerOS app-owned `users` record.
4. Link it through `auth_identities` with provider `better_auth`.
5. Return the CareerOS app user ID to all product code (dashboard, onboarding, report, jobs).

Product code never uses the Better Auth user ID directly for domain data access.

## Route Protection

`apps/web/proxy.ts` performs fast cookie-based redirects for:

- `/dashboard`
- `/dashboard/*`
- `/onboarding`
- `/auth/sign-in`
- `/auth/sign-up`

Protected pages still call `getCurrentAuthUser()` server-side before reading user-owned data. The proxy is a UX optimization, not the authorization boundary.

## Redirect Rules

- Unauthenticated users visiting `/dashboard` or `/onboarding` are sent to `/auth/sign-in`.
- Authenticated users visiting auth pages are sent to `/dashboard`.
- Authenticated users without completed onboarding are sent to `/onboarding`.
- Authenticated users with completed onboarding are sent to `/dashboard`.

## Environment Variables

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-strong-secret
DATABASE_URL=postgres://careeros:careeros@localhost:5433/careeros
```

Production must use a strong, unique `BETTER_AUTH_SECRET`. Never use the same secret in development and production.

## Validation

```bash
npm run db:up
npm run db:migrate
npm run lint
npm run typecheck
npm run build
```

Manual smoke path:

1. Create an account at `/auth/sign-up`.
2. Confirm rows exist in `user`, `account`, `users`, and `auth_identities`.
3. Complete onboarding.
4. Confirm domain rows use CareerOS `users.id`.
5. Generate a Career Intelligence Report.
6. View jobs, save a job, update application status.
7. Sign out and sign back in.

## Non-Goals for Phase 1

- OAuth providers (Google, LinkedIn, GitHub)
- Email sending
- Password reset
- Multi-factor authentication
- Enterprise tenant authentication
- External identity provider sync
