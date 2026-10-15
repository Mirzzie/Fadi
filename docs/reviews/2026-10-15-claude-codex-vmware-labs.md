# Labs on the owner's VMware VMs

**Date:** 15 October 2026
**For:** the owner and Fadi's Codex (review), from Fadi's Claude
**Asked by the owner:** run project labs on VMware instead of the Docker-wrapped Windows VM;
share one VM across several projects and the owner's own non-Fadi use; spin up a fresh VM from
the same image only when a project needs one; reduce manual effort to the minimum.

## Why

A Windows Server 2025 lab (dockurr) was asked by its plan to install Docker Desktop. That
needs Windows' own hypervisor inside a VM inside a container; after the reboot the guest is in
a boot loop (Windows Boot Manager restarting, seen in the container log). Two separate
problems:

1. **The plan was wrong.** Wazuh/Elastic/Kibana are Linux services. A real SME runs the SIEM
   on Linux and the agent on Windows. The planner chose Docker-in-Windows because a project
   can only have one machine (C2, multi-service lab stacks, is unbuilt).
2. **The machine model is too narrow.** One fresh container VM per project, first Windows
   start ≈ 1 h of Setup, no reuse of VMs the owner already has.

Measured on the owner's laptop (Ryzen 7 4800H, 22 GB): `kvm_amd nested=1`; VMware
Workstation 26.0.1 with `vmrun`/`vmrest`, `vmnet1` host-only and `vmnet8` NAT; VMs on the
HDD: Kali 2026.2, Windows 10, Windows 11, Windows Server 2025. **A VMware VM ran with full
hardware virtualisation (`hv-svm`, nested paging) while the KVM lab was running**
(throwaway 256 MB probe, deleted), so both engines can coexist.

## What changes

### Removed (on a machine with VMware; dockurr remains the fallback without it)

| Today | Why it goes |
|---|---|
| First Windows start installs Windows from an ISO (~1 h) | A clone of an already-installed VM starts in seconds |
| "Save as base disk" (`lab.saveBase`) for dockurr | Replaced by clean images (below) |
| Seeding `/oem/install.bat` to enable SSH at Windows Setup | Done once when an image is prepared |
| Fixed `Docker` / `admin` lab account | The VM's own account, entered once, stored encrypted |
| Plan steps that put Docker or a hypervisor inside a Windows lab | Services run as containers beside the VM (C2) |
| The stuck lab `fadi-project-df3e6d83` and its disk | After the owner agrees; its project is re-planned from step 2 |

### Replaced

| Today | Becomes |
|---|---|
| Lab target = one dockurr container per project | A **machine**: a shared VMware VM, a fresh clone, a container, or (fallback) dockurr |
| Screen at the container's `:8006` web viewer | VMware's built-in VNC, shown in the project window (browser VNC), loopback only, per-VM password |
| `lab.start` / `lab.remove` via Docker | `vmrun start/stop/suspend`, clone, delete — same broker, same receipts |
| Windows check address from the container port map | `vmrun getGuestIPAddress`, then the C1 SSH check unchanged |
| Disk report (`disks.ts`) for container disks | Also lists Fadi clones and images, with what each costs |

### Kept

The broker, policy engine, approvals and receipts; `lab.check` and the C1 SSH checks;
containers for Linux services and the 3 Linux templates; workspace path safety; the
plan-quality evaluation (X2). Codex's X1 (validation in the lab) and X3 (automatic proof)
target "a machine" and get a VMware implementation behind the same interface.

## The model

**Shared machines.** The owner's existing VMs, registered once. Many projects use one VM, each
in its own folder (`C:\Fadi\<project>` / `~/fadi/<project>`); the owner keeps using it in
VMware for anything else. Fadi never deletes, reverts or reconfigures a shared machine
without asking. If it is already running, Fadi uses it as it is.

**Images.** One clean master copy per OS in `HDD/vmware/fadi-images/`, prepared once (OpenSSH
on, VMware Tools present, lab user, snapshot "Fadi base"). Clones depend on that snapshot, so
it is never the owner's daily VM.

**Fresh machines.** Linked clones of an image, created in seconds, tagged in their `.vmx`
(`fadi.owner`, `fadi.project`) so cleanup can only touch Fadi's own; removed when the project
finishes (or kept, as a full clone, on request).

**Networks.** NAT for internet. Attack/defence projects get a private host-only network that
cannot reach the home LAN; a project's VMs and its service containers meet there.

## Doing it with the least manual effort

