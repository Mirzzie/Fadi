import "server-only";

import { execFile } from "node:child_process";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  newScreenPassword,
  parseInventory,
  parseVmx,
  screenEntries,
  screenOf,
  screenPortFor,
  setVmxEntries,
  summariseVmx,
  type VmxScreen,
  type VmxSummary,
} from "./vmware-config";

/**
 * THE PERSON'S OWN VMWARE MACHINES, as Fadi sees and uses them.
 *
 * Everything here goes through VMware's documented tools — `vmrun` and the machine's `.vmx`
 * settings — and nothing here deletes, reverts or reconfigures a machine except the one
 * change the person approves: turning on its screen for Fadi (see vmware-config.ts).
 *
 * Machines run in the background (`nogui`): VMware's window does not open. The person can
 * still open the same running machine in VMware Workstation at any time.
 */

const run = promisify(execFile);

export const VMWARE_ENDPOINT_PREFIX = "vmware://local";

/** The .vmx path a registered resource points at, or null. Same reading as the broker's. */
export function vmxPathOf(endpoint: string | null | undefined): string | null {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    const vmxPath = decodeURIComponent(url.pathname);
    if (url.protocol !== "vmware:" || (url.hostname && url.hostname !== "local")) return null;
    return vmxPath.startsWith("/") && vmxPath.toLowerCase().endsWith(".vmx") ? vmxPath : null;
  } catch {
    return null;
  }
}

/** Which machines VMware reports running right now, by .vmx path. Null when vmrun is unavailable. */
export async function runningVmxPaths(): Promise<Set<string> | null> {
  try {
    const { stdout } = await run("vmrun", ["-T", "ws", "list"], {
      timeout: 4000,
      maxBuffer: 128 * 1024,
    });
    return new Set(
      stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.toLowerCase().endsWith(".vmx"))
    );
  } catch {
    return null;
  }
}

/**
 * Whether the guest operating system has started: VMware Tools inside it answers only once
 * the OS is up. "running" is the only answer that means usable.
 */
