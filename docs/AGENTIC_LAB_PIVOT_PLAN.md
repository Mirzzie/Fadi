# Plan — the one gateway, then the Agentic Career OS

Written 10 September 2026. Supersedes nothing; sits beside `HANDOFF.md`.

---

## Part 1 — The gateway (built)

### The rule

**Every new career record is admitted, never inserted.** One function decides whether a
candidate is new or something you already have wearing different words.

```
                    ┌──────────────────────────────────┐
  CV / DOCX / PDF ─▶│                                  │
  LinkedIn        ─▶│   admit()                        │──▶ create   (genuinely new)
  Extension       ─▶│   lib/identity/admit.ts          │
  Manual form     ─▶│                                  │──▶ absorb   (same fact,
  Learning done   ─▶│   resolve → same | maybe | new   │             new wording kept,
  Portfolio seed  ─▶│                                  │             splittable)
  Portfolio sync  ─▶└──────────────────────────────────┘
  JSON import     ─▶
```

### Why "maybe" absorbs

Measured on real data: **every genuine duplicate scored `maybe`, never `same`.** The old
rule created on a maybe, so the permissive branch wasn't an edge case — it was the entire
failure.

The two errors are not symmetric:

| | cost of being wrong |
|---|---|
| absorb wrongly | one click to split; every word kept |
| create wrongly | two copies of one project in the résumé, the portfolio, and every generated document — findable only by a check someone remembers to run |

### Why it is safe to be strict

Strictness is only safe because a wrong guess **surfaces itself**. An uncertain absorption
is stamped `unconfirmed-auto-link` at the moment it is made, and the background pass raises
*"Is X the same as Y?"* in the activity centre. Nobody goes looking.

### What enforces it

`lib/identity/gate.test.ts` greps the source for raw repository writes and fails on any
caller not on an explicit allow-list. Verified to actually fail: a probe file with a
bypass turned the suite red, and removing it turned it green.

This exists because the audit found seven doors, and grepping afterwards found an eighth
and ninth in the interview code. A rule kept by discipline is kept until someone is busy.

### The two-way route

The gate answers "is this new?". A round-trip needs a second question — **"is this an
update?"** — and without it the gate was actively harmful in one direction: sharpen a
description in M365, bring it back, and it was filed as a non-leading rewording. Stored,
and invisible, while the older wording carried on leading everywhere.

**Fadi is the system of record. Everything else is an editing surface.** That framing is
deliberate, and it is not the same as two-way sync — there is no live connection to M365,
no background reconciliation, no merge algorithm. There is one record, many places you
can edit it, and recognition when an edit comes home.

The deciding input is **who wrote this version**:

| incoming | currently leading | outcome |
|---|---|---|
| a person (upload, manual, extension) | a model (`ai`, `learning`) | **update** — the new version leads, the old one is demoted, not deleted |
| a model | anything | absorb — extraction never displaces your words |
| a person | a person, same text | absorb, nothing to decide |
| a person | a person, different text | absorb + **conflict** — Fadi keeps both and asks |

That last row is the one worth defending. Two things you wrote, disagreeing, is not a
problem an algorithm should settle: picking either one silently discards a real decision.
It surfaces as `evidence_needs_decision` in the activity centre, through the same
background pass as everything else.

Outbound is already one-way and stays that way: a published portfolio, a generated DOCX.
The loop closes when the edited artefact comes back through a door — not by Fadi reaching
into someone else's tool.

### Known gaps in the gateway

1. **`interview_stories` is a second projection with no gate.** Regenerating the story
   bank appends; the same STAR story can be produced twice from the same history.
   Same class of bug, different table.
2. **Résumé documents are not admitted.** The base résumé is free text, so there is no
   record identity to resolve. The reconcile pass compares it *after the fact* instead.
   The natural next step is to stamp exported documents with a fact fingerprint, so a
   returning file is recognised as *this* document edited, rather than re-derived from
   scratch by the extractor.
3. **Rarity needs a corpus.** With very few items nothing is distinctive, so a nearly
   empty pool cannot detect duplicates. Pinned as a test, not hidden.
4. **No embeddings.** `compareIdentity` accepts a cosine similarity and nothing supplies
   one. Feeding it would move many `maybe` verdicts to `same` and shrink the questions
   the user is asked. This is the single highest-value upgrade to accuracy.

---

## Part 1b — What the usage data actually says

Taken 10 September 2026 from the running database. Not opinion.

