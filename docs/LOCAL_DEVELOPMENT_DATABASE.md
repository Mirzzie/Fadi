# Local Development Database

## Purpose

CareerOS local development should run against a local PostgreSQL database by default. This makes development faster, repeatable, offline-friendly, and less dependent on a hosted vendor. Production can later use any PostgreSQL-compatible provider.

This document defines the implemented local database foundation introduced in Phase 10 and adopted for MVP domain data access in Phase 11. The existing app still uses Supabase Auth, but onboarding, dashboard profile reads, and Career Intelligence Report persistence now use PostgreSQL through Drizzle repositories.

## Target Local Stack

Recommended:

- Docker Compose.
- PostgreSQL 16 or 17.
- A named Docker volume for persistent local data.
- Drizzle ORM and `drizzle-kit` migrations.
- Optional Adminer, pgAdmin, or Drizzle Studio for inspection.
- `.env.local` pointing to `DATABASE_URL`.

Optional local services later:

- Redis for queues/rate limits.
- MinIO for S3-compatible object storage.
- Mailpit for email testing.
- OpenTelemetry collector for local telemetry.

## Docker Compose

File location:

```text
infrastructure/docker/docker-compose.yml
```

PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: careeros-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: careeros
      POSTGRES_PASSWORD: careeros_dev_password
      POSTGRES_DB: careeros_dev
    ports:
      - "${POSTGRES_HOST_PORT:-5433}:5432"
    volumes:
      - careeros_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U careeros -d careeros_dev"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  careeros_postgres_data:
```

Do not commit real production credentials. Local credentials are intentionally low-risk defaults for developer machines only.

## Environment Variables

Target local database variables:

```env
DATABASE_URL=postgresql://careeros:careeros_dev_password@localhost:5433/careeros_dev
DATABASE_DIRECT_URL=postgresql://careeros:careeros_dev_password@localhost:5433/careeros_dev
POSTGRES_HOST_PORT=5433
```

Recommended future auth variables while Supabase Auth remains temporary:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

After auth decoupling, Supabase variables should move under an optional adapter section:

```env
AUTH_PROVIDER=supabase
SUPABASE_AUTH_URL=
SUPABASE_AUTH_ANON_KEY=
```

## Migration Location

Legacy Supabase migrations remain here until the app has fully moved to PostgreSQL-first data access:

```text
infrastructure/supabase/migrations/
```

PostgreSQL-first Drizzle schema and migrations now live here:

```text
packages/database/src/schema/
packages/database/migrations/
```

This keeps schema, migrations, database client code, and repositories together so future services can import the same package.

## Local Workflow

Available commands:

```bash
npm run db:up
npm run db:migrate
npm run db:seed:jobs
npm run db:studio
npm run db:reset
```

Proposed behavior:

| Command        | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `db:up`        | Start local Postgres with Docker Compose             |
| `db:down`      | Stop local Postgres                                  |
| `db:migrate`   | Apply committed Drizzle migrations                   |
| `db:generate`  | Generate a new Drizzle migration from schema changes |
| `db:seed:jobs` | Insert or update local example MVP jobs              |
| `db:studio`    | Open Drizzle Studio for database inspection          |
| `db:reset`     | Drop the local Postgres volume, restart, and migrate |

## How To Start Local Postgres

From the repository root:

```bash
npm run db:up
```

This starts `careerOS-postgres` as a Docker Compose service using:

```env
DATABASE_URL=postgresql://careeros:careeros_dev_password@localhost:5433/careeros_dev
```

The container name is `careeros-postgres`, and the database is exposed on local port `5433` by default to avoid colliding with an existing local PostgreSQL server. Override `POSTGRES_HOST_PORT` if needed.

## How To Run Migrations

Start Postgres first, then run:

```bash
npm run db:migrate
```

The migration runner lives in `packages/database/src/migrate.ts` and applies committed migrations from:

```text
packages/database/migrations/
```

To generate future migrations after editing `packages/database/src/schema/index.ts`:

```bash
npm run db:generate
```

Review generated SQL before committing it.

## How To Seed Local MVP Jobs

The Phase 12 Job Discovery MVP uses local PostgreSQL data only. It does not call external job APIs, scrape websites, or use OpenAI for job matching.

After migrations are applied, insert example MVP jobs with:

```bash
npm run db:seed:jobs
```

The seed script lives at:

```text
packages/database/src/seeds/mvp-jobs.ts
```

It uses deterministic `source` and `external_id` values, so it can be safely rerun to update the same local seed records.

## How To Inspect The Database

Use Drizzle Studio:

```bash
npm run db:studio
```

Or connect with any PostgreSQL client:

```text
Host: localhost
Port: 5433
Database: careeros_dev
User: careeros
Password: careeros_dev_password
```

## PostgreSQL-First Schema Requirements

Local migrations must:

- Run on vanilla PostgreSQL.
- Avoid `auth.users`.
- Avoid Supabase-only functions such as `auth.uid()`.
- Use `public.users` for application identity.
- Use UUID primary keys.
- Use `jsonb` only where schema churn is expected.
- Use indexes for common user-owned lookups.
- Include foreign keys and check constraints.
- Include timestamps consistently.

## Local Seed Strategy

Seed data should be separate from schema migrations.

Recommended:

```text
packages/database/seeds/dev.ts
packages/database/seeds/demo.ts
```

Seed principles:

- No personal data.
- No real resumes.
- No real LinkedIn profiles.
- Deterministic user IDs for tests.
- Small enough to reset frequently.

## Testing Strategy

Local Postgres enables integration tests that match production behavior.

Recommended layers:

| Test Type                    | Database                      |
| ---------------------------- | ----------------------------- |
| Unit tests                   | No database                   |
| Repository integration tests | Local Postgres test database  |
| Server action/service tests  | Local Postgres test database  |
| E2E tests                    | Local Postgres plus test auth |

Use a separate database for tests:

```env
TEST_DATABASE_URL=postgresql://careeros:careeros_dev_password@localhost:5433/careeros_test
```

## Supabase During Local Development

While Supabase Auth remains temporary, there are two local options:

### Option 1: Hosted Supabase Auth + Local Postgres

Pros:

- Keeps current auth behavior.
- Avoids running full Supabase locally.
- Lets database migration proceed independently.

Cons:

- Requires internet and hosted Supabase credentials.
- Auth identity and local data need mapping.

### Option 2: Full Supabase Local Stack

Pros:

- Closest to current behavior.
- Local auth available.

Cons:

- Keeps Supabase as the center of development.
- Conflicts with the new PostgreSQL-first direction.
- Heavier local environment.

Recommendation:

Use hosted Supabase Auth temporarily only if needed, but run domain data on local PostgreSQL. Do not make the Supabase local stack the default development database.

## Temporary Supabase Auth Mapping

Supabase Auth remains the current authentication provider. PostgreSQL-first domain tables use app-owned user records in `public.users`, not `auth.users`.

The temporary bridge is:

```mermaid
flowchart LR
    SupabaseUser[Supabase Auth user] --> Identity[auth_identities]
    Identity --> AppUser[users]
    AppUser --> DomainRows[profiles, resumes, career_profiles, reports]
