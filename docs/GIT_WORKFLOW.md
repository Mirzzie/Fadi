# Git Workflow

## Branch Strategy

`main` is the protected production branch.

Use short-lived branches:

- `docs/update-scope-freeze`
- `feat/profile-onboarding`
- `fix/resume-upload-validation`
- `chore/update-tooling`
- `test/application-tracker`
- `infra/supabase-migrations`

## Commit Conventions

Use Conventional Commits:

- `feat: add profile onboarding shell`
- `fix: handle failed resume parsing`
- `docs: add MVP scope freeze`
- `chore: configure lint tooling`
- `test: add application tracker coverage`
- `refactor: simplify job matching service`
- `infra: add supabase migration notes`

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
3. Run local checks once tooling exists.
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

## Release Tags

Use semantic tags once the app exists:

- `v0.1.0`: internal MVP baseline.
- `v0.2.0`: private beta.
- `v1.0.0`: public MVP launch.

## Protected Branch Rules

Recommended once hosted:

- Require pull request before merge.
- Require status checks.
- Require conversation resolution.
- Require signed commits if the team chooses.
- Block force pushes to `main`.