export async function guestToolsState(
  vmxPath: string
): Promise<"running" | "installed" | "not-installed" | "unknown"> {
  try {
    const { stdout } = await run("vmrun", ["-T", "ws", "checkToolsState", vmxPath], {
      timeout: 6000,
      maxBuffer: 16 * 1024,
    });
    const state = stdout.trim().toLowerCase();
    if (state === "running") return "running";
    if (state === "installed") return "installed";
    if (state === "notinstalled" || state === "not installed") return "not-installed";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function readVmxSummary(vmxPath: string): Promise<VmxSummary | null> {
  try {
    const text = await readFile(vmxPath, "utf8");
    return summariseVmx(parseVmx(text), path.basename(vmxPath, ".vmx"));
  } catch {
    return null;
  }
}

export type FoundMachine = VmxSummary & {
  vmxPath: string;
  running: boolean;
  /** Bytes on disk, from the folder's files. Null when unreadable. */
  sizeBytes: number | null;
};

/**
 * The machines in the person's VMware library. Read-only: reading VMware's own list and each
 * machine's settings file, nothing else.
 */
export async function discoverVmwareMachines(
  inventoryPath = path.join(homedir(), ".vmware", "inventory.vmls")
): Promise<FoundMachine[]> {
  let listed: Array<{ vmxPath: string; name: string }> = [];
  try {
    listed = parseInventory(await readFile(inventoryPath, "utf8"));
  } catch {
    return [];
  }
  const running = (await runningVmxPaths()) ?? new Set<string>();
  const found = await Promise.all(
    listed.map(async ({ vmxPath, name }) => {
      const summary = await readVmxSummary(vmxPath);
      if (!summary) return null; // listed in VMware but the file is gone (a disk unplugged)
      return {
        ...summary,
        name: name || summary.name,
        vmxPath,
        running: running.has(vmxPath),
        sizeBytes: await folderSize(path.dirname(vmxPath)),
      };
    })
  );
  return found.filter((machine): machine is FoundMachine => machine !== null);
}

async function folderSize(dir: string): Promise<number | null> {
  try {
    const { readdir } = await import("node:fs/promises");
    const names = await readdir(dir);
    let total = 0;
    for (const name of names) {
      const info = await stat(path.join(dir, name)).catch(() => null);
      if (info?.isFile()) total += info.size;
    }
    return total;
  } catch {
    return null;
  }
}

/** The ports other registered machines' screens already use, so a new one does not collide. */
async function screenPortsInUse(vmxPaths: string[]): Promise<Set<number>> {
  const ports = new Set<number>();
  for (const vmx of vmxPaths) {
    const summary = await readVmxSummary(vmx);
    if (summary?.screen) ports.add(summary.screen.port);
  }
  return ports;
}

/**
 * Turn on this machine's screen for Fadi: VNC on 127.0.0.1 only, with its own password.
 *
 * Only while the machine is OFF — VMware rewrites the .vmx when a running machine stops, so
 * an edit made while it runs would be lost or, worse, half-applied. The original file is kept
 * beside it as `<name>.vmx.before-fadi` the first time, so the change can be undone by hand.
 */
export async function enableScreen(input: {
  vmxPath: string;
  resourceId: string;
  otherVmxPaths: string[];
}): Promise<{ ok: true; screen: VmxScreen; changed: boolean } | { ok: false; message: string }> {
  const running = await runningVmxPaths();
  if (running === null) return { ok: false, message: "VMware's vmrun is not available." };
  if (running.has(input.vmxPath)) {
    return {
      ok: false,
      message:
        "The machine is running. Shut it down once, then start it from Fadi to turn its screen on.",
    };
  }
  const text = await readFile(input.vmxPath, "utf8");
  const existing = screenOf(parseVmx(text));
  if (existing) return { ok: true, screen: existing, changed: false };

  const screen = {
    port: screenPortFor(input.resourceId, await screenPortsInUse(input.otherVmxPaths)),
    password: newScreenPassword(),
  };
  const backup = `${input.vmxPath}.before-fadi`;
  if (!(await stat(backup).catch(() => null))) await copyFile(input.vmxPath, backup);
  await writeFile(input.vmxPath, setVmxEntries(text, screenEntries(screen)), "utf8");
  return { ok: true, screen, changed: true };
}

/** Memory sizes Fadi may set: what a lab VM sensibly needs, nothing exotic. */
export const MEMORY_CHOICES_MB = [2048, 3072, 4096, 6144, 8192] as const;

async function backupVmx(vmxPath: string): Promise<string> {
  const backup = `${vmxPath}.fadi-${Date.now()}`;
  await copyFile(vmxPath, backup);
  return backup;
}

async function refuseIfRunning(vmxPath: string): Promise<string | null> {
  const running = await runningVmxPaths();
  if (running === null) return "VMware's vmrun is not available.";
  return running.has(vmxPath)
    ? "The machine is running. Shut it down first — Fadi changes a machine only while it is off."
    : null;
}

/** Give a machine more (or less) memory. Only while it is off; the old settings are kept. */
export async function setMachineMemory(
  vmxPath: string,
  memoryMb: number
): Promise<{ ok: true; backup: string } | { ok: false; message: string }> {
  if (!(MEMORY_CHOICES_MB as readonly number[]).includes(memoryMb)) {
    return { ok: false, message: "That memory size isn't one Fadi sets." };
  }
  const refusal = await refuseIfRunning(vmxPath);
  if (refusal) return { ok: false, message: refusal };
  const text = await readFile(vmxPath, "utf8");
  // A suspended machine saved its memory at the old size; resizing it would break the resume.
  if (parseVmx(text).get("checkpoint.vmstate")) {
    return {
      ok: false,
      message:
        "The machine is suspended. Start it and shut it down properly, then change its memory.",
    };
  }
  const backup = await backupVmx(vmxPath);
  await writeFile(vmxPath, setVmxEntries(text, { memsize: String(memoryMb) }), "utf8");
  return { ok: true, backup };
}

/** Where moved machines go: a folder on this computer's own (fast) disk. */
export function fastMachinesRoot(): string {
  // ~/vmware: where the owner keeps their VMware machines on the SSD (and VMware's own default
  // folder name), so a moved machine lands beside the others rather than in a second place.
  return process.env.FADI_FAST_VM_DIR || path.join(homedir(), "vmware");
}

/**
 * Move a machine to the fast disk by COPYING it: the original stays where it was until the
 * person deletes it, so a failed or interrupted move loses nothing.
 *
 * - The new folder has copy-on-write turned off first (btrfs `chattr +C`): VM disks on a
 *   copy-on-write filesystem fragment and slow down — the opposite of the point.
 * - Every file is compared by size after copying.
 * - The copy is marked as MOVED (`uuid.action = "keep"`), or VMware asks "moved or copied?" on
 *   its first start — a question nobody can answer when it starts in the background.
 * - VMware's library is pointed at the copy, so Workstation opens the same machine.
 */
export async function moveMachineToFastDisk(
  vmxPath: string,
  inventoryPath = path.join(homedir(), ".vmware", "inventory.vmls")
): Promise<{ ok: true; newVmxPath: string; reused?: boolean } | { ok: false; message: string }> {
  // Already on the fast disk in VMware's library? Use that copy; never make another.
  const existing = await libraryCopyOf(vmxPath, inventoryPath);
  if (existing && (await onFastDisk(existing))) {
    return { ok: true, newVmxPath: existing, reused: true };
  }
  const refusal = await refuseIfRunning(vmxPath);
  if (refusal) return { ok: false, message: refusal };
  const { cp, mkdir, readdir, statfs } = await import("node:fs/promises");

  const source = path.dirname(vmxPath);
  const target = path.join(fastMachinesRoot(), path.basename(source));
  if (await stat(target).catch(() => null)) {
    return { ok: false, message: `${target} already exists. Remove or rename it first.` };
  }
  const size = (await folderSize(source)) ?? 0;
  await mkdir(fastMachinesRoot(), { recursive: true });
  const free = await statfs(fastMachinesRoot());
  if (free.bavail * free.bsize < size + 10 * 1024 ** 3) {
    return {
      ok: false,
      message: `Not enough room on the fast disk: it needs ${Math.ceil(size / 1024 ** 3) + 10} GB free.`,
    };
  }

  await mkdir(target);
  try {
    await run("chattr", ["+C", target], { timeout: 5000 });
  } catch {
    // Not btrfs, or not supported: nothing to turn off.
  }
  // Lock folders belong to a running VMware; a stopped machine has none worth copying.
  await cp(source, target, {
    recursive: true,
    filter: (src) => !src.endsWith(".lck") && !src.includes(".lck/"),
  });

  for (const name of await readdir(source)) {
    if (name.endsWith(".lck")) continue;
    const [a, b] = await Promise.all([
      stat(path.join(source, name)),
      stat(path.join(target, name)).catch(() => null),
    ]);
    if (a.isFile() && (!b || b.size !== a.size)) {
      return {
        ok: false,
        message: `The copy of ${name} is incomplete; the original is untouched.`,
      };
    }
  }

  const newVmxPath = path.join(target, path.basename(vmxPath));
  const vmx = await readFile(newVmxPath, "utf8");
  await writeFile(newVmxPath, setVmxEntries(vmx, { "uuid.action": "keep" }), "utf8");

  try {
    const inventory = await readFile(inventoryPath, "utf8");
    if (inventory.includes(`"${vmxPath}"`)) {
      await copyFile(inventoryPath, `${inventoryPath}.fadi-${Date.now()}`);
      await writeFile(
        inventoryPath,
        inventory.replaceAll(`"${vmxPath}"`, `"${newVmxPath}"`),
        "utf8"
      );
    }
  } catch {
    // No library to update; Workstation can open the moved .vmx directly.
  }
  return { ok: true, newVmxPath };
}

/**
 * The same machine somewhere else in VMware's library — by VMware's own hardware id
 * (`uuid.bios`), not by name. The owner copied their VMs to the SSD and pointed VMware at the
 * copies; Fadi, registered against the old path, then made a third copy (15 Oct 2026).
 */
async function onFastDisk(vmxPath: string): Promise<boolean> {
  const { onSpinningDisk } = await import("./readiness-facts");
  return (await onSpinningDisk(path.dirname(vmxPath))) === false;
}

export async function libraryCopyOf(
  vmxPath: string,
  inventoryPath = path.join(homedir(), ".vmware", "inventory.vmls")
): Promise<string | null> {
  try {
    const id = parseVmx(await readFile(vmxPath, "utf8")).get("uuid.bios");
    if (!id) return null;
    const listed = parseInventory(await readFile(inventoryPath, "utf8"));
    for (const { vmxPath: other } of listed) {
      if (other === vmxPath) continue;
      const text = await readFile(other, "utf8").catch(() => null);
      if (text && parseVmx(text).get("uuid.bios") === id) return other;
    }
    return null;
  } catch {
    return null;
  }
}

/** Whether VMware's library opens this exact file. */
export async function inLibrary(
  vmxPath: string,
  inventoryPath = path.join(homedir(), ".vmware", "inventory.vmls")
): Promise<boolean> {
  try {
    return parseInventory(await readFile(inventoryPath, "utf8")).some((e) => e.vmxPath === vmxPath);
  } catch {
    return false;
  }
}

/**
 * The machine's address, from VMware Tools — only if it is on VMware's own networks on this
 * computer (NAT or host-only), so a check can never be pointed at the home network.
 */
export async function guestAddress(vmxPath: string): Promise<string | null> {
  try {
    const { stdout } = await run("vmrun", ["-T", "ws", "getGuestIPAddress", vmxPath], {
      timeout: 15_000,
      maxBuffer: 16 * 1024,
    });
    const address = stdout.trim();
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) return null;
    const ifaces = networkInterfaces();
    const onVmnet = Object.entries(ifaces).some(
      ([name, list]) =>
        name.startsWith("vmnet") &&
        (list ?? []).some(
          (a) =>
            a.family === "IPv4" &&
            a.address.split(".").slice(0, 3).join(".") === address.split(".").slice(0, 3).join(".")
        )
    );
    return onVmnet ? address : null;
  } catch {
    return null;
  }
}

/** This computer's own addresses on VMware's networks — where Fadi's checks come from. */
export function hostAddressesOnVmnets(): string[] {
  return Object.entries(networkInterfaces())
    .filter(([name]) => name.startsWith("vmnet"))
    .flatMap(([, list]) => (list ?? []).filter((a) => a.family === "IPv4").map((a) => a.address));
}

/**
 * Change a machine's settings from the closed set (vmware-config.ts MACHINE_CHOICES). Only while
 * it is off; CPU and memory not while suspended either (its saved state has the old shape). The
 * current settings file is kept beside it first.
 */
export async function applyMachineChanges(
  vmxPath: string,
  raw: Record<string, unknown>
): Promise<{ ok: true; applied: string[] } | { ok: false; message: string }> {
  const { describeChanges, machineChangeEntries, validMachineChanges } = await import(
    "./vmware-config"
  );
  const changes = validMachineChanges(raw);
  if (Object.keys(changes).length === 0) return { ok: false, message: "Nothing to change." };
  const refusal = await refuseIfRunning(vmxPath);
  if (refusal) return { ok: false, message: refusal };
  const text = await readFile(vmxPath, "utf8");
  if ((changes.cpus || changes.memoryMb) && parseVmx(text).get("checkpoint.vmstate")) {
    return {
      ok: false,
      message: "The machine is suspended. Start it and shut it down properly, then change its CPU or memory.",
    };
  }
  await backupVmx(vmxPath);
  await writeFile(vmxPath, setVmxEntries(text, machineChangeEntries(changes)), "utf8");
  return { ok: true, applied: describeChanges(changes) };
}
