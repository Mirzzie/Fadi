import "server-only";

import { z } from "zod";

import { createLabResourcesRepository, createProjectRunsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { placeLab, type Resource } from "@/lib/lab/capability";
import { hostOsOf, labOsOf, osViolations, placementBriefing } from "./host-and-lab";
import { specForProject, templateForProject } from "@/lib/lab/spec-from-project";
import { logger } from "@/lib/observability/logger";

/**
 * TURN A SUGGESTION INTO STEPS SOMEONE CAN ACTUALLY FOLLOW.
 *
 * A link to a tutorial is not guidance. It offloads every real decision — what to
 * install, on which machine, what "working" looks like, what to keep at the end — onto
 * the person who came here precisely because they did not know.
 *
 * So a run is planned against the HOST it will live on. "Install a domain controller" is
 * a different instruction on a Proxmox box than under VMware on a laptop, and a plan
 * that ignores that is a plan for a generic reader rather than this one.
 *
 * Every step carries a way to tell whether it worked. A step you cannot fail is how
 * someone reaches the end of a tutorial having learned nothing — and it is the
 * difference between "I watched this" and evidence.
 */

const planSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        instruction: z.string().min(1).max(1200),
        verify: z.string().max(500).optional().default(""),
        produces: z.string().max(300).optional().default(""),
      }),
    )
    .min(3)
    .max(12),
});

const SYSTEM = `You plan hands-on technical projects for one person, to be done on hardware they own.

Write steps that person can actually execute tonight. Rules:
- Plan for the SPECIFIC host named. Instructions differ between a hypervisor, a laptop running VMware, a Raspberry Pi and a cloud free tier. Never write "on your machine".
- Every step needs a VERIFY: an observable result that proves it worked. Not "check it works" — name the command, the log line, the screen.
- Every step names what it PRODUCES where there is something: a file, a config, a screenshot, a repo. These become the person's evidence, so they must be real artefacts, not feelings.
- No step may be "watch a tutorial" or "read the docs". Linking is not doing. If a concept must be learned, fold it into the doing.
- Assume competence but not familiarity: they can use a terminal, they have not done THIS before.
- 3 to 8 steps. A plan longer than that is a course, and it will not be finished.
- Never invent details about their environment beyond what you are told.`;

export type PlannedRun = { runId: string; steps: number };

