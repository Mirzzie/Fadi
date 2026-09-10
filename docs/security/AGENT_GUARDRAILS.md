# Fadi's agent security layer — what exists, what is missing, what unlocks the rest

Written 2026-09-10, against current practice for MCP / tool-calling / agent guardrails.
The mandate: *"VM creation, package installation, anything touching the host filesystem —
this needs to be overcome. will build a security layer for it… and the user knows and sees
every single action done by fadi into host machine and devices connected over the
network."*

## The reference architecture

Current work on pre-action authorisation for autonomous agents converges on four
components between the model and the effect — an **authorisation gateway**, a **policy
engine**, an **execution sandbox**, and an **audit log** — and on one word: *deterministic*.
The decision must be reproducible from rules and parameters, never from the model's
confidence that it is doing the right thing.

The failures it documents are worth naming, because two of them are ours to avoid:

1. Prompt injection arriving **inside tool parameters**, not just in the conversation.
2. Authorisation implemented **only at the UI layer**, bypassed by direct API access.
3. Inconsistent enforcement across integrations.
4. Logging too thin to investigate an incident.

## Where Fadi stands

| Mechanism | Status |
|---|---|
| Authorisation gateway — one interception point | **Have.** `lib/lab/broker.ts`, and a test asserts nothing else in `lib/lab` can execute. |
| Deny by default | **Have.** No grant, no read; no approval, no write. |
| Capability tokens, time- and scope-limited | **Have.** `lab_grants`, expiry in the WHERE clause, revocation by capability. |
| Strict schema validation, no dynamic fields | **Have.** `validate()` per recipe; argv built from validated params, never assembled from input. |
| Allowlist tool registry | **Have.** Fixed capability and recipe catalogues; unknown ones are denied *and logged*. |
| Multi-stage approval for high-risk operations | **Partial.** Every write is approved, but all writes are approved the *same way* — one click, regardless of whether it is `docker stop` or `rm -rf`. |
| Audit of calls, parameters, denials, outcomes | **Have.** `lab_actions` with actor, origin, argv, decision, duration. |
| Immutable / tamper-evident audit trail | **MISSING.** Rows can be edited by anything with database access. |
| Dry-run simulation before confirmation | **MISSING.** The user approves a *description* of the effect, not the effect. |
| Rollback | **MISSING.** `reversal` is a sentence of prose, not an executable undo. |
| Rate limits and quotas | **MISSING.** Nothing stops a hundred approved-looking proposals an hour. |
| Blast-radius / irreversibility classification | **MISSING.** No recipe declares how far its damage reaches. |
| Execution sandbox | **MISSING**, and partly by design — the point is to act on *this* machine. Replaced below by scoping rather than isolation. |
| Egress allowlist for remote resources | **MISSING.** Needed before Proxmox. |

## What has to exist before the restrictions come off

**VM creation, package installation and filesystem writes are not blocked because they are
frightening. They are blocked because five specific controls do not exist yet.** Each one
maps to a thing that can go wrong:

1. **Risk tiers and matching confirmation.** `docker stop` and `pacman -R` must not be
   approved by the same gesture. Irreversible actions get a stronger confirmation (type
   the name), a shorter prompt lifetime, and never a batch approval.

2. **Preflight — show the real effect, not a description.** `pacman -Sp`, `apt-get
   --dry-run`, a name-collision and free-space check before creating a VM. The user
   approves *what will actually change*. This is the single biggest honesty upgrade
   available, and it is also the thing that catches a proposal whose parameters look fine
   and whose effect does not.

3. **A workspace root for filesystem writes.** "Touching the host filesystem" becomes safe
   the moment it is *scoped*: one directory the user nominates, every path canonicalised
   with `realpath` and checked to be inside it, symlinks resolved before the check, no
   exceptions and no escape hatch. Outside it, Fadi has no filesystem.

4. **Real undo.** Every executed action records the inverse as a *recipe and parameters*,
   not prose — so "Undo" proposes the opposite action through the same approval path.
   Where no true undo exists, that is stated plainly instead of implied.

5. **Quotas and a circuit breaker.** A burst of denials is what a compromised model looks
   like; the system should not wait for a human to notice. Repeated denials inside a short
   window revoke every live grant automatically and require fresh consent.

Plus, for the whole thing to be believable:

6. **A tamper-evident log.** Each audit row carries the hash of the one before it. Editing
   history becomes detectable rather than silent, which is what makes "you see every single
   action" a claim rather than a hope.

7. **Egress allowlist.** A remote resource is reachable at exactly the host and port the
   user registered, and nowhere else.

## Remote machines (the Proxmox question)

`192.168.0.56` is a resource like any other, and the model already supports it:
`lab_grants.resource_id` and `lab_actions.resource_id` exist and are matched *exactly*, so
a grant on the laptop is not a grant on the Proxmox node.

Two rules for remote work:

- **API, not SSH.** Proxmox has a REST API with token auth and per-path privileges. A
  token scoped to one node and one pool is a far smaller thing to hold than shell on a
  hypervisor, and it produces structured results that can be shown honestly rather than
  scraped terminal output.
- **The token is a credential, so it is stored encrypted and never rendered into argv,
  never logged, and never sent anywhere but the registered host.**

Read first — list nodes, VMs, storage. Then create, behind the same approval path as
everything else.

## The rule that does not change

A grant widens **what may be asked for**, never **what may be typed**. Every new capability
below is a deliberate edit to a catalogue by a person reading this document. Nothing in
this layer accepts a command from a model, a request body, or a file Fadi read.
