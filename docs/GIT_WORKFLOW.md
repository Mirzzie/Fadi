# Git Workflow

## Branch Strategy

`main` is the protected production branch.

Use short-lived branches:

- `docs/update-fadi-vision`
- `feat/niche-validation-conversation`
- `fix/resume-upload-validation`
- `chore/update-tooling`
- `test/application-tracker`
- `infra/postgres-migration`
- `phase2/voice-interaction`

## Commit Conventions

Use Conventional Commits:

- `feat: add niche validation conversation design`
- `fix: handle failed resume parsing`
- `docs: update Fadi persona design`
- `chore: configure lint tooling`
- `test: add application tracker coverage`
- `refactor: extract career intelligence service`
- `infra: add PostgreSQL migration notes`

Allowed types:

- `feat`
- `fix`
- `docs`
- `chore`
- `test`
- `refactor`
- `infra`
- `security`

## Pull Request Flow

1. Create a branch from `main`.
2. Make focused changes.
3. Run local checks: `npm run lint`, `npm run typecheck`, `npm run build`.
4. Update docs when behavior or setup changes.
5. Open a pull request using the template.
6. Address review comments.
7. Squash or merge according to maintainer preference.

## Scope Control

If a change expands the MVP scope, it must include:

- Clear business justification.
- Complexity estimate.
- Deferral analysis.
- ADR if architectural.

Voice interaction is reserved for Phase 2. Do not merge Phase 2 features into Phase 1 without an explicit decision.

## Release Tags

- `v0.1.0`: Phase 1 internal baseline.
- `v0.2.0`: private alpha.
- `v1.0.0`: Phase 1 public launch.
- `v2.0.0`: Phase 2 (voice, resume tailoring, real-time job APIs).

## Protected Branch Rules

Recommended once hosted:

- Require pull request before merge.
- Require status checks.
- Require conversation resolution.
- Block force pushes to `main`.
