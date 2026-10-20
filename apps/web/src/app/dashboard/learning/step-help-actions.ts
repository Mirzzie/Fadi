"use server";

import { z } from "zod";

import { createProjectRunsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { AiRateLimitError, getUserDocGenerate } from "@/lib/ai/user-generate";
import { hostOsOf, placementBriefing } from "@/lib/lab/host-and-lab";
import { templateForProject } from "@/lib/lab/spec-from-project";
import { labContainerForRun } from "@/lib/lab/templates";
import { logger } from "@/lib/observability/logger";

/**
 * STUCK ON A STEP.
 *
 * Reported from a real lab: the step said `rc-service nginx start`, the container answered
 * "rc-service: not found", and fail2ban-client could not reach its socket. The workspace had
 * nothing to offer except "Mark self-reported and continue" — so the choice was to lie or to
 * leave.
 *
 * The person pastes what their terminal said. Fadi reads it against the step, its success
 * condition and the lab's measured facts (distribution, no service manager, no firewall
 * permission), says what went wrong, and gives commands that fit this lab. If the step itself
 * was wrong for the lab, it offers a corrected step the person can accept.
 *
 * Text, not screenshots: Fadi's model calls carry text only, and the free providers people
 * start with cannot read images. Copying terminal text is also exact where a screenshot is not.
 * Nothing here touches the machine — it is advice, and the person runs it.
 */

const MAX_OUTPUT = 6_000;

// Commands travel in their own fields. Asked to "put commands in fenced blocks", the model
// returned bare shell lines mixed into prose — which rendered as a paragraph with "#" in it.
// A field that holds only commands is rendered as a copyable block by construction.
const replySchema = z.object({
  whatHappened: z.string().min(1).max(800),
  fixExplanation: z.string().min(1).max(1_200),
  fixCommands: z.string().max(2_500).optional().default(""),
  stepWasWrong: z.boolean(),
  revisedExplanation: z.string().max(600).optional().default(""),
  revisedCommands: z.string().max(1_500).optional().default(""),
  revisedVerify: z.string().max(500).optional().default(""),
});

export type StepHelp = {
  whatHappened: string;
  /** Markdown: prose, then the commands as one fenced block. */
  fix: string;
  stepWasWrong: boolean;
  revisedInstruction: string;
  revisedVerify: string;
};

function withCommands(prose: string, commands: string): string {
  const body = commands.replace(/^```\w*\n?|\n?```$/g, "").trim();
  return body ? `${prose.trim()}\n\n\`\`\`sh\n${body}\n\`\`\`` : prose.trim();
}


const SYSTEM = `You help one person who is stuck on a single step of a hands-on lab project.
You get the step, how success is checked, the facts of the lab machine, and what their terminal printed.

- whatHappened: what actually went wrong, in one or two plain sentences, naming the exact error line.
- fixExplanation: short plain prose saying what to do and why. No commands in it.
- fixCommands: ONLY the shell commands to run in the lab, one per line, runnable exactly as the lab facts describe. Never use tools the lab facts say do not exist.
- Check the step against EVERY lab fact, not just the error shown: a later command in the same step may fail for another reason (a missing config file, a log that is not a real file, a permission the lab lacks). Fix those too.
- If part of the step's goal cannot work in this lab at all, say so plainly in fixExplanation and give the closest thing that can be verified.
- stepWasWrong: true only if the step's own instructions cannot work in this lab (not if the person mistyped). Then fill revisedExplanation (one or two sentences), revisedCommands (the whole corrected command list) and revisedVerify (a success condition this lab can actually meet).
- Never assume what a file contains or that a named config exists (a fail2ban filter, an nginx module, a package's default path). Before a sed edit or a reference to a named config, include the command that shows it first (grep -n, ls). A sed that matches nothing fails silently.
- Never invent output you were not shown. If the output is not enough to tell, give the command that would show it.`;

export async function helpWithStepAction(input: {
  runId: string;
  stepId: string;
  output: string;
  note?: string;
}): Promise<{ ok: true; help: StepHelp } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Sign in again." };

  const ids = z.object({ runId: z.string().uuid(), stepId: z.string().uuid() }).safeParse(input);
  if (!ids.success) return { ok: false, message: "That step could not be found." };

  let output = (input.output ?? "").trim();
  const note = (input.note ?? "").trim().slice(0, 500);
  if (!output && !note) {
    // What Fadi's own run or check of this step printed — never ask the person to paste it.
    const { createLabActionRequestsRepository } = await import("@careeros/database");
    const last = await createLabActionRequestsRepository(getDatabase()).latestForStep(
      user.id,
      ids.data.stepId,
      "lab.check"
    );
    output = (last?.output ?? "").trim();
    if (!output) {
      return { ok: false, message: "Paste what your terminal printed, or describe what happened." };
    }
  }

  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(
    user.id,
    ids.data.runId
  );
  const step = project?.steps.find((s) => s.id === ids.data.stepId);
  if (!project || !step) return { ok: false, message: "That step could not be found." };

  const generate = await getUserDocGenerate(user.id);
  if (!generate) {
    return { ok: false, message: "Fadi needs an AI provider for this — add one in Settings → AI." };
  }

  const template = templateForProject({ title: project.run.title, detail: project.run.detail });
  const labFacts = placementBriefing({
    hostOs: hostOsOf(process.platform),
    template,
    hostLabel: project.run.resourceLabel,
    containerName: template ? labContainerForRun(project.run.id) : null,
  });
  // The end of the output is where the error is; keep that when trimming.
  const shown = output.length > MAX_OUTPUT ? "…" + output.slice(-MAX_OUTPUT) : output;

  try {
    const reply = await generate.structured(
      SYSTEM,
      [
        `Project: ${project.run.title}`,
        `Step ${step.ordinal}: ${step.title}`,
        `Step instructions:\n${step.instruction}`,
        step.verify ? `Success condition: ${step.verify}` : "",
        `Lab facts:\n${labFacts}`,
        note ? `What they say happened: ${note}` : "",
        shown ? `Terminal output:\n${shown}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      replySchema,
      "step_help"
    );
    const help: StepHelp = {
      whatHappened: reply.whatHappened,
      fix: withCommands(reply.fixExplanation, reply.fixCommands),
      stepWasWrong: reply.stepWasWrong,
      revisedInstruction: reply.revisedCommands
        ? withCommands(reply.revisedExplanation || "In the lab, run:", reply.revisedCommands)
        : "",
      revisedVerify: reply.revisedVerify,
    };
    logger.info("lab.step_help", { userId: user.id, stepWasWrong: help.stepWasWrong });
    return { ok: true, help };
  } catch (err) {
    if (err instanceof AiRateLimitError) {
      return { ok: false, message: err.message };
    }
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn("lab.step_help_failed", { userId: user.id, detail });
    if (/\b429\b|rate.?limit|tokens per minute/i.test(detail)) {
      return {
        ok: false,
        message: "Your AI provider is rate-limiting right now. Wait a minute and ask again.",
      };
    }
    return { ok: false, message: "Fadi couldn't work this one out. Try again in a moment." };
  }
}

/** Accept Fadi's corrected version of a step that could not run as written. */
export async function acceptRevisedStepAction(input: {
  stepId: string;
  instruction: string;
  verify?: string;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const parsed = z
    .object({
      stepId: z.string().uuid(),
      instruction: z.string().trim().min(1).max(2_200),
      verify: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const updated = await createProjectRunsRepository(getDatabase()).reviseOpenStep(
    user.id,
    parsed.data.stepId,
    { instruction: parsed.data.instruction, verify: parsed.data.verify || null }
  );
  return { ok: Boolean(updated) };
}

const CHECK_SYSTEM = `You write ONE check that proves a hands-on lab step succeeded, to run inside the lab container.
You get the step, its success condition, and the lab's facts.

- command: a short, read-only shell command for this lab's shell (no installs, no edits, no service restarts, nothing interactive). Pipelines are fine. Use only tools the lab facts say exist.
- expect: an exact piece of text that the command prints ONLY when the success condition is met (for example "syntax is ok", "Status: active", "HTTP/1.1 200"). Not a word that also appears on failure.
- why: one plain sentence saying what the check proves.
For a Windows lab the command is ONE line of PowerShell, run as the lab's local administrator over SSH (no GUI, no prompts): e.g. Get-WindowsFeature AD-Domain-Services | Select-Object -ExpandProperty InstallState, or Get-ADForest | Select-Object -ExpandProperty Name.
If the success condition cannot be checked from inside the lab (it needs a browser, a person's judgement, or another machine), set command to "" and explain in why.`;

/**
 * Ask Fadi to check the current step inside the lab. Proposes a `lab.check` for approval; the
 * broker runs it and, if it passes, records the step as checked — wherever it is approved.
 */
export async function proposeStepCheckAction(input: {
  runId: string;
  stepId: string;
  /**
   * "Run in lab": also run the step's own commands first, in the machine, approved together
   * with its check — the person stops relaying commands between two places Fadi controls.
   */
  run?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Sign in again." };
  const ids = z.object({ runId: z.string().uuid(), stepId: z.string().uuid() }).safeParse(input);
  if (!ids.success) return { ok: false, message: "That step could not be found." };

  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, ids.data.runId);
  const step = project?.steps.find((s) => s.id === ids.data.stepId);
  if (!project || !step) return { ok: false, message: "That step could not be found." };
  if (step.status === "done") return { ok: false, message: "This step is already done." };

  const template = templateForProject({ title: project.run.title, detail: project.run.detail });
  if (!template) return { ok: false, message: "This project has no lab to check inside." };
  const { LAB_TEMPLATES, labNameForRun } = await import("@/lib/lab/templates");
  const shell = LAB_TEMPLATES[template].toolchain.shell;

  const { createLabResourcesRepository } = await import("@careeros/database");
  const { resolveTarget, unconnectedMessage } = await import("@/lib/lab/target");
  const resource = project.run.resourceId
    ? await createLabResourcesRepository(db).get(user.id, project.run.resourceId)
    : null;
  const target = resolveTarget(
    project.run,
    resource ? { id: resource.id, label: resource.label, endpoint: resource.endpoint } : null
  );
  if (target.kind === "unconnected") return { ok: false, message: unconnectedMessage(target) };

  // THE PERSON'S OWN VMWARE MACHINE: checked over SSH as the account set up for it.
  let vmware: { resourceId: string; user: string } | null = null;
  const name = labNameForRun(project.run.id);
  let labFacts: string;
  if (target.kind === "vmware" && resource) {
    const { readVmxSummary, runningVmxPaths, vmxPathOf } = await import("@/lib/lab/vmware");
    const vmx = vmxPathOf(resource.endpoint);
    const summary = vmx ? await readVmxSummary(vmx) : null;
    if (!summary || !summary.family.startsWith("windows")) {
      return { ok: false, message: "Checks inside your own VMware machines work for Windows machines so far." };
    }
    if (!resource.guestUser) {
      return {
        ok: false,
        message: "Set up checks for this machine first — “Set up checks” in the lab panel, once.",
      };
    }
    if (!vmx || !(await runningVmxPaths())?.has(vmx)) {
      return { ok: false, message: "Start the machine first — there is nothing running to check." };
    }
    vmware = { resourceId: resource.id, user: resource.guestUser };
    labFacts = [
      `The lab is the person's own VMware machine "${resource.label}" (${summary.guestOs}), Windows.`,
      `The check runs as ONE line of PowerShell over SSH, signed in as ${resource.guestUser}, a local administrator.`,
    ].join("\n");
  } else {
    const { containerState } = await import("@/lib/lab/runtime-observer");
    const state = await containerState(name);
    if (!state?.running) return { ok: false, message: "Start the lab first — there is nothing running to check." };
    labFacts = placementBriefing({
      hostOs: hostOsOf(process.platform),
      template,
      hostLabel: target.label,
      containerName: `fadi-${name}`,
    });
  }

  // THE STEP'S OWN CHECK, written with the plan against the observed lab (verified-labs V-2):
  // no second AI call guessing a check after the fact.
  let script: string | null = null;
  if (input.run) {
    const { stepScript } = await import("@/lib/learning/instruction-blocks");
    script = stepScript(step.instruction);
    if (!script) return { ok: false, message: "This step has no commands for Fadi to run." };
    if (!step.checkCommand || !step.checkExpect) {
      return {
        ok: false,
        message:
          "This step has no check of its own, so Fadi can't tell whether running it worked. Do it yourself (Other ways), then Check and continue.",
      };
    }
  }

  if (step.checkCommand && step.checkExpect) {
    const { proposeAction } = await import("@/lib/lab/broker");
    const proposal = await proposeAction({
      userId: user.id,
      recipe: "lab.check",
      params: {
        ...(vmware
          ? { ...vmware, command: step.checkCommand, expect: step.checkExpect, shell: "powershell" }
          : { name, command: step.checkCommand, expect: step.checkExpect, shell, template }),
        ...(script ? { script } : {}),
      },
      actor: "model",
      origin: "dashboard:step_check",
      runId: project.run.id,
      stepId: step.id,
    });
    return proposal.ok
      ? {
          ok: true,
          message: script
            ? "Ready to run this step — approve it here; nothing has run yet."
            : "Running this step's own check — waiting for your approval; nothing has run yet.",
        }
      : { ok: false, message: proposal.message };
  }

  const generate = await getUserDocGenerate(user.id);
  if (!generate) return { ok: false, message: "Fadi needs an AI provider for this — add one in Settings → AI." };

  try {
    const check = await generate.structured(
      CHECK_SYSTEM,
      [
        `Step ${step.ordinal}: ${step.title}`,
        `Instructions:\n${step.instruction}`,
        step.verify ? `Success condition: ${step.verify}` : "Success condition: not written — infer it from the instructions.",
        `Lab facts:\n${labFacts}`,
      ].join("\n\n"),
      z.object({
        command: z.string().max(600),
        expect: z.string().max(200),
        why: z.string().min(1).max(300),
      }),
      "step_check"
    );
    if (!check.command.trim() || !check.expect.trim()) {
      return { ok: false, message: `Fadi can't check this one from inside the lab: ${check.why}` };
    }

    const { proposeAction } = await import("@/lib/lab/broker");
    const proposal = await proposeAction({
      userId: user.id,
      recipe: "lab.check",
      params: vmware
        ? { ...vmware, command: check.command, expect: check.expect, shell: "powershell" }
        : { name, command: check.command, expect: check.expect, shell, template },
      // The command was written by the model, even though a person asked for it.
      actor: "model",
      origin: "dashboard:step_check",
      runId: project.run.id,
      stepId: step.id,
    });
    return proposal.ok
      ? { ok: true, message: `${check.why} Waiting for your approval — nothing has run yet.` }
      : { ok: false, message: proposal.message };
  } catch (err) {
    if (err instanceof AiRateLimitError) return { ok: false, message: err.message };
    const detail = err instanceof Error ? err.message : String(err);
    if (/\b429\b|rate.?limit/i.test(detail)) {
      return { ok: false, message: "Your AI provider is rate-limiting right now. Wait a minute and try again." };
    }
    return { ok: false, message: "Fadi couldn't write a check for this step. Try again in a moment." };
  }
}
