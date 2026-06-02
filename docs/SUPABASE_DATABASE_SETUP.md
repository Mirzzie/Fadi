# Supabase Database Setup

## Purpose

This guide explains how to apply the CareerOS AI MVP database foundation. The migration creates the secure data model for onboarding, resume upload, LinkedIn profile storage, Career Intelligence Reports, user-owned jobs, saved jobs, application tracking, learning recommendations, and assistant messages.

## Migration Location

```text
infrastructure/supabase/migrations/
└── 20260602224500_create_mvp_foundation.sql
└── 20260602231500_add_experience_level_to_career_profiles.sql
```

## Tables Created

- `profiles`
- `career_profiles`
- `resumes`
- `linkedin_profiles`
- `career_reports`
- `jobs`
- `saved_jobs`
- `applications`
- `learning_recommendations`
- `agent_messages`

## Security Model

Every MVP table has Row Level Security enabled.

User-owned records use:

```sql
user_id uuid not null references auth.users(id) on delete cascade
```

RLS policies use:

```sql
auth.uid()
```

This means authenticated users can only select, insert, update, or delete their own records. The MVP `jobs` table is intentionally user-owned so discovered or imported opportunities cannot leak between users. A global jobs catalog can be added later as a separate table with different policies.

## Local Setup

Install the Supabase CLI if it is not already installed:

```bash
npm install -g supabase
```

Initialize Supabase locally from the repository root if needed:

```bash
supabase init
```

Copy or keep the migration in:

```text
supabase/migrations/
```

If using this repository's current infrastructure folder directly, run commands with the migration path copied into Supabase's expected local folder. The repository stores migrations under `infrastructure/supabase/migrations/` to keep infrastructure assets grouped.

Start local Supabase:

```bash
supabase start
```

Apply migrations locally:

```bash
supabase db reset
```

Alternatively, apply the SQL manually in Supabase Studio SQL editor for a local project.

## Remote Setup

Log in:

```bash
supabase login
```

Link the project:

```bash
supabase link --project-ref your-project-ref
```

Apply migrations remotely:

```bash
supabase db push
```

If you are not using the Supabase CLI migration folder, open the Supabase Dashboard SQL Editor and run:

```text
infrastructure/supabase/migrations/20260602224500_create_mvp_foundation.sql
```

## Environment Variables

The web app needs these values in `apps/web/.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is listed in the template for future server-only admin operations. Do not expose it to the browser and do not use it for normal user flows.

## Validation Checklist

After applying the migration:

1. Confirm all ten tables exist in the `public` schema.
2. Confirm RLS is enabled on all ten tables.
3. Confirm policies exist for each table.
4. Confirm inserts fail when unauthenticated.
5. Confirm authenticated users can only read rows with their own `user_id`.
6. Confirm `updated_at` changes after updating a mutable row.

Example policy check:

```sql
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Example RLS check:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'career_profiles',
    'resumes',
    'linkedin_profiles',
    'career_reports',
    'jobs',
    'saved_jobs',
    'applications',
    'learning_recommendations',
    'agent_messages'
  )
order by tablename;
```

## Seed Data

No seed data is included in this phase. The schema references `auth.users`, so safe seed data requires a real or local authenticated test user. If seed data is added later, place it in a clearly separated seed file and never include personal user data.

## Current Non-Goals

- No UI forms are connected to the database yet.
- No AI report generation is implemented.
- No job integrations are implemented.
- No storage buckets are created in this migration.
- No global job catalog is created.
