# Supabase Database Setup (Historical Reference Only)

## Status

This document is HISTORICAL REFERENCE ONLY. It is not the active database setup path.

CareerOS no longer uses Supabase for authentication or domain data access. The active stack is:

- **Authentication**: Better Auth with Drizzle adapter
- **Database**: PostgreSQL (Docker locally, managed provider for production)
- **ORM**: Drizzle ORM
- **Migrations**: Committed to `packages/database/migrations/`

For the current local development database setup, see `docs/LOCAL_DEVELOPMENT_DATABASE.md`.

For the current authentication architecture, see `docs/AUTHENTICATION_ARCHITECTURE.md`.

For the current production checklist, see `docs/PRODUCTION_CHECKLIST.md`.

## Why This Document Exists

This file documents the earlier Supabase-based database setup that was used before the PostgreSQL-first migration. It is retained for historical context and to explain the migration path.

Do not follow these instructions for active development. They reference a deprecated architecture.

## What Has Changed

Removed active Supabase runtime dependencies:

- `@supabase/ssr`
- `@supabase/supabase-js`
- Supabase server/browser/proxy helpers
- Supabase auth callback route
- Supabase `auth.users` references in migrations
- Supabase `auth.uid()` RLS policies
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables

The legacy Supabase migration files remain under `infrastructure/supabase/migrations/` for historical reference. They are not the active schema path and should not be applied to the current local or production PostgreSQL instance.

## Active Migration Path

```text
packages/database/migrations/
```

Apply with:

```bash
npm run db:up
npm run db:migrate
```

## Active Schema Definition

```text
packages/database/src/schema/index.ts
```

## Guardrails

- Do not add new imports from `@supabase/*`.
- Do not add Supabase environment variables back to app templates.
- Do not reference `auth.users` or `auth.uid()` in any new migrations.
- Do not link domain data to Better Auth `user.id` directly — always go through `auth_identities`.
- If Supabase is ever reconsidered, treat it as a PostgreSQL hosting provider only, not as an application architecture dependency.
