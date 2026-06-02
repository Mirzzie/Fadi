# CareerOS AI

CareerOS AI is an AI-first career operating system. The MVP is intentionally scoped to help the first 100 users authenticate, ingest a profile, upload a resume, import LinkedIn context, receive career analysis, discover recommended jobs, ask an AI career assistant, receive learning recommendations, and track applications.

This repository now contains the Phase 5 MVP application foundation: a Next.js App Router web app, TypeScript configuration, Tailwind CSS, shadcn/ui primitives, Supabase client setup, environment templates, route shells, and monorepo package placeholders. It does not yet contain business logic, AI features, job integrations, or production authentication behavior.

## MVP Stack

The MVP stack is defined in [docs/MVP_TECH_STACK.md](docs/MVP_TECH_STACK.md):

- Next.js App Router with TypeScript
- Tailwind CSS and a small component library
- Supabase Postgres, Auth, and Storage
- Vercel hosting
- OpenAI API behind a model service abstraction
- One compliant job source or curated job import source

## Repository Structure

```text
.
├── .github/
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
├── apps/
│   └── web/
├── docs/
├── infrastructure/
│   ├── supabase/
│   └── vercel/
├── packages/
│   ├── shared/
│   ├── types/
│   └── ui/
├── scripts/
└── tests/
```

## Directory Purpose

- `apps/web`: Next.js MVP application foundation.
- `packages/ui`: future shared UI components package.
- `packages/types`: future shared TypeScript types and contracts package.
- `packages/shared`: future shared utilities package that must stay framework-independent.
- `infrastructure/vercel`: future Vercel configuration and deployment notes.
- `infrastructure/supabase`: future Supabase migrations, policies, and local setup notes.
- `scripts`: future developer and maintenance scripts.
- `tests`: future cross-package and end-to-end test assets.
- `docs`: product, architecture, MVP, and engineering documentation.

## Current Non-Goals

- Do not implement business logic yet.
- Do not create API integrations yet.
- Do not implement AI features yet.
- Do not implement production authentication flows yet.
- Do not implement job integrations yet.
- Do not add autonomous agent features.

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Getting Started

1. Read [docs/MVP_SCOPE_FREEZE.md](docs/MVP_SCOPE_FREEZE.md).
2. Read [docs/MVP_IMPLEMENTATION_PLAN.md](docs/MVP_IMPLEMENTATION_PLAN.md).
3. Read [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).
4. Follow [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) before opening a pull request.

## Engineering Rule

The MVP must stay small enough for one developer to build in 8-12 weeks. Any feature outside the MVP scope must be documented as V2, V3, or Future Vision before implementation.