| Task | What the owner does | What Fadi does |
|---|---|---|
| Register VMs | Tick the ones to use | Reads VMware's library and the HDD folder; shows OS, size, RAM |
| Make an image | Click "Make a clean image", type the VM's password once | Copies it while off, prepares it inside over VMware Tools, snapshots it |
| Start a project's lab | One approval per project ("use Server 2025 for this project") | Picks shared vs fresh from the plan, starts or reuses it, opens the screen, joins networks, creates the project folder |
| Sign in | Nothing, for checks; desktop login optional auto-login in images | Uses the stored credential for checks and setup |
| Check a step | Click Done | Runs the step's check itself and shows the result |
| Risky step | Nothing | Takes a snapshot "Fadi: before <project> step N" first; rollback is one click, never automatic |
| Several VMs | Nothing extra | Starts them in order, on one private network |
| Leaving a project | Nothing | Offers to suspend its VMs to free memory; resumes on return |
| Finishing | Confirm in the finish review | Removes clones and the project folder; leaves shared VMs and images |
| Memory | Nothing | Checks free RAM before start/clone and says what will not fit |

**Still asks, by design:** the first use of a VM in a project; deleting or reverting anything;
changing a VM's settings (enabling the screen); attack-network creation. Installing VMware
itself is the owner's.

## Build order (Claude), each with outcome/failure/authorisation tests and live evidence

- **V1** Register shared VMs; start/stop/suspend/reuse; screen in the project window.
- **V2** Images and fresh linked clones; finish-review cleanup; disk report.
- **V3** Checks over SSH via the VM's address; snapshots before risky steps; private networks.
- **C2 + re-plan** Wazuh/Elastic stack as containers on the project network; the SIEM project
  re-planned from step 2 with Server 2025 as the monitored machine.

**For Codex:** review the shared-machine rules (no revert/delete without consent, per-project
folders, clone tagging) and the credential storage before V1 lands; X1/X3 against the
machine interface.

## Status — 15 October 2026 (Claude): V1 landed

Built on the existing VMware slice (register a `.vmx`, `vmware.start` / `vmware.suspend`
recipes, observer via `vmrun list`), not beside it.

- **Choose the machine in one click.** The project's lab panel shows "Runs on" cards: a fresh
  lab on this computer, and the machines in the owner's VMware library that fit the project
  (Windows Server project → the Windows Server VM; read from `~/.vmware/inventory.vmls` and
  each `.vmx`). Picking one registers it (matched by `.vmx` path; a clashing name gets
  "(VMware)") and places the project on it (`placeOnResource`). Only machines VMware itself
  lists can be picked — the browser chooses among them, never types a path.
- **Starts in the background.** `vmrun -T ws start <vmx> nogui`: VMware's window does not open;
  Workstation can still attach to the running machine. A machine already running — started by
  the owner or another project — is used as it is: no request, no second start.
- **Screen inside the project.** The first start also turns on VMware's VNC on 127.0.0.1 with a
  per-machine port (5901–5999) and password — a new broker step kind (`ScreenStep`) that
  re-resolves the path from the owner's resource at execution and refuses while the VM runs.
  The original is kept as `.vmx.before-fadi`. The browser draws it with noVNC 1.7.0 (MPL-2.0,
  `public/novnc`, unmodified) through `lib/lab/vnc-bridge.ts`: WebSocket↔TCP on 127.0.0.1:6089,
  tickets per owner and VM port (30 min), local Origin only, never a port from the browser.
- **Readiness is observed.** "The operating system has started" passes only when VMware Tools
  in the guest answers (`checkToolsState`); without Tools the panel says so instead of "ready".
- **Approval policy change (for Codex's review):** `vm` + reversible/disruptive (start,
  suspend) is now one click; `vm` + irreversible stays typed. Host and remote unchanged.
- **Suspend is `hard`.** `soft` waits on VMware Tools to run guest scripts and never returned on
  a guest without Tools (measured); `hard` still saves memory and disk.
- Fadi's `Docker`/`admin` sign-in and Docker shell line are hidden for VMware machines.

**Evidence.** `vmware.integration.test.ts` (VMware + DB, `FADI_TEST_VMWARE=1`) on a throwaway
disk-less VM: one click → screen lines written, backup kept, VM running in the background →
the project's runtime is VMware with a reachable screen → VNC greets through the bridge →
suspend with one click → "suspended" → settings of a running VM refused and unchanged. A real
Chromium session through the dev server drew the VM's firmware screen in `lab-screen.html`
(connected, 1024×768). Unit: VMX parsing/editing, inventory, port/password, WebSocket framing,
ticket/Origin refusal, recipe path pinning, policy. 453 lab/learning/AI tests pass.

**Not yet:** "Open in VMware" button; images and fresh linked clones (V2); checks over SSH and
snapshots before risky steps, private networks (V3); the Wazuh stack and re-plan (C2). The
owner's own VMs have not been started by Fadi yet — the first real start is theirs to approve.
