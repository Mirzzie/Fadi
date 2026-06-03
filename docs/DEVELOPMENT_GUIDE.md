# Development Guide

## Purpose

This guide explains how developers should work in the CareerOS repository. The repository contains the Phase 1 MVP application foundation built on Next.js 16, Better Auth, PostgreSQL, and Drizzle ORM.

## First-Day Onboarding

1. Read `README.md`.
2. Read `docs/MVP_SCOPE_FREEZE.md`.
3. Read `docs/MVP_TECH_STACK.md`.
4. Read `docs/MVP_IMPLEMENTATION_PLAN.md`.
5. Read `docs/CODING_STANDARDS.md`.
6. Read `docs/GIT_WORKFLOW.md`.
7. Read `docs/LOCAL_DEVELOPMENT_DATABASE.md`.
8. Review open issues before starting work.

## MVP Engineering Principles

- Build the smallest working version of each MVP feature.
- Prefer boring, reliable technology.
- Keep product behavior explicit and testable.
- Do not add infrastructure before it is needed.
- Do not build future-vision architecture inside MVP code.
- Keep AI usage observable, bounded, and reviewable.
- Protect user career data as sensitive personal data.
- Kai is the product — design features from the user's perspective of interacting with Kai, not a generic dashboard.

## Current Stack

- **Web app**: Next.js 16 App Router with TypeScript.
- **UI**: Tailwind v4, shadcn/ui.
- **Database**: PostgreSQL (Docker locally), Drizzle ORM.
- **Migrations**: `drizzle-kit`, committed to `packages/database/migrations`.
- **Auth**: Better Auth with Drizzle adapter.
- **AI**: Pluggable model gateway — currently OpenAI SDK.
- **Hosting**: Vercel (Next.js).

## Environment Strategy

Use separate environments:

- `local`: developer machine.
- `preview`: pull request and staging deployments.
- `production`: live user environment.

Environment files must not be committed.

Expected files:

- `.env.local`
- `.env.example`

Rules:

- Keep `.env.example` updated when environment requirements change.
- Never commit secrets.
- Keep public browser-safe values prefixed with `NEXT_PUBLIC_`.
- Keep server-only values unprefixed and only read them in server code.
- Rotate credentials after accidental exposure.

Environment variables required:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-strong-secret
DATABASE_URL=postgres://careeros:careeros@localhost:5433/careeros
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Production must use a strong unique `BETTER_AUTH_SECRET` and SSL-enabled `DATABASE_URL`.

## Local Development Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Configure environment values.
4. Start local PostgreSQL with Docker.
5. Run database migrations.
6. Start the local web app.
7. Run checks before opening a pull request.

Commands:

```bash
npm install
npm run db:up
npm run db:migrate
npm run dev
npm run lint
npm run typecheck
npm run build
```

See `docs/LOCAL_DEVELOPMENT_DATABASE.md` for full database setup and inspection commands.

## AI-Assisted Development Rules

- AI may help draft code, tests, docs, and refactors.
- Developers remain responsible for correctness, security, and maintainability.
- Do not paste production secrets or private user data into AI tools.
- Do not accept AI-generated code without reading it.
- Add tests for AI-generated logic.
- Keep AI prompts and model behavior versioned when they affect product output.
- Do not use AI to bypass license, platform, or data access restrictions.

## Definition of Done

A change is done when:

- It fits the MVP scope or has an approved ADR.
- It has appropriate tests.
- It handles loading, empty, error, and unauthorized states where applicable.
- It does not leak secrets or sensitive user data.
- It is documented if it changes architecture, setup, or workflow.
- It passes local checks (`lint`, `typecheck`, `build`).
- It does not introduce new direct database access outside of repositories and server actions.
- It does not hard-code model provider assumptions.
