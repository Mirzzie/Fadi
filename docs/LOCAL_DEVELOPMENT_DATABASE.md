# Local Development Database

CareerOS runs locally against Docker PostgreSQL. No Supabase credentials are needed for authentication or MVP domain data.

## Stack

- PostgreSQL in Docker Compose
- Drizzle ORM
- Committed migrations in `packages/database/migrations`
- Repository layer in `packages/database/src/repositories`
- Better Auth tables in the same local PostgreSQL database

## Environment

Use this local configuration:

```env
DATABASE_URL=postgres://careeros:careeros@localhost:5433/careeros
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-strong-local-secret
```

AI model gateway (optional until report generation is tested):

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Note: the AI provider is pluggable. The `OPENAI_API_KEY` and model config drive the current OpenAI wiring. When Claude or another provider is configured at the model gateway, update accordingly.

## Commands

```bash
npm run db:up        # Start local Docker PostgreSQL
npm run db:migrate   # Apply Drizzle migrations
npm run db:seed:jobs # Seed sample job data
npm run db:studio    # Open Drizzle Studio
npm run db:down      # Stop local Docker PostgreSQL
npm run db:generate  # Generate new migration after schema changes
```

## Inspect the Database

```bash
docker compose -f infrastructure/docker/docker-compose.yml exec -T postgres \
  psql -U careeros -d careeros
```

Useful checks:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select title, company, status
from jobs
order by created_at desc;
```

## Auth Tables

Better Auth owns credential and session tables:

- `user`
- `session`
- `account`
- `verification`

CareerOS owns domain identity and product data:

- `users`
- `auth_identities`
- `profiles`
- `career_profiles`
- `linkedin_profiles`
- `resumes`
- `career_reports`
- `jobs`
- `saved_jobs`
- `applications`

## Better Auth to App User Mapping

Better Auth `user.id` is an authentication subject. CareerOS domain data is linked to app-owned `users.id`.

```mermaid
flowchart LR
  BAUser[Better Auth user] --> Identity[auth_identities]
  Identity --> AppUser[users]
  AppUser --> Profile[profiles]
  AppUser --> Reports[career_reports]
  AppUser --> SavedJobs[saved_jobs]
  AppUser --> Applications[applications]
```

Mapping rules:

- `auth_identities.provider = 'better_auth'`
- `auth_identities.provider_subject = Better Auth user.id`
- `auth_identities.user_id = users.id`
- Server code calls `getCurrentAuthUser()` and uses the returned app-owned user ID for all domain access.

## Migration Workflow

Update `packages/database/src/schema/index.ts`, then generate and apply:

```bash
npm run db:generate
npm run db:migrate
```

Do not hand-edit generated Drizzle metadata unless repairing a broken migration state.

## Supabase Status

Supabase is no longer required for local development or production. Historical Supabase migrations remain under `infrastructure/supabase/` for reference only and are not the active schema path.
