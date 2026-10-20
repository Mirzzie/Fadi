/**
 * LAB DISKS: what each lab costs on this computer, and which ones can go.
 *
 * Nothing removed a finished or abandoned lab. On the owner's machine a lab stopped two weeks
 * earlier still held 10.5 GB, next to a second Windows lab holding 17.7 GB. So each lab's real
 * size is shown, and the ones that are done with — the project finished or dropped, the lab idle
 * for two weeks, or no project at all — are marked for removal. Removal is always the person's
 * decision, approved like every other lab action; this only says which are safe to suggest.
 */

export const IDLE_DAYS = 14;

export type LabDiskInput = {
  name: string;
  projectTitle: string | null;
  /** The project's status, when the lab belongs to one: active | done | abandoned. */
  projectStatus: string | null;
  running: boolean;
  container: boolean;
  lastActiveAt: Date | null;
  bytes: number | null;
};

export type LabDiskView = LabDiskInput & {
  idleDays: number | null;
  /** Why removing it is worth suggesting; null when it is in use. */
  suggestRemoval: "finished" | "dropped" | "idle" | "orphaned" | null;
  /** Why it cannot be removed right now, if it cannot. */
  blocked: "running" | null;
};

export function describeLabDisk(input: LabDiskInput, now = Date.now()): LabDiskView {
  const idleDays =
    input.lastActiveAt && !input.running
      ? Math.floor((now - input.lastActiveAt.getTime()) / 86_400_000)
      : null;
  const suggestRemoval = input.running
    ? null
    : input.projectStatus === "done"
      ? "finished"
      : input.projectStatus === "abandoned"
        ? "dropped"
        : !input.projectTitle
          ? "orphaned"
          : idleDays !== null && idleDays >= IDLE_DAYS
            ? "idle"
            : null;
  return { ...input, idleDays, suggestRemoval, blocked: input.running ? "running" : null };
}

/** "10.5 GB", "812 MB", or a dash when it could not be measured. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
