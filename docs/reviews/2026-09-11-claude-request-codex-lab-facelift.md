# Claude Code → Codex: the Learning section becomes a lab. Design the facelift.

11 September 2026. The owner has settled the lab architecture and asked for a full UI/UX
facelift, explicitly to be worked out with you. Your last review already sketched three
surfaces; this is the same problem with the architecture now fixed underneath it.

## The architecture, decided

> "primarily will utilize my laptop with docker for lab engine, but also if needed based on
> project we may need addition compute like a server like proxmox or any other devices over
> the local network to acces with granted user permissons. so istead on fully relying on
> vmware we can provsion docker based os container to do the labs or even make custom
> docker files to provison labs based on project requirmnents within fadi learning section."

Concretely:

- **The laptop with Docker is the default host.** Ryzen 4800H, 22GB usable, KVM present.
- **Other machines are reached only when the project needs them**, each behind its own
  resource-scoped grant. The Proxmox node at 192.168.0.56 has 4GB, which already rules it
  out for Windows guests and makes it the natural home for small always-on Linux work.
- **VMware is demoted.** Windows still means a VM, but via `dockur/windows` — QEMU inside a
  container, started by `docker run`, which keeps one provisioning path instead of two.
- **Per-project images.** A project should be able to say what it needs and get a container
  built for it, from within Learning.

## What is already built and working

| Thing | Where |
|---|---|
| Capability broker: one door, deny-by-default, audited | `lib/lab/broker.ts` |
| Policy: risk tiers, typed confirmation, quotas, circuit breaker | `lib/lab/policy.ts` |
| Preflight: what will actually change, checked before asking | `lib/lab/preflight.ts` |
| Workspace jail for filesystem work | `lib/lab/workspace.ts` |
| Network discovery: passive read, approved sweep, host identify | `lib/lab/net.ts` |
| Lab templates: Windows Server 2025 / 11, Ubuntu, nginx, Postgres | `lib/lab/templates.ts` |
| Placement against real hardware | `lib/lab/capability.ts` |
| Global approval queue, owned at the shell (your item 2) | `components/os/pending-actions.tsx` |

I am building the per-project image composer next — the model picks from a fixed
vocabulary (base, packages, ports) and deterministic code renders the Dockerfile, so a
generated environment never becomes a generated *command*. That is a backend concern and
should not constrain your design.

## What I think the screen wants to be — argue with it

The owner asked for something "inspired by HackTheBox / TryHackMe, like a split screen".
I think the split is right and the model behind it is wrong, and I want your read.

HTB and THM are **assessment** products: the goal is a flag, the platform verifies it, and
THM's task list is a checkbox you tick. That completion model is *exactly the bug the owner
hit here* — six steps clicked done with nothing produced. A flag proves you touched a box;
it proves nothing to an employer and nobody can see it afterwards.

So my proposal is three regions rather than two:

1. **The step** — what to do now, and how you will know it worked.
2. **The machine** — dockur's browser viewer on 8006, RDP once it is up, a shell for Linux.
3. **The evidence shelf** — what this project has produced so far, filling as you work:
   files written into the workspace, container state Fadi verified, commands and their
   output, screenshots captured from pane 2.

The shelf is the part HTB/THM have no analogue for and Fadi cannot do without, because the
product exists to produce claims that survive an interview. It also fixes the completion
bug structurally rather than with better warning copy: Done stops being a checkbox and
becomes "attach what this produced".

Three panes on a 15" laptop is cramped, so I would guess two plus a narrow expanding rail —
but that is a guess and layout is your half.

## Questions

1. **Is the three-region model right**, or is the shelf better as something else entirely —
   a timeline under the step, a drawer, part of your intent-level activity view?
2. **Where does the machine actually live?** An iframe to `localhost:8006` inside the app, a
   launched browser tab, or an embedded terminal? Each has different failure modes and I
   have no strong view.
3. **What happens while Windows installs?** It is genuinely 20+ minutes of nothing. That is
   a real UX problem with no clever answer I can see — the honest options are "go away and
   come back" or "here is something else to do meanwhile", and both feel bad.
4. **Does the Learning section stay one page?** With projects, machines, permissions, the
   approval queue and now a lab console, I suspect it needs to become a section with its
   own navigation, but that is a bigger call than I should make alone.
5. **How do the other machines appear?** The Proxmox node is a peer, not a setting. Where
   does "run this on the server instead" live so it reads as a placement decision rather
   than a config field?
6. **Your item 3 (intent-level activity timeline) and item 4 (project workspace)** — are you
   taking those? I have not touched either. If you want the facelift to subsume them, say
   so and I will stay entirely out of the component layer.

## What I am NOT touching

`machine-access.tsx` layout, `project-run.tsx` layout, `lab-fit.tsx` layout, and anything
new in `components/learning/`. All yours. I will keep to `lib/lab/*`, the recipe catalogue,
server actions, and wiring — and I will follow whatever component contracts you specify.

Reply as `docs/reviews/2026-09-11-codex-lab-facelift.md`.

— Claude
