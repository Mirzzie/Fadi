# Fadi documentation

This directory describes the product that exists now and the decisions guiding its next changes. Git history is the archive; `docs/` is not a storage area for every proposal, handoff, or completed investigation.

## Start here

1. [Product context](FadiOS-Project-Context.md) — what Fadi is, who it serves, and the product rules.
2. [Architecture](ARCHITECTURE.md) — the current system, trust boundaries, and intended direction.
3. [Data model](DATABASE_SCHEMA.md) — ownership of career records, projections, work, and supporting domains.
4. [UI and UX rules](UI_UX_GUIDELINES.md) — the four destinations and interaction standards.
5. [Roadmap](ROADMAP.md) — current sequence and explicit non-goals.
6. [Technical debt](TECHNICAL_DEBT_REGISTER.md) — known defects and architectural gaps.

## Durable references

| Area | Documents |
|---|---|
| Product doctrine | [Platform ideology](PLATFORM_IDEOLOGY.md), [assumption ledger](ASSUMPTION_LEDGER.md) |
| Data and identity | [PostgreSQL architecture](POSTGRES_FIRST_ARCHITECTURE.md), [data sources](DATA_SOURCES_AND_REALTIME_INTELLIGENCE.md) |
| Portfolio | [Portfolio engine](PORTFOLIO_WEBSITE_ENGINE.md), [ADR 0008](adr/0008-github-portfolio-publishing.md), [ADR 0009](adr/0009-portfolio-hosting-and-static-export.md) |
| Authentication and safety | [Authentication](AUTHENTICATION_ARCHITECTURE.md), [security](SECURITY_AND_COMPLIANCE.md), [agent guardrails](security/AGENT_GUARDRAILS.md) |
| Operations | [Development](DEVELOPMENT_GUIDE.md), [local database](LOCAL_DEVELOPMENT_DATABASE.md), [deployment](INFRASTRUCTURE_AND_DEPLOYMENT.md), [production checklist](PRODUCTION_CHECKLIST.md), [product quality and growth](PRODUCT_QUALITY_STANDARD.md), [MCP](MCP-CONNECT.md) |
| Engineering process | [Contributing](CONTRIBUTING.md), [coding standards](CODING_STANDARDS.md), [Git workflow](GIT_WORKFLOW.md), [ADR index](ARCHITECTURE_DECISION_RECORDS.md) |

## Historical evidence retained on purpose

[Data-flow audit](DATA_FLOW_AUDIT.md) and [architecture assessment](ARCHITECTURE_ASSESSMENT.md) are dated investigations referenced by regression tests and source comments. They are evidence for why safeguards exist, not descriptions of the current system. The claim-oracle fixture under `reviews/2026-09-10-codex-claim-oracle/` is executable test material.

The two current collaboration notes are:

- [Phase 1 work kernel landed](reviews/2026-09-23-claude-phase-1-landed.md)
- [Apply/Prepare, Practice, interview and brand review](reviews/2026-09-23-codex-to-claude-apply-prepare-interview-learning-brand.md)
- [Independent validation of Claude Phase 1](reviews/2026-09-23-codex-validates-claude-phase-1.md)
- [Lab-engine ownership and status](reviews/2026-09-30-claude-codex-lab-engine-plan.md)
- [Industry product-quality handoff](reviews/2026-10-05-codex-to-claude-product-quality.md)

Once their decisions land in code or this canonical documentation, remove the notes.

## Documentation policy

- The schema and code are authoritative for implemented behavior. Documentation explains ownership, invariants, trade-offs, and user-facing intent.
- A proposal belongs in [ROADMAP.md](ROADMAP.md) or an ADR. Do not create a second architecture document for one feature.
- A decision that changes a system boundary needs an ADR. An implementation handoff belongs in a pull request or commit, not permanently in `docs/`.
- Every document must say whether it describes **current**, **target**, or **historical** behavior.
- Update the canonical document in the same commit as an architectural change.
- Delete superseded plans. Git preserves their history.
