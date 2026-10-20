import type { Verdict } from "./contract";

/**
 * DOES THE LAB HAVE ROOM, ON THE DISKS IT ACTUALLY WRITES TO? Pure.
 *
 * The first version stat'd the home directory and `/var/lib` and compared the smaller against one
 * aggregate need (Codex VM-safety review, 17 Oct 2026). That guesses the write target: a VM lands
 * beside its `.vmx` (which may be on `/mnt/vms`), and Docker writes to its configured data-root
 * (`/srv/docker`, or a rootless `~/.local/share/docker`) — either can be full while the guessed
 * path is free, and if one `statfs` failed the remaining guess could still pass.
 *
 * So each real destination is resolved and measured. But two destinations OFTEN share one
 * filesystem, and then they draw on ONE pool of free space: checking each independently would let
 * 15 GB free satisfy a 10 GB and an 8 GB target separately while the combined 18 GB write fails
 * halfway (Codex re-review, 17 Oct 2026). So targets are grouped by filesystem identity, their
 * needs summed per filesystem, and compared once — in bytes, to avoid floor-to-GB boundary passes.
 * A required target Fadi could not resolve or read forces `unknown`, never `pass`.
 */
export type DiskTarget = {
  /** vm: beside the chosen `.vmx`. docker: Docker's data-root. */
  role: "vm" | "docker";
  /** How the place is described to the person. */
  label: string;
  /** The resolved directory to measure, or null when Fadi could not work out where it is. */
  path: string | null;
  /** Bytes this destination needs. 0 means this target is not required for this lab. */
  needBytes: number;
  /** Free bytes on this target's filesystem, or null when `statfs` could not read it. */
  freeBytes: number | null;
  /** Filesystem identity (e.g. `stat().dev`), so targets on one disk are summed, not double-counted. */
  fsId: string | null;
};

export type DiskVerdict = {
  verdict: Verdict;
  seen: string;
  evidence: Record<string, unknown>;
};

const GIB = 1024 ** 3;
const gb = (bytes: number) => Math.round((bytes / GIB) * 10) / 10;

export function diskRoomVerdict(targets: DiskTarget[]): DiskVerdict {
  const required = targets.filter((t) => t.needBytes > 0);
  const evidence = {
    targets: required.map((t) => ({
      role: t.role,
      path: t.path,
      needBytes: t.needBytes,
      freeBytes: t.freeBytes,
      fsId: t.fsId,
    })),
  };

  if (required.length === 0) {
    return { verdict: "pass", seen: "This lab needs no extra room on this computer.", evidence };
  }

  // A required destination Fadi can't locate, measure, or place on a filesystem is unknown, not room.
  const unresolved = required.filter(
    (t) => t.path === null || t.freeBytes === null || t.fsId === null
  );
  if (unresolved.length > 0) {
    const names = unresolved.map((t) => t.label).join(" and ");
    return {
      verdict: "unknown",
      seen: `Fadi can't measure the free space for ${names}.`,
      evidence,
    };
  }

  // Sum the needs of every target that shares a filesystem, and compare that sum ONCE to the
  // filesystem's free bytes — the writes compete for the same pool.
  const groups = new Map<string, { need: number; free: number; labels: string[] }>();
  for (const t of required) {
    const key = t.fsId as string;
    const g = groups.get(key) ?? { need: 0, free: t.freeBytes as number, labels: [] };
    g.need += t.needBytes;
    g.free = Math.min(g.free, t.freeBytes as number);
    g.labels.push(t.label);
    groups.set(key, g);
  }

  const describe = (g: { need: number; free: number; labels: string[] }) =>
    `${gb(g.free)} GB free for ${g.labels.join(" + ")} (needs about ${gb(g.need)} GB)`;
  const short = [...groups.values()].filter((g) => g.free < g.need);
  if (short.length > 0) {
    return {
      verdict: "fail",
      seen: `Not enough room — ${short.map(describe).join("; ")}.`,
      evidence,
    };
  }

  return {
    verdict: "pass",
    seen: `Room for the lab — ${[...groups.values()].map(describe).join("; ")}.`,
    evidence,
  };
}
