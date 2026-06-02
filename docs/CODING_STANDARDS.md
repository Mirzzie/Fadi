# Coding Standards

## Purpose

These standards define how code should be written once implementation begins. They are intentionally stack-aligned but do not create application code.

## Language

- Use TypeScript for application code.
- Avoid `any` unless there is a clear boundary with unknown external data.
- Prefer explicit types at API, database, and package boundaries.
- Keep domain names consistent with the MVP docs.

## Naming Conventions

Files and directories:

- Use `kebab-case` for route folders, utility files, and documentation-adjacent files.
- Use `PascalCase` for React component files when components are added.
- Use `camelCase` for functions and variables.
- Use `PascalCase` for types, interfaces, and classes.
- Use `SCREAMING_SNAKE_CASE` for environment variable names.

Database:

- Use `snake_case` for table and column names.
- Use plural table names, such as `profiles`, `resumes`, and `applications`.
- Include `created_at` and `updated_at` where records are mutable.

Branches:

- Use `type/short-description`, such as `feat/profile-onboarding`.

## Project Boundaries

Future code should follow these boundaries:

- `apps/web`: Next.js routes, app shell, server actions, route handlers, and web-specific UI composition.
- `packages/ui`: reusable presentational components.
- `packages/types`: shared TypeScript contracts.
- `packages/shared`: framework-independent utilities and constants.

Do not put business logic into UI components if it belongs in a service or server action.

## AI Code Standards

- Keep prompt templates versioned.
- Keep model client access server-side.
- Validate structured AI output before storing it.
- Log model name and operation metadata, not sensitive raw prompts by default.
- Do not rely on AI output for authorization or security decisions.

## Error Handling

- Return user-safe error messages.
- Log operational details server-side.
- Do not expose secrets, tokens, stack traces, or raw provider payloads to users.
- Handle empty, loading, unauthorized, validation, and failed AI-generation states.

## Security Standards

- Treat resumes, LinkedIn data, salary expectations, goals, and applications as sensitive data.
- Never commit secrets.
- Keep server-only credentials out of client bundles.
- Use row-level security when Supabase tables are created.
- Validate all external input.

## Testing Standards

When tooling exists:

- Unit test pure utilities.
- Integration test database and API behavior.
- Component test important UI states.
- End-to-end test critical journeys.
- Add regression tests for AI output parsers and validators.