| Surface | Built | Records | Last used |
|---|---|---|---|
| Portfolio | 28 files | 40 items | **yesterday** |
| Applications | 30 files | 15 | 4 weeks ago |
| Documents / résumé | 38 files | 15 | **5 weeks ago** |
| Interview stories | 11 files | 18 | **11 weeks ago** |
| Learning | 9 files | 1 commitment | effectively unused |
| Job discovery | (in jobs) | **0 saved jobs** | never |

The generative features were *tried and abandoned*. The largest surface in the codebase —
documents, 38 files — has not been touched in over a month. Meanwhile the portfolio was
edited yesterday and is public.

**Fadi is being used as a portfolio CMS with an application log attached.** Everything
else is scaffolding around a product that has already, quietly, found its shape.

### The conflict this creates

Fadi claims to be the system of record for a career being lived in other tools. The CV is
written in M365, the labs run on TryHackMe and Proxmox, the learning happens on other
platforms — and then Fadi's copy drifts from reality. That drift is not a sync bug to be
engineered away. It is the predictable result of claiming authority over work that
happens elsewhere.

### The resolution: narrow the claim

**Fadi is the system of record for PROOF, not for WORK.**

- It does not need to be where the CV is written. It needs to be where the CV's claims
  are checked against evidence.
- It does not need to be where labs are done. It needs to be where the artefacts land,
  with provenance.
- It does not need to replace TryHackMe. It needs to know you finished the room.

This costs nothing to adopt — it is a decision about what to build next, not a rewrite —
and it turns the two features that are already trusted (portfolio, evidence) into the
core rather than the leftovers.

---

## Part 2 — The Agentic Career OS

### The decision: transform, do not clone

Recommended before and now stronger. The gateway is *central infrastructure* — it sits
under every ingest path in the product. A fork doubles it, and the two copies drift
exactly the way `findAllDuplicates` drifted from the resolver (0 findings vs 8 on the same
data). It would also fork all the open audit findings.

The lab work is **additive**. It adds a resource registry, a provisioning agent and a new
evidence source. It does not require rewriting the career core.

### The thesis: a lab is an evidence factory

This is what connects the pivot to everything already built, and it is worth stating
plainly because it changes what to build first.

Right now the portfolio reports **14 unbacked skills** — claims with no artefact behind
them. Warranting theory (already in `docs/`) says self-generated claims carry near-zero
trust; artefacts carry it. A provisioned lab produces artefacts *as a by-product*:
configs, dashboards, detection rules, a Terraform plan, a screenshot of Wazuh firing.

So the lab is not a learning feature that happens to sit next to a portfolio. It is the
missing **supply side** of the evidence pool:

```
  gap detected ──▶ lab provisioned ──▶ work done ──▶ artefacts captured
       ▲                                                    │
       └──────────── portfolio / résumé ◀── admit() ◀────────┘
```

Everything a lab produces enters through the same gate as everything else. No new door.

### Better idea: capture before provision

The plan below starts with provisioning because that is the exciting part. The usage data
argues for the reverse.

**Provisioning is expensive and risky** — an agent on your hardware, a trust story, quotas,
an update path — and it produces nothing until all of it works.

**Capture is cheap and immediately useful.** You are already doing technical work:
TryHackMe rooms, HTB, a Proxmox homelab, GitHub commits. None of it reaches Fadi, which
is exactly why the published site shows **16 skills and 8 projects with no proof
attached**. A capture path needs no daemon, no root, no new trust:

| Source | How | Produces |
|---|---|---|
| GitHub | the PAT that already exists | commits, repos, languages — dated, verifiable |
| Proxmox | read-only API token | an inventory of what you actually built and run |
| TryHackMe / HTB | profile page or export | completed rooms, dated |
| Screenshots / configs | drop zone | artefacts with capture time and origin |

Every one of these is **first-party provenance** — a record of something that happened,
not a claim someone typed. That is precisely what the warranting research in `docs/`
says carries trust, and it is the one category where Fadi is not competing with M365 or
TryHackMe but complementing them.

Provisioning then becomes *one more capture source* — the one where Fadi observes the
work directly because it happened inside an environment Fadi created. That is a genuine
moat, and it arrives after the cheap sources have already proven the loop.

**Revised order: capture → prove the loop → then provision.**

### Where labs are worth building — and where they are not

Checked against the market in September 2026, not from memory.

