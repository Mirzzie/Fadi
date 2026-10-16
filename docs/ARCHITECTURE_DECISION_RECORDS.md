# Architecture decision records

ADRs capture durable decisions that affect ownership, trust boundaries, storage, delivery, or external contracts. Use the template below for new decisions and update this index when one lands.

## Current records

| ADR | Decision | Status |
|---|---|---|
| [0006](adr/0006-in-process-domain-event-bus.md) | In-process domain event bus | Accepted; durable outbox remains roadmap work |
| [0007](adr/0007-data-retention-and-erasure.md) | Data retention and erasure | Accepted |
| [0008](adr/0008-github-portfolio-publishing.md) | GitHub portfolio publishing | Accepted |
| [0009](adr/0009-portfolio-hosting-and-static-export.md) | Portfolio hosting and static export | Accepted |
| [0010](adr/0010-reactive-resume-editor-adoption.md) | Reactive résumé editor adoption | Accepted |
| [0011](adr/0011-lab-resources-and-evidence-capture.md) | Lab resources and evidence capture | Accepted |
| [0012](adr/0012-local-machine-permission-broker.md) | Local machine permission broker | Accepted |
| [0013](adr/0013-unified-work-surface-and-multimodal-agent-runtime.md) | Unified work surface and multimodal agent runtime | Proposed |

The earlier framework, auth, ORM, provider, and PostgreSQL decisions predate the numbered files. Their current state is documented in [Architecture](ARCHITECTURE.md), [Authentication](AUTHENTICATION_ARCHITECTURE.md), and [PostgreSQL architecture](POSTGRES_FIRST_ARCHITECTURE.md). Create a retrospective ADR only when a new decision changes one of them.

## Required next decisions

Write an ADR before landing:

- a transactional outbox and its delivery guarantees;
- a unified Realtime voice transport and audio-retention policy (ADR 0013 defines the worker boundary, not transport or retention);
- a general capability/approval policy beyond the lab broker;
- social publishing connections and token custody;
- a new hypervisor provider contract;
- a split from the modular monolith into a separate service.

## Template

```markdown
# ADR 0013: Decision title

**Status:** Proposed | Accepted | Rejected | Superseded | Deprecated
**Date:** YYYY-MM-DD

## Context

What problem and constraints require a durable decision?

## Decision

What boundary, contract, or technology will we adopt?

## Alternatives considered

What viable alternatives were rejected, and why?

## Consequences

What improves, what becomes harder, and what must change?

## Verification and review

How is the decision enforced, and when should it be revisited?
```
