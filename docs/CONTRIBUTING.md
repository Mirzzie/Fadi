# Contributing

## Scope

CareerOS AI is currently preparing for MVP implementation. Contributions should support the frozen MVP scope unless an architecture decision record approves otherwise.

## Before You Start

1. Check the issue tracker.
2. Confirm the work fits `docs/MVP_SCOPE_FREEZE.md`.
3. Create or update an issue for the change.
4. Create a feature branch from `main`.

## Contribution Types

- Documentation updates
- Repository foundation improvements
- MVP application code once scaffolding begins
- Tests
- Infrastructure configuration
- Security or privacy improvements

## Pull Request Expectations

Every pull request should:

- Have a clear title.
- Link the relevant issue.
- Explain what changed and why.
- Include screenshots for UI changes once UI exists.
- Include tests or explain why tests are not applicable.
- Call out security, privacy, AI, and data model implications.

## Review Standards

Reviewers should check:

- Scope discipline.
- Correctness.
- Simplicity.
- Security and privacy impact.
- Test coverage.
- Naming consistency.
- Whether an ADR is needed.

## When an ADR Is Required

Create an ADR for decisions that affect:

- Frameworks or libraries.
- Database schema direction.
- Authentication.
- AI provider or model behavior.
- Hosting or infrastructure.
- Security posture.
- Repository structure.
- Public API contracts.

Use the template in `docs/ARCHITECTURE_DECISION_RECORDS.md`.

