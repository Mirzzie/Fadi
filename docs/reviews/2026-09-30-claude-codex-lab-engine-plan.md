# Claude ↔ Codex: the lab engine, nook and corner

**Date:** 30 September 2026
**Asked by the owner:** make the lab engine produce projects that solve current, market-relevant
problems, stay valid and future-proof, and run fast — every direction, not only security. Work
it together. The portfolio standard from the video applies throughout
(`2026-09-29-claude-to-codex-portfolio-standard-and-status.md`).

**State at the start:** both Claude lab assignments are landed (`7d1afb5` base reuse + disk
cleanup; `89ab777` polling). All lab containers and disks on the owner's machine were removed
at their request; the `dockurr/windows` image is kept. Their projects remain; a lab is
re-provisioned on next start.

## Audit — where the engine falls short today

Measured or read in code, 29–30 September.

| # | Area | Finding |
|---|---|---|
| 1 | Market relevance | Flagships are researched weekly (`407f243`), but the **plan** for a flagship never sees the research or sources, and **only five lab templates exist** (Windows Server, Windows 11, Ubuntu, a web box, Postgres). Most current problems — SIEM/detection, Kubernetes, cloud IAM, identity providers, AI application security, CI/CD supply chain, observability — need a multi-service lab that does not exist, so plans fall back to "install it yourself". |
| 2 | Verification | **Windows labs cannot be checked by Fadi.** `lab.check` runs `docker exec` in the dockur wrapper (Linux), not the Windows VM, so Windows projects have no "Check it for me" and every step is paste-your-proof. |
| 3 | Validity | Plan checks are static (OS words, toolchain, folders). Nothing proves a command exists on the target (a cmdlet on Server 2025, a package in apt) before the person meets the error. Owner hit two such defects in one evening. |
| 4 | Quality measurement | No evaluation set: we cannot say whether a planner change made plans better or worse across directions. |
| 5 | Future-proofing | Images are pinned by tag, not digest, with no refresh policy; a template can silently go stale or change under us. |
| 6 | Evidence capture | Step proof is typed or pasted. The lab could record command output and screenshots itself (Codex's earlier "observable logs automatically"). |
| 7 | Performance | First Windows start is an 8.2 GB download + ~1 h Setup (base reuse now fixes repeats, not the first). Images are pulled only at approval time. `projectRuntimeAction` spikes to 6 s (several docker calls per 8 s poll). |
| 8 | Lifecycle | Cleanup exists in Machines; the finish review does not yet offer "remove this lab". |

## Split

**Claude — the engine (infrastructure the plans run on)**
- **C1. Windows checks.** Seed a named `/oem` volume with an `install.bat` that enables OpenSSH
  (localhost-published), then a Windows variant of `lab.check` over SSH with the lab account.
  Makes "Check it for me" work for every Windows project. (#2)
- **C2. Lab stacks.** Multi-container labs on a private network, pinned images, one approval:
  first set chosen from the flagship research, e.g. detection (Wazuh), Kubernetes (k3s/kind),
  cloud emulation (LocalStack), identity (Keycloak), AI app security (Ollama + a target app),
  CI/CD (Gitea + runner). Planner is told exactly what is in the stack. (#1)
- **C3. Flagship → plan.** Pass the flagship's problem, build, break and sources into the plan
  prompt, and map it to a stack. (#1)
- **C4. Speed.** Pre-pull a project's image when it is committed (download only, shown), one
  batched `docker inspect` per runtime poll, finish-review "remove this lab". (#7, #8)
- **C5. Digest pinning** with a documented refresh routine. (#5)

**Codex — validity, quality and proof**
- **X1. Plan validation in the lab.** Before a plan is shown, dry-run the lookups that can be
  checked cheaply in the target (`Get-Command`, `apt-cache policy`, `--help`) and repair or flag
  the step. Uses C1 for Windows. (#3)
- **X2. Evaluation set.** A golden set of projects per direction (security, cloud, DevOps, data,
  IT support) with a scorer for the portfolio standard (problem-first, build/break/fix, verifiable
  steps, no invented facts), run before and after planner changes. (#4)
- **X3. Automatic proof.** Capture check output and lab screenshots as step artifacts, so the
  README and walkthrough draw on real output. (#6)
- **X4. Cross-review** each Claude slice against a signed-in run, as on 22–23 September.

## Order

C1 and X2 first (they unblock everything: Windows verification, and a way to measure), then
C2+C3 with X1, then C4, C5, X3. Each agent appends a dated status section here when a slice
lands, and never edits the other's listed files without saying so in this document.
