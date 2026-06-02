# Local Development Database

## Purpose

CareerOS local development should run against a local PostgreSQL database by default. This makes development faster, repeatable, offline-friendly, and less dependent on a hosted vendor. Production can later use any PostgreSQL-compatible provider.

This document defines the target local database setup. It is a plan only; code and infrastructure changes should follow in a later phase.

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

## Proposed Docker Compose

Future file location:

```text
infrastructure/docker/docker-compose.yml
```

Proposed service:

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
      - "5432:5432"
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
DATABASE_URL=postgresql://careeros:careeros_dev_password@localhost:5432/careeros_dev
DATABASE_DIRECT_URL=postgresql://careeros:careeros_dev_password@localhost:5432/careeros_dev
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

Current:

```text
infrastructure/supabase/migrations/
```

Target:

```text
packages/database/src/schema/
packages/database/migrations/
```

Alternative acceptable target:

```text
infrastructure/postgres/migrations/
```

Recommendation:

Use `packages/database` because schema, migrations, and typed database access should travel together when future services need the same schema package.

## Local Workflow

Target commands:

```bash
npm run db:up
npm run db:migrate
npm run db:studio
npm run db:reset
```

Proposed behavior:

| Command       | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `db:up`       | Start local Postgres with Docker Compose          |
| `db:down`     | Stop local Postgres                               |
| `db:migrate`  | Apply committed migrations                        |
| `db:generate` | Generate a new migration from schema changes      |
| `db:studio`   | Open database inspection UI                       |
| `db:reset`    | Drop/recreate local schema and reapply migrations |

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
TEST_DATABASE_URL=postgresql://careeros:careeros_dev_password@localhost:5432/careeros_test
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
