import "server-only";

import { execFile } from "node:child_process";
import { readFile, statfs } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { ReadinessFacts } from "./readiness";

/**
 * The measured facts the readiness check decides on. Read-only: /proc, the VM's own settings,
 * VMware's and Docker's own answers. Nothing here starts, changes or downloads anything.
 */

const run = promisify(execFile);

export async function availableMemoryMb(): Promise<number> {
  try {
    const text = await readFile("/proc/meminfo", "utf8");
    const kb = Number(text.match(/^MemAvailable:\s+(\d+)/m)?.[1]);
    return Number.isFinite(kb) ? Math.round(kb / 1024) : 0;
  } catch {
    return 0;
  }
}

/** Whether the disk holding this path spins. Null when it can't be told. */
export async function onSpinningDisk(target: string): Promise<boolean | null> {
  try {
    const { stdout } = await run("findmnt", ["-no", "SOURCE", "--target", target], {
      timeout: 3000,
    });
    // "/dev/nvme0n1p2[/@home]" → nvme0n1p2 → nvme0n1; "/dev/sda1" → sda.
    const part = path.basename(stdout.trim().replace(/\[.*\]$/, ""));
    const disk =
      part.startsWith("nvme") || part.startsWith("mmcblk")
        ? part.replace(/p\d+$/, "")
        : part.replace(/\d+$/, "");
    const flag = await readFile(`/sys/block/${disk}/queue/rotational`, "utf8");
    return flag.trim() === "1";
  } catch {
    return null;
  }
}

async function dockerFreeGb(): Promise<number | null> {
  try {
    const { stdout } = await run("docker", ["info", "--format", "{{.DockerRootDir}}"], {
      timeout: 4000,
    });
    const stats = await statfs(stdout.trim() || "/var/lib/docker");
    return (stats.bavail * stats.bsize) / 1024 ** 3;
  } catch {
    return null;
  }
}

async function imagePresent(image: string): Promise<boolean> {
  try {
    await run("docker", ["image", "inspect", "--format", "{{.Id}}", image], { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

export async function gatherReadinessFacts(input: {
  userId: string;
  runId: string;
  title: string;
  detail: string | null;
  /** The VMware machine the project runs on, when it does. */
  vmware: { label: string; vmxPath: string } | null;
  /** The fresh lab template, when the project uses Fadi's own lab instead. */
  fresh: { label: string; ramMb: number; running: boolean } | null;
}): Promise<ReadinessFacts> {
  const { STACKS, stackProject, stacksForProject } = await import("./stacks");
  const { observeStack } = await import("./stack-observer");
  const { labNameForRun } = await import("./templates");

  let machine: ReadinessFacts["machine"] = null;
  if (input.vmware) {
    const { guestToolsState, readVmxSummary, runningVmxPaths } = await import("./vmware");
    const [summary, running, spinning] = await Promise.all([
      readVmxSummary(input.vmware.vmxPath),
      runningVmxPaths(),
      onSpinningDisk(path.dirname(input.vmware.vmxPath)),
    ]);
    const isRunning = running?.has(input.vmware.vmxPath) ?? false;
    machine = {
      kind: "vmware",
      label: input.vmware.label,
      family: summary?.family ?? "other",
      memoryMb: summary?.memoryMb ?? null,
      running: isRunning,
      onSpinningDisk: spinning,
      toolsRunning: isRunning ? (await guestToolsState(input.vmware.vmxPath)) === "running" : null,
    };
  } else if (input.fresh) {
    machine = {
      kind: "fresh",
      label: input.fresh.label,
      memoryMb: input.fresh.ramMb,
      running: input.fresh.running,
    };
  }

  const labName = labNameForRun(input.runId);
  const services = await Promise.all(
    stacksForProject({ title: input.title, detail: input.detail }).map(async (key) => {
      const stack = STACKS[key];
      const observed = await observeStack(stackProject(labName, key), key);
      const missing = await Promise.all(
        Object.entries(stack.images).map(async ([image, mb]) =>
          (await imagePresent(image)) ? 0 : mb
        )
      );
      return {
        label: stack.label,
        ramMb: stack.ramMb,
        diskGb: stack.diskGb,
        running: ["running", "starting", "partial"].includes(observed?.state ?? ""),
        downloadMb: missing.reduce((sum, mb) => sum + mb, 0),
      };
    })
  );

  const [availableMb, freeGb] = await Promise.all([availableMemoryMb(), dockerFreeGb()]);
  return { availableMb, machine, services, dockerFreeGb: freeGb };
}
