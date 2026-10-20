# Verified labs: steps written for the machines that exist, and tested before anyone sees them

**Date:** 15 October 2026
**For:** the owner and Fadi's Codex (review; this absorbs Codex's X1 "plan validation in the lab")
**Asked by the owner:** "The steps have no proper understanding of the OS that's been spun up …
I will be debugging the lab engine instead of doing the project. We need a permanent solution,
whatever direction or project."

## What keeps going wrong (one day, one project)

| Symptom | Root cause |
|---|---|
| Docker Desktop inside the Windows lab → boot loop | planner didn't know the lab is a VM in a container |
| Agent download from a GitHub URL that 404s | link from model memory |
| `Get-Service ossec` (service is `WazuhSvc`) | fact from an older release |
| `Start-Process chrome.exe https://127.0.0.1:5443` **in the lab** | Chrome isn't installed there, and 127.0.0.1 in the lab is the lab — the dashboard is on the person's computer |
| Agent "auth key not imported" | step order: agent before manager |
| Commands copied with prose in them | fence parsing |

Each was patched. The class is: **an AI writes prose for machines it has never looked at, and
nothing runs before the person does.**

## How established lab platforms avoid this (researched 15 Oct 2026)

- **The environment is declared and known before any step** — Ludus range config (VMs, template,
  network, Ansible roles); Instruqt sandbox hosts. Steps are written against it.
- **Every action has a place** — Instruqt tabs: a terminal on a named host, a service tab for a
  named URL. The learner never works out which machine or which address.
- **Every step has executable lifecycle scripts** — Instruqt setup / check / solve / cleanup per
  challenge per host; Katacoda `verify`; Skillable PowerShell/Bash scoring scripts.
- **Labs are tested end to end before learners** — `instruqt track test`: per challenge run setup,
  check (must fail), solve, check (must pass). Skillable uses AI at authoring time only.

Sources: Instruqt lifecycle scripts and track testing (docs.instruqt.com/sandboxes/lifecycle-scripts,
docs.instruqt.com/tracks/manage/test-a-track), Instruqt tabs (docs.instruqt.com/tracks/challenges/challenge-tabs),
Katacoda verified steps (katacoda-docs.oreilly.com/overview/verified-steps.html), Skillable scoring
(docs.skillable.com/docs/scoring), Ludus configuration (docs.ludus.cloud/docs/configuration).
No reverse engineering was needed: the architecture is documented.

## The design for Fadi

**V-1. Places and facts (the declared environment).** Before planning, Fadi builds the project's
*places* from what it can observe, not assume:
- **Lab machine** — probed over the check channel (SSH): OS and build, shell and version, which
  of a list of commands/apps exist (winget, curl, chrome, msiexec…), internet reachability, and
  whether each service's agent address is reachable *from the lab*.
- **Your browser, on your computer** — the URLs that open there (service dashboards).
- **Fadi** — what Fadi does itself (start a service, reset the lab) with one approval.
Every service endpoint is stated per place ("from your browser: https://127.0.0.1:5443; from the
lab: wazuh.manager:1514"). The planner receives this as its only description of the world.

**V-2. Structured steps.** A step is no longer prose to interpret: it has `where`
(lab | browser | fadi), the commands for that place, and an executable `check` (one command for
that place; passes on its expected output). The page shows the place on each step, "Type into
lab" appears only for lab steps, and "Check it for me" runs the step's own check — no second AI
call guessing one.

**V-3. Test before showing (Fadi's `track test`).** In the background, on a disposable copy of
the lab (from the saved base / a VMware snapshot), Fadi plays the plan: per step, check (should
fail), run the step's commands, check (must pass). A step that fails goes back to the planner
with the real output; only a plan that passed end to end is offered as **Verified**. Steps that
need a person (a GUI, a browser) are marked as such and their checks still run afterwards.

**V-4. Blueprints.** Per direction, a small library of tested lab blueprints (SIEM + Windows
endpoint, AD domain, web app + WAF, k8s …): machines, services, facts, and steps already proven
by V-3. Research updates versions and links; the AI adapts a blueprint rather than inventing a
lab. New projects without a blueprint go through V-3 and, once verified, become one.

## Order

V-1 and V-2 now (they stop the class of error immediately and give V-3 something executable).
V-3 next (needs a disposable lab: base volumes for Docker labs, snapshots/linked clones for
VMware — V2/V3 of the VMware plan). V-4 grows from verified plans.
