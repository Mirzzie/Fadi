/**
 * THE SNAPSHOT A PROJECT'S FRESH START RETURNS ITS VMWARE MACHINE TO (shared by the broker,
 * vmware.ts, the conductor and the fresh-start actions).
 *
 * Each project has its OWN snapshot, taken before the project first changes the machine and with
 * the machine off: the person's VMs are shared across projects and used outside Fadi, so one
 * shared "clean start" would make resetting project B wipe project A's work (16–17 Oct 2026).
 *
 * A machine may still carry the older *shared* "Fadi clean start". Fadi only NOTES its presence:
 * it is never a reset target (reverting the whole VM to a global point would erase other projects'
 * work), and it is not silently copied into a project baseline either — Fadi cannot know the shared
 * point is the state this project should begin from. A project earns a safe reset only by saving
 * its OWN clean start, from the state the person confirms as its baseline (Codex re-review,
 * 17 Oct 2026). The snapshot's identity is the project's full run id, not a prefix, so two runs
 * can never collide on it.
 */
export const CLEAN_SNAPSHOT = "Fadi clean start";

/**
 * What a clean-start snapshot may be called — anything else is never reverted to. The project
 * suffix is the full run id (32 hex); the 8-hex form is tolerated only so an older machine's
 * snapshot name still parses (it is no longer selected as "own": see {@link baselineStateFor}).
 */
export const CLEAN_SNAPSHOT_RE = /^Fadi clean start(?: [0-9a-f]{8}| [0-9a-f]{32})?$/;

/**
 * This project's own clean-start snapshot name. The whole run id (dashes removed) is used, not a
 * prefix: an 8-hex prefix let two runs that shared their first 32 bits collide, so one project's
 * reset could revert another's snapshot (Codex VM-safety review, 17 Oct 2026).
 */
export function projectSnapshot(runId: string): string {
  return `${CLEAN_SNAPSHOT} ${runId.replace(/-/g, "").toLowerCase()}`;
}

/**
 * The snapshot that resets this project: ITS OWN, or null. The machine's older shared clean start
 * is deliberately NOT a fallback — reverting the whole VM to a global point would erase other
 * projects' work. A project without its own snapshot has no safe reset target yet.
 */
export function cleanSnapshotFor(names: string[], runId: string): string | null {
  const own = projectSnapshot(runId);
  return names.includes(own) ? own : null;
}

/** Whether a machine already has this project's baseline, only an older shared one, or neither. */
export type BaselineState = "own" | "legacy_present" | "missing";

/**
 * Classify the machine's snapshots for a run. Only `own` is a reset target. `legacy_present` is
 * purely informational — the machine has the older shared clean start but not this project's own,
 * and Fadi neither reverts to it nor derives a baseline from it; the person still has to save this
 * project's own clean start from a state they confirm. `missing` means there is none at all.
 */
export function baselineStateFor(names: string[], runId: string): BaselineState {
  if (names.includes(projectSnapshot(runId))) return "own";
  if (names.includes(CLEAN_SNAPSHOT)) return "legacy_present";
  return "missing";
}