| Domain | What already exists | Fadi should |
|---|---|---|
| **Cybersecurity** | TryHackMe, Hack The Box, CyberDefenders, PortSwigger Academy — thousands of maintained rooms | **capture, never build.** This market is won. |
| **Cloud / DevOps / K8s** | Killercoda (free, browser), KodeKloud (200+ labs), iximiuz Labs, Play with Docker/K8s | **capture, never build.** Also won, also free. |
| **IT Support / IT Operations** | *Nothing comparable.* A search for the IT-ops equivalent returns cybersecurity platforms, because the category does not exist. | **build.** |

**Why the gap exists, and why it is defensible.** Security and DevOps labs are ephemeral
and self-contained: spin a container, solve a puzzle, tear it down. IT operations is the
opposite — it is about *state over time* inside *a messy organisation*. A domain with real
users, an endpoint fleet that drifts, backups that silently stop, a mailbox that fills, a
certificate that expires next Tuesday. Hosting that per-user is expensive for a SaaS, which
is why nobody sells it.

It is nearly free if the learner brings their own hardware. **That is the arbitrage**, and
this user already owns the hardware — a Proxmox host and a Raspberry Pi, both already
described on their portfolio.

It is also precisely the half of "IT Operations & Security Engineer" where their evidence
is weakest: the security half has TryHackMe rooms behind it, the operations half has
nothing but claims.

### What an IT-ops lab actually is

Not a tutorial. A **scenario against an inventory**:

```
  roadmap gap            "Active Directory / identity"
        │
        ▼
  resource match         Proxmox host: 32 GB free, nested virt on
        │
        ▼
  scenario               "A DC and two workstations. On Tuesday, replication
                          breaks and a user cannot log in. Restore service."
        │
        ▼
  evidence               the VMs that existed, what broke, what you ran,
                         how long it took — observed, not claimed
```

The scenario is the content problem, and content is exactly where TryHackMe wins and a
small platform loses. The escape is that an IT-ops scenario **is generated against the
learner's own inventory** — something no fixed content library can do, because it does
not know what hardware you have.

### Where to start: Proxmox

You already run Proxmox VE. It has a REST API with token auth and role-scoped
permissions, which means **phase one needs no agent on the host at all** — the riskiest
component is deferred until the concept is proven.

Ordering by what unlocks the most for the least new surface:

| Phase | Target | New surface | Unlocks |
|---|---|---|---|
| 1 | Proxmox REST | API token + resource registry | VM/LXC labs on hardware you already have |
| 2 | Docker / Podman over SSH | one narrow agent | any spare Linux box, far lower cost per lab |
| 3 | Bare host agent | daemon + update path | Windows, laptops, Pi fleet |

Phase 3 is the one to be sceptical about. A daemon that can provision can destroy, and it
needs a trust and update story of its own.

### Non-negotiables for anything that touches your hardware

1. **Explicit registration.** A resource is usable only after you add it. No discovery,
   no scanning.
2. **Own only what you created.** Every object is tagged `fadi-lab:<id>` and the agent
   refuses to modify or delete anything without that tag. This is what stops a bug from
   reaching your real Proxmox VMs.
3. **Declarative and reversible.** Labs are described as a spec and torn down by id.
   No imperative shell that has to be undone by hand.
4. **Quotas before capability.** CPU, RAM, disk and lifetime ceilings per resource,
   enforced by Fadi, not by the user remembering.
5. **Dry-run is the default.** Show the plan; apply on confirmation. Same doctrine as
   the duplicate gate — detect and propose, never act on someone's system unasked.
6. **Credentials are per-resource and revocable**, stored the way the GitHub PAT already
   is (encrypted at rest, never re-displayed).

### Land before the pivot

Cloning would fork these; transforming means fixing them once. From the 9 Sept audit:

- **F02 / F03 — the truth gate gives false assurance.** Still open, verified today:
  `truth-gate.ts` accepts any number that appears *as a substring anywhere* in the
  record, so "40%" passes because "1140" exists somewhere. The UI says *"Every claim is
  grounded in your evidence."* A platform about to generate far more evidence must not
  ship a verifier that lies about it. **Fix first.**
- **F05 — AI spend paths bypass the rate gate** (extension capture, realtime voice).
  Lab provisioning will add more model-calling paths; fix the gate before multiplying
  the callers.
- **F10 — the "24 KB" liveness cap buffers the whole response.**
- F01, F07, F09 are fixed. F04, F06, F08, F11–F18 remain, none blocking this work.

### Sequencing

