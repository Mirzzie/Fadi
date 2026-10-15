/**
 * CAN THIS PROJECT RUN HERE, AND WILL IT RUN WELL? — decided before anything starts.
 *
 * The owner's Windows Server lab started, then crawled: a 2 GB VM on a spinning disk, with a
 * SIEM about to join it in the same memory. Every one of those facts was knowable before the
 * first click. So a project's lab is assessed from measured facts — free memory, free disk,
 * which disk the VM lives on, how much memory its OS needs, what still has to download — and
 * the answer is shown before Start, and given to the planner.
 *
 * Pure: facts in, verdicts out, so every rule is pinned by tests.
 */

export type ReadinessFacts = {
  /** MemAvailable on this computer, MB. */
  availableMb: number;
  machine:
    | {
        kind: "vmware";
        label: string;
        family: "windows-server" | "windows" | "linux" | "other";
        memoryMb: number | null;
        running: boolean;
        /** The disk the VM's files are on spins (an HDD). Null when unknown. */
        onSpinningDisk: boolean | null;
        toolsRunning: boolean | null;
      }
    | { kind: "fresh"; label: string; memoryMb: number; running: boolean }
    | null;
  services: Array<{
    label: string;
    ramMb: number;
    diskGb: number;
    running: boolean;
    /** Images still to download, MB; 0 when all are here. */
    downloadMb: number;
  }>;
  /** Free space where Docker keeps images and volumes, GB. */
  dockerFreeGb: number | null;
};

export type ReadinessCheck = {
  id: string;
  level: "ok" | "warn" | "block";
  text: string;
  /** What to do about it, when there is something. */
  fix?: string;
};

export type Readiness = { verdict: "ready" | "slow" | "blocked"; checks: ReadinessCheck[] };

/** What each OS needs to be usable, not merely to boot. */
const RECOMMENDED_MB: Record<string, number> = {
  "windows-server": 4096,
  windows: 4096,
  linux: 2048,
  other: 1024,
};

/** Kept free for this computer itself (desktop, browser, Fadi). */
const HOST_RESERVE_MB = 1536;

const gb = (mb: number) => `${Math.round((mb / 1024) * 10) / 10} GB`;

export function assessReadiness(facts: ReadinessFacts): Readiness {
  const checks: ReadinessCheck[] = [];
  const machine = facts.machine;

  // MEMORY: only what is not already running still has to fit.
  const needMb =
    (machine && !machine.running ? (machine.memoryMb ?? 0) : 0) +
    facts.services.filter((s) => !s.running).reduce((sum, s) => sum + s.ramMb, 0);
  if (needMb > 0) {
    const spare = facts.availableMb - needMb;
    checks.push(
      spare >= HOST_RESERVE_MB
        ? {
            id: "memory",
            level: "ok",
            text: `Needs ${gb(needMb)} more memory; ${gb(facts.availableMb)} is free.`,
          }
        : spare >= 0
          ? {
              id: "memory",
              level: "warn",
              text: `Needs ${gb(needMb)} of the ${gb(facts.availableMb)} free — it will fit, but this computer will be short on memory.`,
              fix: "Close other VMs or heavy apps first.",
            }
          : {
              id: "memory",
              level: "block",
              text: `Needs ${gb(needMb)} but only ${gb(facts.availableMb)} is free.`,
              fix: "Stop another lab or VM, or close heavy apps, then check again.",
            }
    );
  }

  if (machine?.kind === "vmware") {
    const recommended = RECOMMENDED_MB[machine.family] ?? 1024;
    // A margin, so a hand-set 4048 MB is not told it needs "4 GB".
    if (machine.memoryMb !== null && machine.memoryMb < recommended * 0.9) {
      checks.push({
        id: "vm-memory",
        level: "warn",
        text: `${machine.label} has ${gb(machine.memoryMb)}; its OS needs about ${gb(recommended)} to be usable, so it will swap and feel slow.`,
        fix: `Give it ${gb(recommended)} (Fadi can, while it is shut down).`,
      });
    }
    if (machine.onSpinningDisk) {
      checks.push({
        id: "vm-disk",
        level: "warn",
        text: `${machine.label} lives on a spinning disk (HDD): slow to start, slow to use.`,
        fix: "Move it to the SSD (Fadi can, while it is shut down).",
      });
    }
    if (machine.running && machine.toolsRunning === false) {
      checks.push({
        id: "vm-tools",
        level: "warn",
        text: "VMware Tools isn't answering in the guest, so Fadi can't tell when it is ready or run checks.",
        fix: "Install VMware Tools from VMware's VM menu.",
      });
    }
  }

  // DISK for services, and what still downloads.
  for (const service of facts.services) {
    if (service.running) continue;
    const needGb = service.diskGb + service.downloadMb / 1024;
    if (facts.dockerFreeGb !== null && facts.dockerFreeGb < needGb + 5) {
      checks.push({
        id: `disk-${service.label}`,
        level: facts.dockerFreeGb < needGb ? "block" : "warn",
        text: `${service.label} needs about ${Math.ceil(needGb)} GB of disk; ${Math.floor(facts.dockerFreeGb)} GB is free.`,
        fix: "Remove labs you've finished from Machines, then check again.",
      });
    }
    if (service.downloadMb > 0) {
      checks.push({
        id: `download-${service.label}`,
        level: "ok",
        text: `${service.label}: the first start downloads about ${gb(service.downloadMb)}.`,
      });
    }
  }

  const verdict = checks.some((c) => c.level === "block")
    ? "blocked"
    : checks.some((c) => c.level === "warn")
      ? "slow"
      : "ready";
  return { verdict, checks };
}

/** One line for the planner: the constraints the steps must live within. */
export function readinessForPlanner(readiness: Readiness): string {
  const notes = readiness.checks.filter((c) => c.level !== "ok").map((c) => c.text);
  return notes.length
    ? `RESOURCES ON THIS COMPUTER (keep steps light where it helps): ${notes.join(" ")}`
    : "";
}
