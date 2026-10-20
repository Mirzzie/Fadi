import "server-only";

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";

import { judgeStep, stopsTheRest, type StepRehearsal } from "./rehearsal";
import { LAB_TEMPLATES, type TemplateKey } from "./templates";

/**
 * V-3a: REHEARSE A PLAN IN A THROWAWAY COPY OF A LINUX LAB — offline.
 *
 * The plan is model-written, so this is the boundary Codex asked for before any of it runs
 * unattended (scan P0, 15 Oct 2026), enforced here rather than promised:
 * - a fresh container from the lab's own image, nothing of the person's in it: no mounts, no
 *   Fadi keys, no credentials, no environment passed through;
 * - NO network (`--network none`): a step that needs the internet is reported as such, not run
 *   against it. Allowing chosen destinations is V-3b, to be agreed first;
 * - bounded: memory, CPU, process count, a time limit per command and for the whole plan;
 * - `no-new-privileges`; removed afterwards whatever happens, and any left by a crash are
 *   swept on the next rehearsal.
 *
 * NOTHING CALLS THIS AUTOMATICALLY YET. Until Codex agrees the boundary it runs only when asked
 * (tests, a deliberate call).
 */

const run = promisify(execFile);
const LABEL = "fadi.rehearsal=1";
const PER_COMMAND_MS = 120_000;
const WHOLE_PLAN_MS = 15 * 60_000;

export type RehearsalStep = {
  ordinal: number;
  /** The step's own script, or null for a step outside the lab. */
  script: string | null;
  check: { command: string; expect: string } | null;
};

export type RehearsalResult =
  | { ok: true; steps: StepRehearsal[] }
  | { ok: false; reason: "unsupported" | "unavailable"; message: string };

type Exec = { exit: number | null; output: string };

async function exec(container: string, shell: string, script: string): Promise<Exec> {
  try {
    const { stdout, stderr } = await run("docker", ["exec", container, shell, "-c", script], {
      timeout: PER_COMMAND_MS,
      maxBuffer: 1024 * 1024,
    });
    return { exit: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    const e = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
    };
    return {
      exit: typeof e.code === "number" ? e.code : null,
      output: `${e.stdout ?? ""}${e.stderr ?? ""}${e.killed ? "\n(stopped: it took too long)" : ""}`,
    };
  }
}

/** Remove rehearsal containers a crash left behind (older than an hour). */
async function sweep(): Promise<void> {
  try {
    const { stdout } = await run(
      "docker",
      ["ps", "-a", "--filter", `label=${LABEL}`, "--format", "{{.ID}} {{.CreatedAt}}"],
      { timeout: 10_000 }
    );
    const stale = stdout
      .split("\n")
      .filter(Boolean)
      .filter((line) => Date.now() - Date.parse(line.split(" ").slice(1, 3).join("T")) > 3_600_000)
      .map((line) => line.split(" ")[0]!);
    if (stale.length) await run("docker", ["rm", "-f", ...stale], { timeout: 30_000 });
  } catch {
    // Docker not answering: the rehearsal itself will say so.
  }
}

export async function rehearsePlan(
  template: TemplateKey,
  steps: RehearsalStep[]
): Promise<RehearsalResult> {
  const lab = LAB_TEMPLATES[template];
  if (!lab || lab.toolchain.shell === "powershell") {
    return {
      ok: false,
      reason: "unsupported",
      message: "Rehearsing Windows labs needs a disposable clone of the machine (V-3b), not yet.",
    };
  }
  const shell = lab.toolchain.shell === "bash" ? "bash" : "sh";
  await sweep();

  const name = `fadi-rehearsal-${randomBytes(6).toString("hex")}`;
  try {
    await run(
      "docker",
      [
        "run",
        "-d",
        "--rm",
        "--name",
        name,
        "--label",
        LABEL,
        "--network",
        "none",
        "--memory",
        "1g",
        "--cpus",
        "1",
        "--pids-limit",
        "256",
        "--security-opt",
        "no-new-privileges",
        "--entrypoint",
        "sleep",
        lab.image,
        "infinity",
      ],
      { timeout: 120_000 }
    );
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message: `Couldn't start a throwaway copy of the lab: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`,
    };
  }

  const deadline = Date.now() + WHOLE_PLAN_MS;
  const results: StepRehearsal[] = [];
  let stopped = false;
  try {
    for (const step of [...steps].sort((a, b) => a.ordinal - b.ordinal)) {
      if (stopped || !step.script || Date.now() > deadline) {
        results.push({ ordinal: step.ordinal, verdict: "skipped", output: "" });
        continue;
      }
      const before = step.check ? await exec(name, shell, step.check.command) : null;
      const ran = await exec(name, shell, `set -e\n${step.script}`);
      const after =
        step.check && ran.exit === 0 ? await exec(name, shell, step.check.command) : null;
      const judged = judgeStep({
        ordinal: step.ordinal,
        expect: step.check?.expect ?? null,
        before,
        run: ran,
        after,
      });
      results.push(judged);
      stopped = stopsTheRest(judged.verdict);
    }
    return { ok: true, steps: results };
  } finally {
    await run("docker", ["rm", "-f", name], { timeout: 30_000 }).catch(() => undefined);
  }
}
