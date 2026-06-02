# CareerOS AI

CareerOS AI is an AI-first career operating system. The MVP is intentionally scoped to help the first 100 users authenticate, ingest a profile, upload a resume, import LinkedIn context, receive career analysis, discover recommended jobs, ask an AI career assistant, receive learning recommendations, and track applications.

This repository is currently in the repository foundation phase. It contains documentation, process standards, and directory scaffolding only. It does not yet contain application code, package manifests, API integrations, or a generated Next.js app.

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

- `apps/web`: future Next.js application. Empty until the app is intentionally scaffolded.
- `packages/ui`: future shared UI components.
- `packages/types`: future shared TypeScript types and contracts.
- `packages/shared`: future shared utilities that are framework-independent.
- `infrastructure/vercel`: future Vercel configuration and deployment notes.
- `infrastructure/supabase`: future Supabase migrations, policies, and local setup notes.
- `scripts`: future developer and maintenance scripts.
- `tests`: future cross-package and end-to-end test assets.
- `docs`: product, architecture, MVP, and engineering documentation.

## Current Non-Goals

- Do not create the Next.js app yet.
- Do not install packages yet.
- Do not implement business logic yet.
- Do not build screens yet.
- Do not create API integrations yet.
- Do not add autonomous agent features.

## Getting Started

1. Read [docs/MVP_SCOPE_FREEZE.md](docs/MVP_SCOPE_FREEZE.md).
2. Read [docs/MVP_IMPLEMENTATION_PLAN.md](docs/MVP_IMPLEMENTATION_PLAN.md).
3. Read [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).
4. Follow [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) before opening a pull request.

## Engineering Rule

The MVP must stay small enough for one developer to build in 8-12 weeks. Any feature outside the MVP scope must be documented as V2, V3, or Future Vision before implementation.

