/**
 * THE SNAPSHOT A PROJECT'S FRESH START RETURNS ITS VMWARE MACHINE TO (shared by the broker,
 * vmware.ts, the conductor and the fresh-start actions).
 *
 * Each project has its own, taken before the project first changes the machine and with the
 * machine off: the person's VMs are shared across projects and used outside Fadi, so one shared
 * "clean start" would make resetting project B wipe project A's work (16–17 Oct 2026). A machine
 * may still have the older shared one; a project without its own uses that.
 */
export const CLEAN_SNAPSHOT = "Fadi clean start";

/** What a clean-start snapshot may be called — anything else is never reverted to. */
export const CLEAN_SNAPSHOT_RE = /^Fadi clean start(?: [0-9a-f]{8})?$/;

export function projectSnapshot(runId: string): string {
  return `${CLEAN_SNAPSHOT} ${runId.replace(/-/g, "").slice(0, 8).toLowerCase()}`;
}

/** The snapshot that resets this project: its own, else the machine's older shared one. */
export function cleanSnapshotFor(names: string[], runId: string): string | null {
  const own = projectSnapshot(runId);
  if (names.includes(own)) return own;
  return names.includes(CLEAN_SNAPSHOT) ? CLEAN_SNAPSHOT : null;
}
