import "server-only";

import { z } from "zod";

import { createLabResourcesRepository, createProjectRunsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { AiRateLimitError, getUserDocGenerate } from "@/lib/ai/user-generate";
import { placeLab, type Resource } from "@/lib/lab/capability";
import { labContainerForRun, type TemplateKey } from "./templates";
import {
  withFoldersCreated,
  hostOsOf,
  labOsOf,
  osViolations,
  placementBriefing,
  toolchainViolations,
} from "./host-and-lab";
import { specForProject, templateForProject } from "@/lib/lab/spec-from-project";
import { logger } from "@/lib/observability/logger";
import { linkProjectRunToWork } from "@/lib/work/domain-links";

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
        // Generous ceilings. A re-plan failed outright because ONE step's instruction ran to
        // 1,201 characters (29 Sep 2026) — build/break/fix steps carry more — and a length
        // limit should never throw away an otherwise good plan. The prompt asks for brevity.
        title: z.string().min(1).max(160),
        instruction: z.string().min(1).max(4000),
        verify: z.string().max(1500).optional().default(""),
        produces: z.string().max(800).optional().default(""),
      })
    )
    // One, not three: a re-plan of a project with most steps finished needs only what is left,
    // and forcing three would pad it. The prompt still asks new plans for 3 to 8.
    .min(1)
    .max(8),
});

const SYSTEM = `You plan hands-on technical projects for one person, to be done on hardware they own.

Write steps that person can actually execute tonight. Rules:
- Plan for the SPECIFIC host named. Instructions differ between a hypervisor, a laptop running VMware, a Raspberry Pi and a cloud free tier. Never write "on your machine".
- Every step needs a VERIFY: an observable result that proves it worked. Not "check it works" — name the command, the log line, the screen.
- Every step names what it PRODUCES where there is something: a file, a config, a screenshot, a repo. These become the person's evidence, so they must be real artefacts, not feelings.
- No step may be "watch a tutorial" or "read the docs". Linking is not doing. If a concept must be learned, fold it into the doing.
- Assume competence but not familiarity: they can use a terminal, they have not done THIS before.
- Shape it as a response to the problem in the project description: build it, then TEST OR BREAK it the way an attacker, a user or a failure would, then fix what that finds. At least one step must try to break or bypass what was built and record what happened — findings and fixes are the evidence hiring managers look for, far more than a clean install.
- Where a real choice is made (a design, a control, a tool), say what the options were so the person can record the decision and its trade-off.
- Before any step writes a file, that step or an earlier one creates its folder (PowerShell: New-Item -ItemType Directory -Force -Path "C:\\LabSetup"; Linux: mkdir -p). A fresh machine has none of your folders.
- Keep each instruction under about 900 characters: the commands, and one line on why.
- 3 to 8 steps. A plan longer than that is a course, and it will not be finished.
- Never invent details about their environment beyond what you are told.`;

