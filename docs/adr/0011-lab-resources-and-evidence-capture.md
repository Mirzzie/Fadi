# 0011 — Lab resources and evidence capture

- **Status:** PROPOSED — 2026-09-10. Nothing in this ADR is built yet.
- **Related:** the admission gate (`lib/identity/admit.ts`, ADR-less, see
  `docs/AGENTIC_LAB_PIVOT_PLAN.md`), the publish gate (migration 0033), and the
  provenance thesis in `docs/PLATFORM_IDEOLOGY.md`.

## Context

Fadi's published portfolio currently shows **16 skills and 8 projects with no artefact
attached**. Those are claims. Warranting theory — already the basis of this platform's
doctrine — says self-generated claims carry near-zero trust, and the market data agrees
from the other direction: 40–80% of applicants now use AI to write their materials, so
prose converges and written claims stop discriminating between candidates.

What remains scarce is evidence that work actually happened.

The user does technical work constantly — TryHackMe rooms, a Proxmox homelab, GitHub
commits, a Raspberry Pi running Nextcloud and n8n. **None of it reaches Fadi.** The
learning section can name a gap and point at a roadmap, and then stops.

## Decision

Introduce **lab resources**: things the user owns that Fadi may read from, and
eventually write to. Then treat evidence capture and lab provisioning as **the same
abstraction at two permission levels**.

```
                      ┌──────────────── resource ────────────────┐
   READ (capture)     │  github · proxmox · thm · drop-zone      │   → artefacts
   WRITE (provision)  │  proxmox · docker host · laptop          │   → environments
                      └──────────────────────────────────────────┘
                                        │
                                   admit()  ← the same gate everything else uses
                                        │
                              evidence → portfolio
```

Capture is read-only and needs no daemon, no root and no new trust story. Provisioning
is the same registry with write scopes added later. One registry, not two features.

### Why capture comes first

Provisioning is the exciting half and produces **nothing** until an agent, a quota
model, a trust story and an update path all work. Capture produces evidence on day one
against sources the user already uses, and it is what proves the loop is worth
automating. If capture does not change how the portfolio reads, provisioning would not
have either.

## Resource model

```
lab_resources
  id, user_id
  kind          laptop | host | hypervisor | cloud | account
  label         "Proxmox box", "ThinkPad", "TryHackMe"
  capability    { containers: bool, vms: bool, cpu, memory_mb, disk_gb }
  scopes        ["read"] | ["read","provision"]
  secret_ct     encrypted, same pattern as the GitHub PAT
  last_seen_at, created_at
```

Five kinds, deliberately including the two that are not servers:

| kind | example | read gives | write gives |
|---|---|---|---|
| `laptop` | ThinkPad + Docker | installed tooling | containers |
| `host` | spare box over SSH | inventory | containers, services |
| `hypervisor` | Proxmox REST | VM/LXC inventory | full labs |
| `cloud` | AWS/GCP free tier | resources in use | time-limited labs |
| `account` | TryHackMe, GitHub | completions, commits | — never |

**`laptop` and `cloud` are first-class from day one.** Building for one user optimises
for that user's hypervisor; most junior IT people have a laptop. A scenario generator
that requires a rack has an addressable market of hobbyists. Scenarios must degrade
honestly — *"on your laptop this is three containers instead of three VMs; here is what
that changes"* — rather than refusing to help.

## Rules for anything touching the user's hardware

1. **Explicit registration.** No discovery, no network scanning. A resource exists
   because the user described it.
2. **Own only what you created.** Every provisioned object carries `fadi-lab:<id>`, and
   Fadi refuses to modify or delete anything without that tag. This is what stops a bug
   from reaching real VMs.
3. **Declarative and reversible.** Labs are a spec, torn down by id — never an
   imperative script someone has to undo by hand.
4. **Quotas before capability.** CPU, memory, disk and lifetime ceilings enforced by
   Fadi, not by the user remembering.
5. **Dry-run by default.** Show the plan, apply on confirmation — the same doctrine as
   the duplicate gate: detect and propose, never act on someone's system unasked.
6. **Read scope until write is earned.** A resource starts read-only. Provisioning is a
   separate, explicit grant.

## Capture sources, in build order

| # | Source | Auth | Yields | New surface |
|---|---|---|---|---|
| 1 | GitHub | the PAT that already exists | repos, commit ranges, languages, dated | none |
| 2 | Drop zone | — | screenshots, configs, diagrams with capture time | upload path exists |
| 3 | Proxmox | read-only API token | what you actually built and still run | one client |
| 4 | TryHackMe / HTB | profile export or paste | completed rooms, dated | parser |

Every one produces `Candidate` records and goes through `admitEvidence` — so a captured
repo that is already in the pool as a hand-written project resolves to it rather than
becoming a duplicate. **No new door.** This is the point of having built the gate first.

Captured evidence carries `origin` values (`github`, `proxmox`, …) that are
machine-authored, so under the two-way rule they never displace wording the user wrote
themselves.

## What a scenario is

Not a tutorial. A scenario is **a gap, matched to an inventory, with a failure injected
and an observable outcome**:

```
gap        "Active Directory / identity"        (from the roadmap the user already sees)
inventory  Proxmox: 32 GB free, nested virt     (from the registry)
scenario   a DC + two workstations; on day two replication breaks
evidence   what existed, what broke, what was run, how long it took
```

The content problem is real and is where TryHackMe wins: they have thousands of
maintained rooms. Fadi cannot out-write them. The escape is that an IT-ops scenario is
**generated against the learner's own inventory**, which no fixed library can do
because it does not know what hardware you have.

## Consequences

- The learning section stops being a roadmap and becomes a loop that ends in evidence.
- Fadi gains a category of evidence it can be **authoritative** about, because the work
  happened in an environment it observed — as opposed to a CV, where it can only take
  the user's word.
- The registry is a new secret store. It must reuse the existing encrypted-at-rest,
  never-redisplayed pattern rather than inventing a second one.
- Provisioning, when it arrives, is a genuinely dangerous capability. It is deferred
  behind rules 1–6 above and behind a working capture loop, on purpose.

## Alternatives rejected

- **Build cybersecurity labs.** TryHackMe, Hack The Box, CyberDefenders and PortSwigger
  own this, several with free tiers. Capture from them instead.
- **Build cloud/DevOps labs.** Killercoda is free and browser-based; KodeKloud has 200+;
  iximiuz goes deeper than we would. Capture instead.
- **Provision first.** Rejected above: months of trust and agent work before anything is
  useful, and no evidence that the loop pays off.
- **A hosted lab fleet.** The reason no IT-ops equivalent exists is that hosting stateful
  fake organisations per learner is expensive. Bringing your own hardware is the whole
  arbitrage; running it ourselves discards it.

## First slice

Resource registry + GitHub capture, read-only, no provisioning:

1. `lab_resources` table and CRUD, secrets encrypted like the PAT.
2. Register a resource by describing it; a read-only probe fills in capability.
3. GitHub capture → `Candidate[]` → `admitEvidence` → evidence pool.
4. The learning roadmap consults the registry and stops proposing labs the user cannot
   run.

Useful on its own even if provisioning is never built — which is the test any first
slice should pass.
