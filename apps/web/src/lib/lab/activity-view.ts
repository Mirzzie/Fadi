/**
 * THE LOG, GROUPED BY WHAT THE PERSON WAS TRYING TO DO.
 *
 * Raw rows are complete at the wrong level. A single "check what containers are running"
 * produced five lines — docker, podman, virsh, vmrun, wsl — of which three were only "not
 * installed here". Reading that back tells you nothing and trains you to stop reading it.
 *
 * So rows are folded into the INTENT they belong to, and the fold is deliberate about what
 * survives: anything Fadi was refused stays its own line, because that is the one thing on
 * the page worth seeing.
 */

export type ActivityRow = {
  id: string;
  actor: string;
  origin: string | null;
  capability: string;
  command: string | null;
  decision: string;
  detail: string | null;
  at: string;
  runId?: string | null;
};

export type ActivityGroup = {
  id: string;
  /** What was being attempted, in the person's terms. */
  title: string;
  actor: string;
  at: string;
  /** allowed | denied | asked | mixed — what became of it. */
  outcome: string;
  /** "3 checks, 2 found" — the fold, stated rather than hidden. */
  summary: string;
  rows: ActivityRow[];
};

/** Minutes within which rows for the same capability are one attempt rather than two. */
const WINDOW_MINUTES = 2;

const NOUN: Record<string, string> = {
  "inspect.containers": "Checked for container runtimes",
  "inspect.virtualisation": "Checked for virtual machines",
  "inspect.host": "Read this machine's capacity",
  "inspect.network": "Read this machine's network",
  "network.sweep": "Scanned the network",
  "network.identify": "Identified a machine",
  "container.run": "Started a container",
  "container.stop": "Stopped a container",
  "container.remove": "Removed a container",
  "lab.start": "Started a lab machine",
  "lab.build": "Built a lab image",
  "file.write": "Wrote a file",
  "file.remove": "Deleted a file",
  "dir.create": "Created a folder",
  "machine.add": "Added a machine",
  "machine.update": "Updated a machine",
  "machine.forget": "Removed a machine",
  "workspace.set": "Set the workspace",
  "workspace.create": "Created a project folder",
};

function titleFor(capability: string): string {
  return NOUN[capability] ?? capability;
}

export function groupActivity(rows: ActivityRow[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  for (const row of rows) {
    const last = groups[groups.length - 1];
    const sameIntent =
      last &&
      last.rows[0].capability === row.capability &&
      last.actor === row.actor &&
      Math.abs(new Date(last.at).getTime() - new Date(row.at).getTime()) < WINDOW_MINUTES * 60_000;

    // A refusal never folds into anything. It is the only line on this page that has to be
    // read, and burying it inside "3 checks" is how it stops being read.
    if (sameIntent && row.decision !== "denied" && last.outcome !== "denied") {
      last.rows.push(row);
      continue;
    }

    groups.push({
      id: row.id,
      title: titleFor(row.capability),
      actor: row.actor,
      at: row.at,
      outcome: row.decision,
      summary: "",
      rows: [row],
    });
  }

  for (const group of groups) {
    const allowed = group.rows.filter((r) => r.decision === "allowed").length;
    const unavailable = group.rows.filter((r) => r.decision === "unavailable").length;
    const outcomes = new Set(group.rows.map((r) => r.decision));
    group.outcome = outcomes.size === 1 ? [...outcomes][0] : "mixed";

    group.summary =
      group.rows.length === 1
        ? (group.rows[0].detail ?? "")
        : // The fold said out loud: not "5 things happened" but what came of them.
          `${group.rows.length} checks · ${allowed} worked` +
          (unavailable > 0 ? ` · ${unavailable} not installed here` : "");
  }

  return groups;
}
