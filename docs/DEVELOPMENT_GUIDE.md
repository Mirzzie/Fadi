# Development Guide

## Purpose

This guide explains how future developers should work in the CareerOS AI repository once implementation begins. The repository currently contains scaffold and documentation only.

## First-Day Onboarding

1. Read `README.md`.
2. Read `docs/MVP_SCOPE_FREEZE.md`.
3. Read `docs/MVP_TECH_STACK.md`.
4. Read `docs/MVP_IMPLEMENTATION_PLAN.md`.
5. Read `docs/CODING_STANDARDS.md`.
6. Read `docs/GIT_WORKFLOW.md`.
7. Review open issues before starting work.

## MVP Engineering Principles

- Build the smallest working version of each MVP feature.
- Prefer boring, reliable technology.
- Keep product behavior explicit and testable.
- Do not add infrastructure before it is needed.
- Do not build future-vision architecture inside MVP code.
- Keep AI usage observable, bounded, and reviewable.
- Protect user career data as sensitive personal data.

## Planned Stack

- Web app: Next.js App Router with TypeScript.
- UI: Tailwind CSS and a small component library.
- Database: Supabase Postgres.
- Auth: Supabase Auth.
- Storage: Supabase Storage.
- Hosting: Vercel.
- AI: OpenAI API behind an internal model client.

## Environment Strategy

Use separate environments:

- `local`: developer machine.
- `preview`: pull request and staging-style deployments.
- `production`: live user environment.

Environment files should not be committed.

Expected future files:

- `.env.local`
- `.env.example`

Rules:

- Commit `.env.example` when implementation begins.
- Never commit secrets.
- Keep public browser-safe values prefixed consistently, such as `NEXT_PUBLIC_`.
- Keep server-only values unprefixed and only read them in server code.
- Rotate credentials after accidental exposure.

## Local Development Expectations

When the app is scaffolded, local setup should eventually include:

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Configure Supabase project values.
4. Run database migrations.
5. Start the local web app.
6. Run tests before opening a pull request.

Do not add these commands until package manifests and tooling exist.

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
- It passes local checks once tooling exists.