// Static checks catch known contradictions. They do not prove commands or packages work;
// those checks belong to execution in the approved environment.
function planViolations(
  steps: z.infer<typeof planSchema>["steps"],
  template: TemplateKey | null
): string[] {
  if (!template) return [];
  const text = steps.map((s) => `${s.title}\n${s.instruction}\n${s.verify ?? ""}`).join("\n");
  const os = labOsOf(template);
  return [...(os ? osViolations(text, os) : []), ...toolchainViolations(text, template)];
}

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
    /** On a re-plan: steps already finished. They are kept, and the new plan continues from them. */
    completedSteps?: Array<{ title: string; result: string | null }>;
  }
): Promise<{ ok: true; plan: PlannedRun } | { ok: false; message: string }> {
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    return {
      ok: false,
      message:
        "Planning a project needs an AI provider — add one in Settings → AI, then try again.",
    };
  }

  const db = getDatabase();
  // Only machines Fadi can actually act on are placement candidates. Placing a project on a
  // registered-but-unconnected server produced plans for one machine and labs on another (A07).
  const { isConnected } = await import("./target");
  const rows = (await createLabResourcesRepository(db).listForUser(userId)).filter((r) =>
    isConnected({ id: r.id, label: r.label, endpoint: r.endpoint })
  );
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

  const template = templateForProject(input);
  const { spec } = specForProject(input);
  const { fits, unverified } = placeLab(spec, resources);
  // Prefer a confirmed host; fall back to an unverified one, because "we have not
  // recorded your RAM" should not stop someone starting — it should be said out loud.
  const host = template ? (fits[0] ?? unverified[0]?.resource ?? null) : null;

  if (template && resources.length > 0 && !host) {
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
  const placement = placementBriefing({
    hostOs: hostOsOf(process.platform),
    template,
    hostLabel: host?.label ?? null,
    // The same name the lab will be started under, so step one can say exactly how to get
    // a shell in it rather than "open a terminal in the lab machine".
    containerName: input.replaceRunId ? labContainerForRun(input.replaceRunId) : null,
  });

  const hostLine = !template
    ? "No local lab is required. Work in the hosted service or document workspace; do not invent a lab host."
    : host
      ? `Host: ${host.label} — ${host.kind}, ${host.arch}, ${
          host.memoryMb
            ? `${Math.round((host.memoryMb / 1024) * 10) / 10} GB RAM`
            : "RAM not recorded"
        }, runs ${host.virtualization}, ${host.alwaysOn ? "stays on" : "not always on"}.`
      : "Host: not recorded. Plan for a single ordinary laptop and say so in step one.";

  // A re-plan continues from what is done instead of starting the project over.
  const doneLine = input.completedSteps?.length
    ? [
        "ALREADY COMPLETED — these steps stay as they are. Do not repeat them; plan only the remaining work, continuing from here (1 to 8 steps):",
        ...input.completedSteps.map(
          (step, index) =>
            `${index + 1}. ${step.title}${step.result ? ` (result: ${step.result})` : ""}`
        ),
      ].join("\n")
    : "";

  try {
    const parsed = await generate.structured(
      SYSTEM,
      [
        `Project: ${input.title}`,
        input.detail ? `Description: ${input.detail}` : "",
        placement,
        hostLine,
        doneLine,
      ]
        .filter(Boolean)
        .join("\n"),
      planSchema,
      "project_plan"
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
    const violations = planViolations(parsed.steps, template);

    if (violations.length > 0) {
      logger.warn("lab.plan_os_mismatch", { userId, labOs, violations: violations.join(", ") });
      const retry = await generate.structured(
        SYSTEM,
        [
          `Project: ${input.title}`,
          input.detail ? `Description: ${input.detail}` : "",
          placement,
          hostLine,
          doneLine,
          `Your previous plan used ${violations.join(", ")}, which cannot run on this ${labOs === "linux" ? "Linux" : "Windows"} machine. Write it again for the machine it actually runs on.`,
        ]
          .filter(Boolean)
          .join("\n"),
        planSchema,
        "project_plan"
      );
      const retryViolations = planViolations(retry.steps, template);
      if (retryViolations.length === 0) {
        parsed.steps = retry.steps;
      } else {
        // Twice is enough. An unfollowable plan saved is worse than no plan: it looks like
        // work waiting to be done and is a dead end on step one.
        logger.warn("lab.plan_os_mismatch_persisted", { userId, labOs });
        return {
          ok: false,
          message:
            "Fadi kept writing " +
            retryViolations.join(", ") +
            " for a " +
            (labOs === "linux" ? "Linux" : "Windows") +
            " machine, so it hasn't saved the plan rather than give you steps that cannot run. Try again, or say in the project description which OS you want.",
        };
      }
    }

    // Folders it writes into exist before it writes (see withFoldersCreated).
    if (labOs) parsed.steps = withFoldersCreated(parsed.steps, labOs);

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
      const replaced = await repo.replaceSteps(userId, input.replaceRunId, rows);
      if (!replaced) {
        return { ok: false, message: "That project is gone." };
      }
      logger.info("lab.run_replanned", { userId, steps: rows.length, host: host?.kind ?? "none" });
      return { ok: true, plan: { runId: input.replaceRunId, steps: rows.length } };
    }

    // Every new project belongs to the direction it was planned under, so switching direction
    // shows that direction's projects rather than every project ever planned.
    const { createCareerProfilesRepository } = await import("@careeros/database");
    const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
    const { run } = await repo.createWithSteps(
      userId,
      {
        careerProfileId: track?.id ?? null,
        title: input.title,
        detail: input.detail ?? null,
        commitmentId: input.commitmentId ?? null,
        resourceId: host?.id ?? null,
        resourceLabel: host?.label ?? null,
      },
      rows
    );

    // The run is the domain record; the kernel keeps only its id and why it matters. Linking is
    // best-effort until the durable outbox owns cross-domain hand-offs: a failed link must not
    // make a successfully-created project look failed and create a duplicate on retry.
    try {
      await linkProjectRunToWork(db, userId, run);
    } catch (error) {
      logger.warn("lab.run_work_link_failed", {
        userId,
        runId: run.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    logger.info("lab.run_planned", {
      userId,
      steps: parsed.steps.length,
      host: host?.kind ?? "none",
    });
    return { ok: true, plan: { runId: run.id, steps: parsed.steps.length } };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn("lab.plan_failed", { userId, error: detail.slice(0, 200) });

    // Fadi's own hourly allowance already words itself well — it says when it resets and
    // that nothing is lost. Replacing it with a generic sentence would be a downgrade.
    if (err instanceof AiRateLimitError) return { ok: false, message: err.message };

    // SAY WHICH FAILURE IT WAS.
    //
    // Every failure used to read "Couldn't plan this one just now — try again in a
    // moment". Driving the hub repeatedly showed what was actually happening: Groq's free
    // tier returning 429 on tokens-per-minute. For that, "try again in a moment" is right —
    // but the same sentence was shown for failures that retrying can never fix, and it hid
    // the one thing that would have prevented it: a fallback provider.
    if (/\b429\b|rate limit|quota|too many requests/i.test(detail)) {
      return {
        ok: false,
        message:
          "Your AI provider is rate-limited right now, so Fadi couldn't plan this. Wait a minute and try again — or add a fallback provider in Settings → AI so this doesn't stop you next time.",
      };
    }
    if (/\b401\b|\b403\b|invalid api key|unauthori[sz]ed/i.test(detail)) {
      return {
        ok: false,
        message:
          "Your AI provider rejected the key. Check it in Settings → AI — retrying won't help until it's fixed.",
      };
    }
    return {
      ok: false,
      message:
        "Fadi couldn't produce a usable plan for this one. Try again, or add more detail to the project description.",
    };
  }
}