```

Mapping rules:

- `auth_identities.provider` is `supabase`.
- `auth_identities.provider_subject` stores the Supabase Auth user ID.
- `auth_identities.user_id` points to the stable CareerOS `users.id`.
- Domain tables always reference `users.id`.
- If CareerOS later moves to better-auth or Auth.js, a new identity provider can map to the same app-owned user record.

The bridge runs in the web app session helper:

```text
apps/web/src/lib/auth/session.ts
```

That helper reads Supabase claims for login/session only, then calls `findOrCreateFromAuthIdentity` in:

```text
packages/database/src/repositories/users.repository.ts
```

After that point, app code receives the app-owned `users.id`. MVP domain operations should not use the Supabase Auth subject as a table owner.

## Current MVP Repository Migration

The following MVP data paths now use Drizzle repositories:

| Flow                             | Repository Layer                                           |
| -------------------------------- | ---------------------------------------------------------- |
| Ensure app-owned user            | `createUsersRepository`                                    |
| Onboarding profile save          | `createProfilesRepository`                                 |
| Career profile save              | `createCareerProfilesRepository`                           |
| LinkedIn text/URL save           | `createLinkedInProfilesRepository`                         |
| Resume text save                 | `createResumesRepository`                                  |
| Dashboard profile summary        | Profile, career profile, LinkedIn, and resume repositories |
| Career report generation context | Profile, career profile, LinkedIn, and resume repositories |
| Career report persistence        | `createCareerReportsRepository`                            |
| Local job discovery              | `createJobsRepository`                                     |
| Saved jobs                       | `createSavedJobsRepository`                                |
| Manual application tracking      | `createApplicationsRepository`                             |

Supabase should now appear only in auth/session/callback/proxy code until the auth provider decision is revisited.

## Current Job Discovery MVP

The first job discovery experience is intentionally local-first:

- Jobs are seeded into `jobs`.
- Recommendations are computed deterministically from target role, location preference, experience level, and profile/resume keywords.
- Saved jobs are stored in `saved_jobs`.
- Manual application statuses are stored in `applications`.
- Supported statuses are `interested`, `applied`, `interviewing`, `offer`, `rejected`, and `withdrawn`.
- External job APIs, scraping, auto-apply, and AI job matching are not implemented in this phase.

## Production Compatibility

Local development should not assume a final production provider.

Production-compatible providers:

- Neon.
- Supabase Postgres.
- AWS RDS PostgreSQL.
- Aurora PostgreSQL.
- Crunchy Bridge.
- Google Cloud SQL PostgreSQL.
- Azure Database for PostgreSQL.

The application should only require:

- PostgreSQL connection string.
- Migration execution.
- SSL configuration in production.
- Backup/restore strategy.
- Connection pooling appropriate to the host.

## Implementation Order

| Order | Task                                 | Complexity  | Notes                          |
| ----- | ------------------------------------ | ----------- | ------------------------------ |
| 1     | Add Docker Compose Postgres          | Low         | No app behavior change         |
| 2     | Add `DATABASE_URL` env docs          | Low         | Keep Supabase env temporarily  |
| 3     | Add Drizzle package                  | Medium      | Requires dependencies later    |
| 4     | Port schema to vanilla PostgreSQL    | Medium      | Replace `auth.users`           |
| 5     | Add migration commands               | Low-medium  | Root package scripts           |
| 6     | Add seed strategy                    | Low-medium  | Use fake data only             |
| 7     | Point repositories to local Postgres | Medium-high | Requires data access migration |

## Local Development Definition Of Done

The local database foundation is complete when:

- A developer can run one command to start PostgreSQL.
- Migrations apply to vanilla PostgreSQL.
- The app can read/write MVP domain data through `DATABASE_URL`.
- Supabase is not required for local domain data.
- Auth provider can be swapped without rewriting domain tables.
- Repository integration tests can run against local Postgres.