export async function planProjectRun(
  userId: string,
  input: {
    title: string;
    detail?: string | null;
    commitmentId?: string | null;
    /**
     * Re-plan an existing run in place, replacing its steps and keeping everything else.
     * A wrong plan is otherwise a dead end — abandon the project and start over, or follow
     * instructions that do not match the machine they run on.
     */
    replaceRunId?: string;
  },
): Promise<{ ok: true; plan: PlannedRun } | { ok: false; message: string }> {
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message: "Planning a project needs an AI provider — add one in Settings → AI, then try again.",
    };
  }

  const db = getDatabase();
  const rows = await createLabResourcesRepository(db).listForUser(userId);
  const resources: Resource[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    arch: r.arch as Resource["arch"],
    memoryMb: r.memoryMb,
    diskGb: r.diskGb,
    virtualization: r.virtualization as Resource["virtualization"],
    alwaysOn: r.alwaysOn,
  }));

  const { spec } = specForProject(input);
  const { fits, unverified } = placeLab(spec, resources);
  // Prefer a confirmed host; fall back to an unverified one, because "we have not
  // recorded your RAM" should not stop someone starting — it should be said out loud.
  const host = fits[0] ?? unverified[0]?.resource ?? null;

  if (resources.length > 0 && !host) {
    return {
      ok: false,
      message:
        "Nothing you've registered can host this as described. Add a machine that can, or pick a different project — better to know now than three steps in.",
    };
  }

  // TWO MACHINES, AND THEY ARE OFTEN DIFFERENT.
  //
  // A plan told the owner to download a Windows .msi into C:\Users\%USERNAME%\Downloads
  // on a Linux laptop. Telling the planner the host OS fixes that and opens the opposite
  // error: a Windows Server project rewritten as Linux steps, teaching something nobody
  // asked to learn.
  //
  // So both are named — the host they sit at, and the lab Fadi provisions — along with
  // which one each step belongs to. process.platform is self-knowledge about the machine
  // Fadi runs on, not an inspection of anyone's computer, so it needs no capability;
  // gating it would mean planning blind by default, which is how the Windows steps
  // happened.
  const template = templateForProject(input);
  const placement = placementBriefing({
    hostOs: hostOsOf(process.platform),
    template,
    hostLabel: host?.label ?? null,
  });

  const hostLine = host
    ? `Host: ${host.label} — ${host.kind}, ${host.arch}, ${
        host.memoryMb ? `${Math.round((host.memoryMb / 1024) * 10) / 10} GB RAM` : "RAM not recorded"
      }, runs ${host.virtualization}, ${host.alwaysOn ? "stays on" : "not always on"}.`
    : "Host: not recorded. Plan for a single ordinary laptop and say so in step one.";

  try {
    const parsed = await generate.structured(
      SYSTEM,
      [`Project: ${input.title}`, input.detail ? `Description: ${input.detail}` : "", placement, hostLine]
        .filter(Boolean)
        .join("\n"),
      planSchema,
      "project_plan",
    );

    // CHECK THE PLAN AGAINST ITS OWN MACHINE.
    //
    // The briefing above asks for the right OS; it does not guarantee it. A real re-plan
    // with an explicit "do NOT write a C:\\ path, a .msi, msiexec or PowerShell" came back
    // with C:\Logs and C:\Program Files anyway. So the output is checked, and a plan that
    // contradicts its own machine is sent back once with the violation named rather than
    // saved as something unfollowable.
    // A project with no lab has no OS to contradict — the check is about a plan matching
    // the machine it runs on, and there is no machine.
    const labOs = template ? labOsOf(template) : null;
    const planText = parsed.steps.map((s) => `${s.title} ${s.instruction} ${s.verify ?? ""}`).join("\n");
    const violations = labOs ? osViolations(planText, labOs) : [];

    if (violations.length > 0) {
      logger.warn("lab.plan_os_mismatch", { userId, labOs, violations: violations.join(", ") });
      const retry = await generate.structured(
        SYSTEM,
        [
          `Project: ${input.title}`,
          input.detail ? `Description: ${input.detail}` : "",
          placement,
          hostLine,
          `Your previous plan used ${violations.join(", ")}, which cannot run on this ${labOs === "linux" ? "Linux" : "Windows"} machine. Write it again for the machine it actually runs on.`,
        ]
          .filter(Boolean)
          .join("\n"),
        planSchema,
        "project_plan",
      );
      const retryText = retry.steps.map((s) => `${s.title} ${s.instruction} ${s.verify ?? ""}`).join("\n");
      if (labOs && osViolations(retryText, labOs).length === 0) {
        parsed.steps = retry.steps;
      } else {
        // Twice is enough. An unfollowable plan saved is worse than no plan: it looks like
        // work waiting to be done and is a dead end on step one.
        logger.warn("lab.plan_os_mismatch_persisted", { userId, labOs });
        return {
          ok: false,
          message:
            "Fadi kept writing " +
            violations.join(", ") +
            " for a " +
            (labOs === "linux" ? "Linux" : "Windows") +
            " machine, so it hasn't saved the plan rather than give you steps that cannot run. Try again, or say in the project description which OS you want.",
        };
      }
    }

    const rows = parsed.steps.map((s, i) => ({
      ordinal: i + 1,
      title: s.title.trim(),
      instruction: s.instruction.trim(),
      verify: s.verify?.trim() || null,
      produces: s.produces?.trim() || null,
    }));

    const repo = createProjectRunsRepository(db);

    // Re-planning keeps the run — its workspace, its history, its identity — and replaces
    // only the steps. A wrong plan was otherwise a dead end: abandon the project and start
    // over, or follow instructions that do not match the machine they run on.
    if (input.replaceRunId) {
      const replaced = await repo.replaceSteps(userId, input.replaceRunId, rows, {
        resourceId: host?.id ?? null,
        resourceLabel: host?.label ?? null,
      });
      if (replaced.length === 0) {
        return { ok: false, message: "That project is gone." };
      }
      logger.info("lab.run_replanned", { userId, steps: rows.length, host: host?.kind ?? "none" });
      return { ok: true, plan: { runId: input.replaceRunId, steps: rows.length } };
    }

    const { run } = await repo.createWithSteps(
      userId,
      {
        title: input.title,
        detail: input.detail ?? null,
        commitmentId: input.commitmentId ?? null,
        resourceId: host?.id ?? null,
        resourceLabel: host?.label ?? null,
      },
      rows,
    );

    logger.info("lab.run_planned", { userId, steps: parsed.steps.length, host: host?.kind ?? "none" });
    return { ok: true, plan: { runId: run.id, steps: parsed.steps.length } };
  } catch (err) {
    logger.warn("lab.plan_failed", {
      userId,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return { ok: false, message: "Couldn't plan this one just now — try again in a moment." };
  }
}
