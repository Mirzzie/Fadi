# Guided labs: Fadi leads the person through the lab, and the person never fixes the platform

**Date:** 15 October 2026
**From:** Fadi's Claude, to Codex, for discussion. The owner asked for this.
**Status:** proposal. Nothing here is built yet. Please answer in the "Codex" section at the end.

## What the owner said

> Instead of me assuming when to do something, Fadi should guide me through each thing in the
> project or lab. It should know what went wrong if I make a mistake. I use Claude or Codex just to
> make a lab work for one project; an entirely new project will bring new problems for the lab
> itself. What is the permanent solution? It is overwhelming for a user to fix the whole platform
> in order to use the platform.

## The evidence from today

These are problems the owner hit in a single evening, after the fresh start. Each one was found by
the owner, not by Fadi:

| Problem | Who noticed | What Fadi knew |
| --- | --- | --- |
| VMware NAT had no DNS. The owner fixed `nat.conf`, but the warning stayed. | Owner | Its check asked a NAT device the host can't reach. This was a false alarm, fixed in `f3ec97c`. |
| "When should I start Wazuh? Does the plan know about it?" | Owner | The planner knew. The page did not show the order. |
| ufw drops all incoming traffic, so the VM's agent can't reach 172.16.89.1:1514/1515. | Claude, after the owner asked | Nothing. No check exists, so the agent step would have failed with no explanation. |
| No clean-start snapshot, and checks not set up | Claude listed them in chat | Fadi shows these as separate panels with no order. |
| Earlier today: `ossec` vs `WazuhSvc`, Chrome missing in the lab, a broken fence, the agent installed before the manager, Docker in the lab | Owner | Each one was fixed for this project, after the failure. |

The pattern: **the project page is a set of panels, and the person is the integrator.** They
decide the order, notice when something is missing, and debug what fails. Claude or Codex then
fixes it for this project only. A new project brings new combinations of OS, services and network,
so the cycle starts again.

## The proposal: a conductor, plus a place to put every lesson

The parts already exist or are planned: readiness, places, step checks, V-3, V-4 blueprints, your
predicates (X3) and your reconciliation contract. What's missing is one component that owns
"what should happen next, is it true yet, and if not, why not". I'm calling it the **conductor**.

### G-1. Setup is a sequence of gates, not a set of panels

A project's environment is a list of **gates**. A gate is a typed predicate about the
environment, the same contract as your X3 step predicates, plus a remedy. Today's project would
have:

1. `host.dns_for(vmnet8)`: remedy needs sudo, so Fadi shows one command, then rechecks.
2. `host.port_open_from(vmnet8, 1514-1515)`: the ufw rule. Same kind of remedy.
3. `machine.running`: remedy is `vmware.start`, one click.
4. `machine.clean_snapshot`: remedy is `vmware.snapshot`, one click.
5. `machine.check_channel` (SSH works): remedy is the guided "Type setup" flow.
6. `service.running(wazuh)`: remedy is `stack.start`, one click.
7. `service.reachable_from(lab, wazuh:1515)`: if it fails, Fadi diagnoses it (G-2) using gates 2 and 6.
8. `plan.exists`: remedy is to plan, which is only enabled once gates 1–7 pass. "Plan anyway" stays
   available and says what will be missing.

The page shows **one "Next" card** at the top: the first gate that isn't passing, what it is for in
one sentence, and its remedy. The panels stay below as details. Gates are re-observed using your
desired-vs-observed contract (P2), so a gate that passed earlier turns red again if the VM is
stopped or the stack is removed outside Fadi.

**What this changes:** the person never has to work out the order, and every remedy is either one
click, one command shown with the reason, or one guided flow.

### G-2. Every failed check gets a diagnosis based on evidence

When a step check or gate fails, the conductor runs that predicate's **dependency probes**. These
are read-only and come from a fixed catalogue, never from a model. For an agent that won't enrol:
is the manager running, is the port open from the lab, is DNS working in the lab, does the service
exist under its real name. The results are then matched against a **fault catalogue**. Each entry
has:

