# CareerOS AI

CareerOS AI is an AI-first career operating system. The MVP helps users create an account, complete onboarding, generate a Career Intelligence Report, discover recommended jobs from local seed data, save jobs, and manually track applications.

The current application is PostgreSQL-first and runs locally without Supabase credentials.

## Current Stack

- Next.js App Router with TypeScript
- Tailwind CSS and shadcn-style UI primitives
- Better Auth for email/password authentication
- PostgreSQL for local development and production-compatible persistence
- Drizzle ORM and committed migrations
- OpenAI SDK used server-side for Career Intelligence Reports

## Repository Structure

```text
.
├── apps/
│   └── web/                  # Next.js application
├── docs/                     # Product, architecture, MVP, and engineering docs
├── infrastructure/
│   ├── docker/               # Local PostgreSQL Docker Compose
│   ├── supabase/             # Legacy historical migrations only
│   └── vercel/
├── packages/
│   ├── database/             # Drizzle schema, migrations, repositories, seeds
│   ├── shared/
│   ├── types/
│   └── ui/
├── scripts/
└── tests/
```

## Local Setup

Install dependencies:

```bash
npm install
```

Start local PostgreSQL and apply migrations:

```bash
npm run db:up
npm run db:migrate
npm run db:seed:jobs
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-strong-local-secret
DATABASE_URL=postgres://careeros:careeros@localhost:5433/careeros
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Supabase credentials are no longer required for local authentication or MVP domain data.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Key Docs

- [Authentication Architecture](docs/AUTHENTICATION_ARCHITECTURE.md)
- [Local Development Database](docs/LOCAL_DEVELOPMENT_DATABASE.md)
- [Supabase Decoupling Plan](docs/SUPABASE_DECOUPLING_PLAN.md)
- [MVP Scope Freeze](docs/MVP_SCOPE_FREEZE.md)
- [MVP Implementation Plan](docs/MVP_IMPLEMENTATION_PLAN.md)

## Engineering Rule

Keep the MVP small enough for one developer to operate. New database access should go through repository/service modules, and user-owned domain data should remain linked to the app-owned `users.id`.

