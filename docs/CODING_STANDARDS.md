# Coding Standards

## Purpose

These standards define how code should be written in CareerOS. They are aligned to the current stack: Next.js 16, React 19, TypeScript, Tailwind v4, Better Auth, PostgreSQL, Drizzle ORM, and the pluggable model gateway.

## Language

- Use TypeScript for all application code.
- Avoid `any` unless there is a clear boundary with unknown external data.
- Prefer explicit types at API, database, and package boundaries.
- Keep domain names consistent with the architecture docs.

## Naming Conventions

Files and directories:

- Use `kebab-case` for route folders, utility files, and documentation-adjacent files.
- Use `PascalCase` for React component files.
- Use `camelCase` for functions and variables.
- Use `PascalCase` for types, interfaces, and classes.
- Use `SCREAMING_SNAKE_CASE` for environment variable names.

Database:

- Use `snake_case` for table and column names.
- Use plural table names: `profiles`, `resumes`, `applications`.
- Include `created_at` and `updated_at` where records are mutable.

Branches:

- Use `type/short-description`: for example, `feat/niche-validation`.

## Project Boundaries

- `apps/web`: Next.js routes, app shell, server actions, route handlers, and web-specific UI composition.
- `packages/database`: Drizzle schema, migrations, repositories.
- `packages/ui`: reusable presentational components.
- `packages/types`: shared TypeScript contracts.
- `packages/shared`: framework-independent utilities and constants.

Do not put business logic into UI components. Business logic belongs in services and server actions.

## AI Code Standards

- All AI calls go through the model gateway abstraction — never import provider SDKs (OpenAI, Anthropic, etc.) directly in feature code.
- Keep prompt templates versioned and tracked.
- Keep model gateway access server-side.
- Validate structured AI output before storing it (use Zod or equivalent).
- Log model name and operation type metadata, not sensitive raw prompts or user data.
- Do not rely on AI output for authorization or security decisions.
- Never hard-code model-specific assumptions into features — design against the gateway interface.

## Error Handling

- Return user-safe error messages.
- Log operational details server-side only.
- Do not expose secrets, tokens, stack traces, or raw provider payloads to users.
- Handle loading, empty, unauthorized, validation, and failed AI-generation states.

## Security Standards

- Treat resumes, LinkedIn data, salary expectations, goals, applications, and niche validation results as sensitive data.
- Never commit secrets.
- Keep server-only credentials out of client bundles.
- Validate all external input at the server boundary.
- Do not query the database directly from React components — use server actions and repositories.
- Better Auth session must be validated server-side before accessing user-owned data.
- Domain data must always be accessed through repositories scoped by CareerOS app `users.id`.

## Database Standards

- All migrations are committed to `packages/database/migrations`.
- Do not hand-edit Drizzle metadata unless repairing a broken migration state.
- Domain tables reference CareerOS app-owned `users.id`, not auth provider IDs.
- Do not add direct Supabase imports — the active auth is Better Auth.
- New persistence work must go through repositories, not raw Drizzle client calls in route handlers.

## Testing Standards

When tooling exists:

- Unit test pure utilities.
- Integration test database and API behavior.
- Component test important UI states.
- End-to-end test critical journeys.
- Add regression tests for AI output parsers and validators.
- Add integration tests for niche validation logic.