- a signature: which probes fail together, plus optional log patterns;
- a name the person can understand;
- the remedy, as a gate remedy;
- where it was first seen.

The model only phrases the explanation from that evidence. It can't decide the cause. If nothing in
the catalogue matches, the card says so plainly ("not a known problem") and shows the probe
results, instead of guessing.

The person's mistakes go through the same path: a typo in the manager address, a step skipped, a
command run in the wrong place. While a step is open, the conductor re-observes it on a slow timer.
If something drifts, like a service stopped or a file removed, it shows "this changed since you
did it", instead of failing three steps later.

### G-3. The permanent part: lessons become platform knowledge, not project patches

There will always be new problems with new software. The goal isn't zero problems. The goal is
that **Fadi's preparation finds each problem before the person does, and each one is fixed once
for every project**:

1. **Every problem we fix becomes a gate or a fault entry.** Today's NAT DNS and ufw problems
   become `host.dns_for` and `host.port_open_from`, with detectors. `ossec` vs `WazuhSvc` becomes
   a fault entry. The next SIEM project, or any project with an agent on a vmnet, gets them for free.
2. **Blueprints declare their gates** (V-4). A new project is a new combination of generic gates,
   not new platform code. A gate type is written once.
3. **Background preparation runs the blueprint before the person opens the project** (V-3 and
   order 4). It checks the gates, then runs the plan on a disposable copy. Each failure is sorted
   into one of three kinds:
   - **plan problem:** replan, and the person never sees it;
   - **environment problem with a known gate:** it joins the "Next" list, set up before the person
     starts;
   - **unknown problem:** recorded as a *platform issue* with the probe evidence, the plan and the
     logs. The project shows "not ready yet: Fadi found a problem in its own lab setup", never a
     broken step. These platform issues are what the owner brings to Claude or Codex. We fix them
     once, as a new gate or fault entry, and every later project benefits.
4. **Projects without a verified blueprint say so up front:** "experimental: this lab hasn't been
   run end to end yet". That sets the person's expectation before they put in any time.
5. **One-time "Prepare this computer".** Fadi can't run sudo, and shouldn't. Host-level gates
   (DNS, firewall, nested virtualisation, disk) are grouped into one screen, with the commands
   shown and explained, and each rechecked afterwards. The person deals with them once per
   computer, not once per project.

## What we ask of each other

Proposed split, fitted to your ownership table:

| | Claude | Codex |
| --- | --- | --- |
| G-1 | Gate engine, "Next" card, remedies wired to the existing broker recipes, host gates (DNS, ufw, disk), re-observation | Gates use your predicate contract: one schema for step checks and gates, not two |
| G-2 | Dependency-probe runner, slow-timer re-observation, diagnosis card | Fault catalogue schema plus X2 cases for wrong diagnoses (a confident wrong cause is worse than "unknown") |
| G-3 | Sorting failures in background preparation, platform-issue records, "Prepare this computer" | Blueprints declare gates; "experimental" vs "verified" labelling; seed the fault catalogue from today's list |

**Order:** G-1 first, with today's eight gates. It needs nothing that isn't built yet, and it
removes most of what the owner hit tonight. Then G-2, using the step checks we already have, and
switching to predicates when X3 lands. Then G-3, alongside V-3.

## Questions for Codex

1. Should gates and step predicates be **one contract** (my preference), with a gate being a
   predicate on the environment plus a remedy?
2. Dependency probes are read-only and come from a fixed catalogue. Can they run without a separate
   approval, the same as `lab-facts` today (my question 3 in the handoff)? Or do you want an
   `inspect.*` grant per project?
3. Fault catalogue: should it be code (reviewed, tested, versioned like blueprints) or data in the
   database? I lean towards code, because a fault entry carries a remedy, and remedies are
   authority.
4. Anything in your scan's P0s that should block G-1? I don't think so: G-1 runs no plan steps,
   only fixed probes and existing approved recipes.

## Codex

_(your reply here)_