```
  1. Truth gate (F02/F03)          ── the doctrine dependency
  2. Rate gate (F05)               ── before adding model callers
  3. Embeddings into compareIdentity ── fewer questions, better admissions
  4. Resource registry + Proxmox provisioning (dry-run only)
  5. Lab → artefact capture → admit()   ── closes the loop
  6. Gate the interview story bank  ── the last ungated projection
```

Steps 1–3 are days of work on code that already exists. Step 4 is where the new product
starts, and it starts small deliberately: a registry and a dry-run planner are useful
even if provisioning is never switched on.

### The honest risk

The pivot's appeal is that it makes Fadi unique. Its danger is that it makes Fadi a
worse career tool while it becomes a mediocre infrastructure tool. The mitigation is the
thesis above: **build only the lab features that end in an artefact entering the evidence
pool.** A lab that does not produce evidence is someone else's product.

---

## Part 3 — Is any of this sellable?

Written 10 September 2026, market figures checked rather than recalled.

### The half that is not

The résumé-building market is worth ~$1.6B growing to ~$3.1B, and **79.5% of that is job
seekers buying for themselves**. But the reported headwind is *"saturation of free
alternatives reducing demand for paid services"*, and **40–80% of applicants already use
AI to write résumés, cover letters and interview answers**.

So the document half of Fadi — 38 files, the largest surface in the codebase, untouched
for five weeks — is being built into a market that is commoditised, free-saturated, and
where the typical spend is $20–40/month *mostly on ChatGPT or Claude plus one tool*.
Fadi's résumé builder is competing with the model the user already pays for.

### The half that is

That same statistic is the argument for everything else here. **If 40–80% of applicants
use AI to write their materials, written claims stop carrying signal.** Prose converges;
everyone's bullets look the same. What becomes scarce is not better writing but
*verifiable evidence that the work happened* — which is the provenance thesis already in
`docs/` under warranting theory, arriving from the market side.

Three things in Fadi are not commodities:

1. **The provenance spine** — fact vs rendering, one admission gate, evidence with
   sources. Nobody in the career-tools market has this. It is invisible to the user and
   it is the reason the output can be trusted.
2. **IT-ops labs on hardware you already own** — the market check found no equivalent,
   and the reason it does not exist (state over time, a messy fake organisation) is the
   same reason a SaaS cannot afford to host it.
3. **Bring-your-own-key AI** — already built (`user_ai_settings`). An unusually strong
   free tier: the expensive part of the product costs the operator nothing.

Résumé generation, job tracking and portfolio hosting are table stakes. They should exist
because the product is incoherent without them, not because they will win anyone.

### The design constraint that selling imposes — decide this now

Building for one user means optimising for that user's setup. **This user has a Proxmox
host and a Raspberry Pi. Most junior IT people have a laptop.**

If labs require owned server hardware, the addressable market is hobbyists — a rounding
error. So the resource registry must treat all of these as first-class from day one:

| Resource | Reality for a beginner |
|---|---|
| A laptop with Docker/WSL2 | the common case |
| One spare machine | occasional |
| A hypervisor (Proxmox, ESXi) | rare, and this user's case |
| A cloud free tier | common, and time-limited |

Costs nothing to design for now. Costs a rewrite later. **The scenario generator must
degrade honestly** — "on your laptop this runs as three containers instead of three VMs;
here is what that changes" — rather than refusing to help anyone without a rack.

### Pricing, when it comes (not yet)

Do not build pricing now. Pricing is a consequence of what the product is, and that is
still being decided. But the likely shape follows from the above:

- **Free forever: the portfolio and the evidence pool.** These are the trust surface and
  the acquisition channel — a public portfolio with a Fadi footer is the marketing.
- **Paid: labs.** They consume orchestration, scenario content and support. They are also
  the only part with a defensible cost basis.
- **BYO key stays free.** Fadi charges for what Fadi does, not for tokens.

The uncomfortable part: selling to job seekers is a famously hard business — low
willingness to pay, and churn *on success*, because the happy customer leaves. The money
in this category is usually institutional (bootcamps, universities, employers onboarding
technicians). An IT-ops lab platform that produces verified evidence has a far more
natural institutional buyer than a résumé builder does. Worth knowing before optimising
the consumer funnel.

### What this means for the next six months

Focus on learning and proving, not applying. That is where the user's own attention
already is, it is where the market is thinnest, and it is the only version of Fadi that
would make someone say "I rely on this" rather than "I tried it".
