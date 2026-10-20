# Contributing

## Scope

CareerOS is building toward the Phase 1 MVP. Contributions should support the frozen MVP scope unless an architecture decision record approves otherwise.

The product has a clear identity: Fadi is the entire CareerOS system — not a chatbot widget on a dashboard. Contributions should reinforce this identity, not dilute it.

## Before You Start

1. Check the issue tracker.
2. Confirm the work fits `docs/MVP_SCOPE_FREEZE.md`.
3. Create or update an issue for the change.
4. Create a feature branch from `main`.

## Contribution Types

- Documentation updates.
- Repository foundation improvements.
- Phase 1 application code.
- Tests.
- Infrastructure configuration.
- Security or privacy improvements.

## Pull Request Expectations

Every pull request should:

- Have a clear title.
- Link the relevant issue.
- Explain what changed and why.
- Include screenshots for UI changes.
- Include tests or explain why tests are not applicable.
- Call out security, privacy, AI, and data model implications.
- Not introduce direct model provider SDK imports outside the model gateway abstraction.
- Not introduce new Supabase references.

## Review Standards

Reviewers should check:

- Scope discipline — does this fit Phase 1?
- Correctness.
- Simplicity.
- Security and privacy impact.
- Fadi identity — does this reinforce or dilute Fadi's honest-mentor character?
- Test coverage.
- Naming consistency.
- Whether an ADR is needed.

## When an ADR Is Required

Create an ADR for decisions that affect:

- Frameworks or libraries.
- Database schema direction.
- Authentication.
- AI model gateway or provider behavior.
- Hosting or infrastructure.
- Security posture.
- Repository structure.
- Public API contracts.
- Phase versioning (moving a feature from Phase 2 to Phase 1, or vice versa).

Use the template in `docs/ARCHITECTURE_DECISION_RECORDS.md`.

## Fadi Identity Guardrails

Contributions must not:

- Redesign any screen to treat Fadi as a supplementary feature or chatbot widget.
- Add voice interaction in Phase 1 code (reserved for Phase 2).
- Hard-code model provider assumptions into feature code.
- Add Supabase imports or environment variables back into the active codebase.
- Remove or soften the niche validation honest-mentor behavior.
