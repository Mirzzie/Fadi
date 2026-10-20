# Contributing

## Scope

Fadi is an evolving product. Contributions should follow the current product context and roadmap unless an architecture decision record approves a change in direction.

The product has a clear identity: Fadi is the entire CareerOS system — not a chatbot widget on a dashboard. Contributions should reinforce this identity, not dilute it.

## Before You Start

1. Read `docs/README.md`, `docs/FadiOS-Project-Context.md`, and `docs/ROADMAP.md`.
2. Check the issue tracker and current work to avoid overlapping ownership.
3. Create or update an issue for the change when the repository workflow requires one.
4. Create a focused branch from the agreed base.

## Contribution Types

- Documentation updates.
- Repository foundation improvements.
- Product application code.
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

- Scope discipline — does this serve the active roadmap and one coherent user lifecycle?
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
- A change to the accepted roadmap sequence or product boundary.

Use the template in `docs/ARCHITECTURE_DECISION_RECORDS.md`.

## Fadi Identity Guardrails

Contributions must not:

- Redesign any screen to treat Fadi as a supplementary feature or chatbot widget.
- Build voice as a surface of the same work-scoped agent, not as a separate assistant.
- Hard-code model provider assumptions into feature code.
- Add Supabase imports or environment variables back into the active codebase.
- Remove or soften the niche validation honest-mentor behavior.
