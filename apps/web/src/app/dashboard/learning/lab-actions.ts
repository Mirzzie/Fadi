"use server";

import { z } from "zod";

import { createLabResourcesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { placeLab, type Resource } from "@/lib/lab/capability";
import { specForProject } from "@/lib/lab/spec-from-project";
import { completionFor, completionOf, runHonesty } from "@/lib/lab/completion";
import { templateForProject } from "@/lib/lab/spec-from-project";
import { LAB_TEMPLATES, labContainerForRun } from "@/lib/lab/templates";

/**
 * WHERE COULD I ACTUALLY RUN THIS?
 *
 * The learning section could name a gap and point at a roadmap, then stop. The question
 * standing between that and an evening's work is "and what do I run it on?" — and Fadi
 * had no idea what hardware the user owned, so it could not answer.
 *
 * Asked JUST IN TIME, not at onboarding: a new user does not know whether they will ever
 * want a lab, and a form about hypervisors on day one is a form about nothing. The
 * question earns itself at the moment a project is proposed.
 */

const resourceInput = z.object({
  label: z.string().trim().min(1).max(80),
  kind: z.enum(["laptop", "server", "hypervisor", "vm", "sbc", "microcontroller", "cloud"]),
  arch: z.enum(["x86_64", "arm64", "mcu"]).default("x86_64"),
  memoryMb: z.number().int().positive().max(4_194_304).nullable().optional(),
  diskGb: z.number().int().positive().max(1_000_000).nullable().optional(),
  virtualization: z.enum(["none", "containers", "vms", "nested"]).default("none"),
  alwaysOn: z.boolean().default(false),
  notes: z.string().trim().max(400).optional(),
});

export type LabResourceView = Resource & {
  notes: string | null;
  endpointKind: "vmware" | "remote" | null;
};

async function load(userId: string): Promise<LabResourceView[]> {
  const rows = await createLabResourcesRepository(getDatabase()).listForUser(userId);
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    arch: r.arch as Resource["arch"],
    memoryMb: r.memoryMb,
    diskGb: r.diskGb,
    virtualization: r.virtualization as Resource["virtualization"],
    alwaysOn: r.alwaysOn,
    notes: r.notes,
    endpointKind: r.endpoint?.startsWith("vmware:") ? "vmware" : r.endpoint ? "remote" : null,
  }));
}

/** Register a VMX file the user explicitly selected; this does not start or inspect it. */
export async function registerVmwareMachine(input: {
  label: string;
  path: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({
      label: z.string().trim().min(1).max(80),
      path: z.string().trim().min(1).max(1000),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Give the VM a name and select its .vmx file." };

  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  if (
    !path.isAbsolute(parsed.data.path) ||
    path.extname(parsed.data.path).toLowerCase() !== ".vmx"
  ) {
    return { ok: false, message: "Use the absolute path to a VMware .vmx file." };
  }
  let resolved: string;
  try {
    resolved = await fs.realpath(parsed.data.path);
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return { ok: false, message: "That path is not a VMX file." };
  } catch {
    return { ok: false, message: "Fadi could not read that VMX file." };
  }

  await createLabResourcesRepository(getDatabase()).upsertDetected(user.id, {
    label: parsed.data.label,
    kind: "vm",
    arch: "x86_64",
    memoryMb: null,
    diskGb: null,
    virtualization: "none",
    alwaysOn: false,
    notes: "Existing local VMware guest. Capacity and guest readiness are not yet observed.",
    scopes: ["read", "provision"],
    endpoint: `vmware://local${encodeURI(resolved)}`,
    secretCiphertext: null,
    secretHint: null,
    lastSeenAt: null,
  });
  return {
    ok: true,
    message: "VMware machine connected. Starting or suspending it still needs approval.",
  };
}

export async function listLabResources(): Promise<{ ok: boolean; resources: LabResourceView[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, resources: [] };
  return { ok: true, resources: await load(user.id) };
}

export async function addLabResource(
  input: z.input<typeof resourceInput>
): Promise<{ ok: boolean; message?: string; resources?: LabResourceView[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const parsed = resourceInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the details and try again." };

  // upsert, not create. Detecting this laptop three times found the same laptop three
  // times and recorded it three times, which turned the inventory into noise and made
  // placement answer "unmeasured: This machine, This machine, This machine".
  const db = getDatabase();
  const repo = createLabResourcesRepository(db);
  const before = (await repo.listForUser(user.id)).some((r) => r.label === parsed.data.label);
  const saved = await repo.upsertDetected(user.id, {
    ...parsed.data,
    memoryMb: parsed.data.memoryMb ?? null,
    diskGb: parsed.data.diskGb ?? null,
    notes: parsed.data.notes || null,
    // Read-only until a write scope is deliberately granted (ADR 0011).
    scopes: ["read"],
  });

  await recordRegistryChange(user.id, {
    capability: before ? "machine.update" : "machine.add",
    resourceId: saved.id,
    detail: (before ? "Updated " : "Added ") + saved.label + " in the registry.",
  });
  return { ok: true, resources: await load(user.id) };
}

/**
 * THE REGISTRY IS PART OF THE RECORD.
 *
 * Found the dull way: three machines vanished from a registry and the audit log could not
 * say who removed them or when, because registry changes were never recorded at all. "You
 * see every single action Fadi takes" cannot have a hole where the inventory is — and the
 * moment a person most needs the log to work is exactly when something has gone missing.
 */
async function recordRegistryChange(
  userId: string,
  input: { capability: string; resourceId: string; detail: string }
): Promise<void> {
  const { createLabActionsRepository } = await import("@careeros/database");
  await createLabActionsRepository(getDatabase()).record({
    userId,
    actor: "user",
    origin: "dashboard:machines",
    capability: input.capability,
    resourceId: input.resourceId,
    decision: "allowed",
    detail: input.detail,
  });
}

export async function removeLabResource(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false };

  const repo = createLabResourcesRepository(getDatabase());
  // Read the label BEFORE deleting: "removed a machine" is not a sentence anyone can act
  // on, and afterwards there is nothing left to name it by.
  const existing = (await repo.listForUser(user.id)).find((r) => r.id === parsed.data);
  await repo.remove(user.id, parsed.data);

  await recordRegistryChange(user.id, {
    capability: "machine.forget",
    resourceId: parsed.data,
    detail: "Removed " + (existing?.label ?? "a machine") + " from the registry.",
  });
  return { ok: true };
}

export type LabPlan = {
  /** Why the project needs what it needs, in the project's own terms. */
  because: string[];
  fits: { id: string; label: string }[];
  unverified: { id: string; label: string; checks: string[] }[];
  misses: { id: string; label: string; reasons: string[] }[];
  /** True when nothing is registered yet — the moment to ask. */
  noResources: boolean;
};

/** Can this proposed project run on anything the user actually owns? */
export async function planLabFor(input: {
  title: string;
  detail?: string | null;
}): Promise<{ ok: boolean; plan?: LabPlan; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const resources = await load(user.id);
  const { spec, because } = specForProject(input);

  if (resources.length === 0) {
    return { ok: true, plan: { because, fits: [], unverified: [], misses: [], noResources: true } };
  }

  const { fits, unverified, misses } = placeLab(spec, resources);
  return {
    ok: true,
    plan: {
      because,
      noResources: false,
      fits: fits.map((r) => ({ id: r.id, label: r.label })),
      unverified: unverified.map((u) => ({
        id: u.resource.id,
        label: u.resource.label,
        checks: u.checks,
      })),
      misses: misses.map((m) => ({
        id: m.resource.id,
        label: m.resource.label,
        reasons: m.reasons,
      })),
    },
  };
}

/* ------------------------------------------------------------------ project runs */

export type StepView = {
  id: string;
  ordinal: number;
  title: string;
  instruction: string;
  verify: string | null;
  produces: string | null;
  status: string;
  artifact: string | null;
  /** attested | evidenced | verified — null while pending. */
  completion: string | null;
  /** lab | browser | fadi — where the step happens; null on steps planned before places. */
  place: string | null;
  /** The step's own check, when the plan gave one. */
  check: { command: string; expect: string } | null;
};
export type RunView = {
  id: string;
  title: string;
  detail: string | null;
  resourceId: string | null;
  resourceLabel: string | null;
  status: string;
  /** The commitment this project fulfils; null for runs planned before the link existed. */
  commitmentId: string | null;
  steps: StepView[];
  /**
   * How many completed steps actually left something behind.
   *
   * The number the finishing copy has to be built on. Six done steps and zero evidenced
   * ones is a memory of a project, and describing it as achievement would be Fadi
   * inventing the thing it exists to refuse to invent.
   */
  evidencedCount: number;
  doneCount: number;
  /**
   * Which lab this project needs, or null when it needs none.
   *
   * The same decision the provisioner makes, carried to the page so a ServiceNow project —
   * a website — stops offering "Prepare lab" and a machine surface for a machine it will
   * never have.
   */
  labTemplate: string | null;
  labLabel: string | null;
  /** How to sign in to the lab machine, when it has a login (Windows labs). */
  labSignIn: { user: string; password: string } | null;
  /** The exact command that opens a shell in this project's lab; null for desktop labs. */
  labShell: string | null;
  /** Where the lab runs, resolved from stored identity: "This computer", a VM, or unconnected. */
  target: { kind: "local-docker" | "vmware" | "unconnected"; label: string };
};

/** Plan a committed project into steps against hardware the user actually owns. */
export async function planProjectAction(input: {
  title: string;
  detail?: string | null;
}): Promise<{ ok: boolean; message?: string; runId?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { planProjectRun } = await import("@/lib/lab/plan-run");
  const res = await planProjectRun(user.id, input);
  return res.ok ? { ok: true, runId: res.plan.runId } : { ok: false, message: res.message };
}

export async function listProjectRuns(): Promise<{ ok: boolean; runs: RunView[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, runs: [] };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const repo = createProjectRunsRepository(getDatabase());
  // Only the active direction's projects. A project belongs to the direction it was planned
  // under; after switching from SOC Analyst to IT System Administrator the SOC labs were still
  // listed. (Someone with no direction at all sees projects with none.)
  const { createCareerProfilesRepository } = await import("@careeros/database");
  const track = await createCareerProfilesRepository(getDatabase()).getActiveForUser(user.id);
  const runs = (await repo.listForUser(user.id)).filter(
    (run) => (run.careerProfileId ?? null) === (track?.id ?? null)
  );
  const { resolveTarget } = await import("@/lib/lab/target");
  const resourcesById = new Map(
    (await createLabResourcesRepository(getDatabase()).listForUser(user.id)).map((r) => [r.id, r])
  );
  // In parallel: the list used to load each project's steps one after another.
  const out = (
    await Promise.all(
      runs
        .filter((x) => x.status !== "abandoned")
        .map(async (r) => {
          const detail = await repo.getWithSteps(user.id, r.id);
          return detail ? toRunView(detail.run, detail.steps, resourcesById, resolveTarget) : null;
        })
    )
  ).filter((view): view is RunView => Boolean(view));
  return { ok: true, runs: out };
}

type RunRow = Awaited<
  ReturnType<ReturnType<typeof import("@careeros/database").createProjectRunsRepository>["getWithSteps"]>
> & {};
type Resources = Map<
  string,
  NonNullable<Awaited<ReturnType<ReturnType<typeof createLabResourcesRepository>["get"]>>>
>;

/** A project as the page shows it. One builder, for the list and for a single project. */
function toRunView(
  r: NonNullable<RunRow>["run"],
  steps: NonNullable<RunRow>["steps"],
  resourcesById: Resources,
  resolveTarget: typeof import("@/lib/lab/target").resolveTarget
): RunView {
  const honesty = runHonesty(steps);
  const template = templateForProject({ title: r.title, detail: r.detail });
  const resource = r.resourceId ? resourcesById.get(r.resourceId) : undefined;
  const resolved = resolveTarget(
    r,
    resource ? { id: resource.id, label: resource.label, endpoint: resource.endpoint } : null
  );
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    resourceId: r.resourceId,
    resourceLabel: r.resourceLabel,
    status: r.status,
    commitmentId: r.commitmentId ?? null,
    steps: steps.map((s) => ({
      id: s.id,
      ordinal: s.ordinal,
      title: s.title,
      instruction: s.instruction,
      verify: s.verify,
      produces: s.produces,
      place: s.place ?? null,
      check:
        s.checkCommand && s.checkExpect ? { command: s.checkCommand, expect: s.checkExpect } : null,
      status: s.status,
      artifact: s.artifact,
      // One rule, one place: lib/lab/completion.ts decides what counts as showable,
      // because this is the judgement Fadi later repeats to an employer.
      completion: completionOf(s),
    })),
    doneCount: honesty.done,
    evidencedCount: honesty.evidenced,
    labTemplate: template,
    labLabel: template ? LAB_TEMPLATES[template].label : null,
    // Fadi's own lab account and shell belong to its container labs; the person's own VMware
    // machine signs in with their account.
    labSignIn:
      template && resolved.kind === "local-docker"
        ? (LAB_TEMPLATES[template].signIn ?? null)
        : null,
    target: { kind: resolved.kind, label: resolved.label },
    labShell:
      resolved.kind === "local-docker" &&
      template &&
      LAB_TEMPLATES[template].toolchain.shell !== "powershell"
        ? `docker exec -it ${labContainerForRun(r.id)} ${LAB_TEMPLATES[template].toolchain.shell}`
        : null,
  };
}

/**
 * One project, for the project page's poll. It used to call listProjectRuns every 8 seconds —
 * every project with every step — to show one of them (438 calls in one session, 29 Sep 2026).
 */
export async function getProjectRunAction(input: {
  runId: string;
}): Promise<{ ok: boolean; run: RunView | null }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, run: null };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, run: null };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const db = getDatabase();
  const detail = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  if (!detail) return { ok: true, run: null };
  const resource = detail.run.resourceId
    ? await createLabResourcesRepository(db).get(user.id, detail.run.resourceId)
    : null;
  const { resolveTarget } = await import("@/lib/lab/target");
  const resources: Resources = new Map(resource ? [[resource.id, resource]] : []);
  return { ok: true, run: toRunView(detail.run, detail.steps, resources, resolveTarget) };
}

/** The one place a project's lab target is decided — see lib/lab/target.ts. */
/**
 * What starting this VMware machine involves: nothing, when it is already running (Fadi uses
 * it as it is, whoever started it); otherwise a start, plus turning its screen on the first
 * time so it can be shown in the project.
 */
async function vmwareStart(resource: { id: string; endpoint: string | null }): Promise<
  { running: true } | { running: false; params: { resourceId: string; screen: boolean } }
> {
  const { readVmxSummary, runningVmxPaths, vmxPathOf } = await import("@/lib/lab/vmware");
  const vmxPath = vmxPathOf(resource.endpoint);
  if (vmxPath && (await runningVmxPaths())?.has(vmxPath)) return { running: true };
  const summary = vmxPath ? await readVmxSummary(vmxPath) : null;
  return { running: false, params: { resourceId: resource.id, screen: !summary?.screen } };
}

async function targetFor(
  userId: string,
  run: { resourceId: string | null }
): Promise<{
  target: import("@/lib/lab/target").LabTarget;
  resource: Awaited<ReturnType<ReturnType<typeof createLabResourcesRepository>["get"]>>;
}> {
  const { resolveTarget } = await import("@/lib/lab/target");
  const resource = run.resourceId
    ? await createLabResourcesRepository(getDatabase()).get(userId, run.resourceId)
    : null;
  return {
    target: resolveTarget(
      run,
      resource ? { id: resource.id, label: resource.label, endpoint: resource.endpoint } : null
    ),
    resource,
  };
}

/**
 * Prepare the reviewed local Docker lab that best matches this project.
 *
 * This creates an approval request and nothing else. The project and current step travel
 * with that request so the global approval queue, runtime surface, audit trail, and later
 * evidence all refer to the same work.
 */
export async function proposeProjectLabAction(input: { runId: string }): Promise<{
  ok: boolean;
  requestId?: string;
  message?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const { createLabActionRequestsRepository, createProjectRunsRepository } =
    await import("@careeros/database");
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const requests = createLabActionRequestsRepository(db);
  const existing = await requests.latestForRun(user.id, id.data, "lab.start");
  if (existing?.status === "pending" || existing?.status === "approved") {
    return {
      ok: true,
      requestId: existing.id,
      message: "The lab is already waiting for your decision.",
    };
  }

  const { proposeAction } = await import("@/lib/lab/broker");
  const { target, resource } = await targetFor(user.id, project.run);
  if (target.kind === "unconnected") {
    const { unconnectedMessage } = await import("@/lib/lab/target");
    return { ok: false, message: unconnectedMessage(target) };
  }
  if (target.kind === "vmware" && resource) {
    const prepared = await vmwareStart(resource);
    if (prepared.running) {
      return { ok: true, message: `${resource.label} is already running — Fadi uses it as it is.` };
    }
    const proposal = await proposeAction({
      userId: user.id,
      recipe: "vmware.start",
      params: prepared.params,
      actor: "user",
      origin: "dashboard:project_lab",
      runId: project.run.id,
      stepId: project.steps.find((step) => step.status === "pending")?.id ?? null,
    });
    return proposal.ok
      ? {
          ok: true,
          requestId: proposal.requestId,
          message: `${resource.label} is ready for your approval. Nothing has run yet.`,
        }
      : { ok: false, message: proposal.message };
  }

  const { templateForProject } = await import("@/lib/lab/spec-from-project");
  const { LAB_TEMPLATES, labNameForRun } = await import("@/lib/lab/templates");
  const template = templateForProject({
    title: project.run.title,
    detail: project.run.detail,
  });

  // NO LAB IS A REAL ANSWER, and refusing here is the point. A ServiceNow project was
  // given an Ubuntu container: ServiceNow is a website, so the container did nothing
  // except cost disk and ask for permissions the work never needed.
  if (!template) {
    return {
      ok: false,
      message:
        "This project doesn't need a lab machine — it's done in your browser or on your own computer. Nothing to start.",
    };
  }

  const currentStep = project.steps.find((step) => step.status === "pending") ?? null;
  // A saved, installed base means this lab can start from a copy instead of downloading and
  // installing Windows again — but only for a lab that has no disk of its own yet.
  const { supportsBase, baseVolumeFor, storageVolumeFor } = await import("@/lib/lab/templates");
  const { volumeExists } = await import("@/lib/lab/runtime-observer");
  const labName = labNameForRun(project.run.id);
  const fromBase =
    supportsBase(template) &&
    (await volumeExists(baseVolumeFor(template))) &&
    !(await volumeExists(storageVolumeFor("fadi-" + labName)));
  // Windows labs get Fadi's public lab key at install, so their steps can be checked over SSH.
  const sshKey =
    LAB_TEMPLATES[template].toolchain.shell === "powershell"
      ? (await (await import("@/lib/lab/lab-ssh")).ensureLabKey()).publicKey
      : null;
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "lab.start",
    params: { template, name: labName, fromBase, sshKey },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
    stepId: currentStep?.id ?? null,
  });
  return proposal.ok
    ? {
        ok: true,
        requestId: proposal.requestId,
        message: `${LAB_TEMPLATES[template].label} is ready for your approval. Nothing has run yet.`,
      }
    : { ok: false, message: proposal.message };
}

export type ProjectRuntimeView = Awaited<
  ReturnType<(typeof import("@/lib/lab/runtime-observer"))["observeProjectRuntime"]>
>;

/** Current observed state; safe to poll because it only inspects Fadi's named container. */
export async function projectRuntimeAction(input: {
  runId: string;
}): Promise<{ ok: boolean; runtime?: ProjectRuntimeView; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const { observeProjectRuntime } = await import("@/lib/lab/runtime-observer");
  return { ok: true, runtime: await observeProjectRuntime(user.id, id.data) };
}

/** Ask to stop this project's current local lab. Approval remains per action. */
export async function proposeProjectLabStopAction(input: { runId: string }): Promise<{
  ok: boolean;
  requestId?: string;
  message?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const { createLabActionRequestsRepository, createProjectRunsRepository } =
    await import("@careeros/database");
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };
  const { target, resource } = await targetFor(user.id, project.run);
  if (target.kind === "unconnected") {
    const { unconnectedMessage } = await import("@/lib/lab/target");
    return { ok: false, message: unconnectedMessage(target) };
  }
  if (target.kind === "vmware" && resource) {
    const { proposeAction } = await import("@/lib/lab/broker");
    const proposal = await proposeAction({
      userId: user.id,
      recipe: "vmware.suspend",
      params: { resourceId: resource.id },
      actor: "user",
      origin: "dashboard:project_lab",
      runId: project.run.id,
      stepId: project.steps.find((step) => step.status === "pending")?.id ?? null,
    });
    return proposal.ok
      ? {
          ok: true,
          requestId: proposal.requestId,
          message: "Suspend is waiting for your approval.",
        }
      : { ok: false, message: proposal.message };
  }

  const started = await createLabActionRequestsRepository(db).latestForRun(
    user.id,
    id.data,
    "lab.start"
  );
  const raw = started?.params as { name?: unknown } | null;
  if (started?.status !== "executed" || typeof raw?.name !== "string") {
    return { ok: false, message: "There is no running project lab to stop." };
  }

  const { proposeAction } = await import("@/lib/lab/broker");
  const currentStep = project.steps.find((step) => step.status === "pending") ?? null;
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "container.stop",
    params: { name: raw.name },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
    stepId: currentStep?.id ?? null,
  });
  return proposal.ok
    ? { ok: true, requestId: proposal.requestId, message: "Stop is waiting for your approval." }
    : { ok: false, message: proposal.message };
}

/** Resume a stopped project lab without creating a second machine. */
export async function proposeProjectLabResumeAction(input: { runId: string }): Promise<{
  ok: boolean;
  requestId?: string;
  message?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const { createLabActionRequestsRepository, createProjectRunsRepository } =
    await import("@careeros/database");
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };
  const { target, resource } = await targetFor(user.id, project.run);
  if (target.kind === "unconnected") {
    const { unconnectedMessage } = await import("@/lib/lab/target");
    return { ok: false, message: unconnectedMessage(target) };
  }
  if (target.kind === "vmware" && resource) {
    const prepared = await vmwareStart(resource);
    if (prepared.running) {
      return { ok: true, message: `${resource.label} is already running — Fadi uses it as it is.` };
    }
    const { proposeAction } = await import("@/lib/lab/broker");
    const proposal = await proposeAction({
      userId: user.id,
      recipe: "vmware.start",
      params: prepared.params,
      actor: "user",
      origin: "dashboard:project_lab",
      runId: project.run.id,
      stepId: project.steps.find((step) => step.status === "pending")?.id ?? null,
    });
    return proposal.ok
      ? { ok: true, requestId: proposal.requestId, message: "Resume is waiting for your approval." }
      : { ok: false, message: proposal.message };
  }

  const started = await createLabActionRequestsRepository(db).latestForRun(
    user.id,
    id.data,
    "lab.start"
  );
  const raw = started?.params as { name?: unknown } | null;
  if (started?.status !== "executed" || typeof raw?.name !== "string") {
    return { ok: false, message: "There is no stopped project lab to resume." };
  }

  const { proposeAction } = await import("@/lib/lab/broker");
  const currentStep = project.steps.find((step) => step.status === "pending") ?? null;
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "container.start",
    params: { name: raw.name },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
    stepId: currentStep?.id ?? null,
  });
  return proposal.ok
    ? { ok: true, requestId: proposal.requestId, message: "Resume is waiting for your approval." }
    : { ok: false, message: proposal.message };
}

/**
 * Mark a step done — and record HOW, which is the part that keeps this honest.
 *
 * Clicking Done with an empty field is a claim about the past with nothing behind it. It
 * is still allowed, because sometimes you did the thing and there is genuinely nothing to
 * paste. What is NOT allowed is for that click to be indistinguishable afterwards from an
 * evening's work with output to show — so it is recorded as `attested`, and nothing
 * downstream may treat an attested step as evidence.
 */
export async function completeStepAction(input: {
  stepId: string;
  artifact?: string | null;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const artifact = input.artifact?.trim() || null;
  const { createProjectRunsRepository } = await import("@careeros/database");
  const runs = createProjectRunsRepository(getDatabase());
  const updated = await runs.setStepStatus(user.id, input.stepId, {
    status: "done",
    artifact,
    completion: completionFor(artifact),
  });

  // The last completed step closes the loop immediately. saveEvidenceOnce locks the run and makes
  // this idempotent across retries or two tabs; the summary is derived only from recorded results.
  if (updated) {
    const project = await runs.getWithSteps(user.id, updated.runId);
    if (project?.run.status === "done" && !project.run.evidenceItemId) {
      const { completionReview } = await import("@/lib/learning/project-review");
      const { saveProjectEvidenceAction } = await import("./project-finish-actions");
      const summary = completionReview(project.run.title, project.steps).summary;
      await saveProjectEvidenceAction({ runId: project.run.id, summary });
    }
  }
  return { ok: Boolean(updated) };
}

/**
 * PLAN IT AGAIN, because a wrong plan is otherwise a dead end.
 *
 * A run was produced whose steps described installing a Windows .msi while the lab it was
 * placed on ran Ubuntu. Every instruction was unfollowable and there was nothing to do
 * about it: no re-plan, no edit, only abandon and start over, losing the project.
 *
 * Replaces the steps, keeps the run. Anything already recorded against a step goes with
 * the step — which is why it says so, and why a run with evidence attached is worth
 * thinking twice about.
 */
export async function replanProjectAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message?: string; steps?: number }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().uuid().safeParse(input.runId).success) {
    return { ok: false, message: "Unknown project." };
  }

  const { createProjectRunsRepository } = await import("@careeros/database");
  const repo = createProjectRunsRepository(getDatabase());
  const existing = await repo.getWithSteps(user.id, input.runId);
  if (!existing) return { ok: false, message: "That project is gone." };

  const { planProjectRun } = await import("@/lib/lab/plan-run");
  const planned = await planProjectRun(user.id, {
    title: existing.run.title,
    detail: existing.run.detail,
    replaceRunId: input.runId,
    completedSteps: existing.steps
      .filter((step) => step.status === "done")
      .map((step) => ({ title: step.title, result: step.artifact })),
  });

  if (!planned.ok) return { ok: false, message: planned.message };
  return { ok: true, steps: planned.plan.steps };
}

/**
 * Start a project over: a fresh plan from step one, every step replaced, finished ones too.
 *
 * The new plan is made BEFORE anything is removed, so a planner that fails leaves the project
 * exactly as it was. The machine, its services and the project's history (receipts, evidence
 * already admitted) stay; only the steps start again.
 */
export async function resetProjectAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message?: string; steps?: number }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().uuid().safeParse(input.runId).success) {
    return { ok: false, message: "Unknown project." };
  }
  const { createProjectRunsRepository } = await import("@careeros/database");
  const existing = await createProjectRunsRepository(getDatabase()).getWithSteps(
    user.id,
    input.runId
  );
  if (!existing) return { ok: false, message: "That project is gone." };

  const { planProjectRun } = await import("@/lib/lab/plan-run");
  const planned = await planProjectRun(user.id, {
    title: existing.run.title,
    detail: existing.run.detail,
    replaceRunId: input.runId,
    startOver: true,
  });
  if (!planned.ok) return { ok: false, message: planned.message };
  return {
    ok: true,
    steps: planned.plan.steps,
    message: `Started over with ${planned.plan.steps} new steps. Your machine and services are as they were.`,
  };
}

/**
 * Can this project's lab be started over from a saved base (no download, no Setup)? And if so,
 * ask for it — one typed approval.
 */
async function labResetPlan(userId: string, runId: string) {
  const { createProjectRunsRepository } = await import("@careeros/database");
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
  if (!project) return { ok: false as const, reason: "That project is gone." };
  if (project.run.resourceId) {
    return { ok: false as const, reason: "Resetting your own VMware machine comes with snapshots — not yet." };
  }
  const { templateForProject } = await import("@/lib/lab/spec-from-project");
  const template = templateForProject({ title: project.run.title, detail: project.run.detail });
  const { supportsBase, baseVolumeFor, labNameForRun, LAB_TEMPLATES } = await import(
    "@/lib/lab/templates"
  );
  if (!template || !supportsBase(template)) {
    return { ok: false as const, reason: "This lab starts fresh in seconds anyway — nothing to reset from." };
  }
  const { containerState, volumeExists } = await import("@/lib/lab/runtime-observer");
  if (!(await volumeExists(baseVolumeFor(template)))) {
    return {
      ok: false as const,
      reason: `No clean ${LAB_TEMPLATES[template].label} has been saved yet. Save one (“Save as base”, while a freshly installed lab is stopped) and every reset after that takes minutes.`,
    };
  }
  const name = labNameForRun(project.run.id);
  return {
    ok: true as const,
    project,
    template,
    name,
    container: Boolean(await containerState(name)),
  };
}

export async function labResetAvailabilityAction(input: {
  runId: string;
}): Promise<{ available: boolean; reason: string | null }> {
  const user = await getCurrentAuthUser();
  if (!user || !z.string().uuid().safeParse(input.runId).success) {
    return { available: false, reason: null };
  }
  const plan = await labResetPlan(user.id, input.runId);
  return plan.ok ? { available: true, reason: null } : { available: false, reason: plan.reason };
}

export async function proposeLabResetAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().uuid().safeParse(input.runId).success) return { ok: false, message: "Unknown project." };
  const plan = await labResetPlan(user.id, input.runId);
  if (!plan.ok) return { ok: false, message: plan.reason };
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "lab.reset",
    params: { template: plan.template, name: plan.name, container: plan.container },
    actor: "user",
    origin: "dashboard:project_reset",
    runId: plan.project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "Resetting the lab is waiting for your approval (type its name)." }
    : { ok: false, message: proposal.message };
}

/** Reopen a step — because "I marked that too early" needs a way back. */
export async function reopenStepAction(input: { stepId: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const updated = await createProjectRunsRepository(getDatabase()).setStepStatus(
    user.id,
    input.stepId,
    {
      status: "pending",
      artifact: null,
      completion: null,
    }
  );
  return { ok: Boolean(updated) };
}

/**
 * Stop a project.
 *
 * Two verbs on purpose. Abandoning keeps the plan — "I tried this and it wasn't for me"
 * is information, and it stops a gap looking unexplained later. Deleting removes it
 * outright, for a plan generated by mistake, because refusing to delete that is the
 * platform deciding it knows better than the person whose account it is.
 */
export async function stopProjectRun(input: {
  runId: string;
  mode: "abandon" | "delete";
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().uuid().safeParse(input.runId).success) {
    return { ok: false, message: "Unknown project." };
  }

  const { createProjectRunsRepository } = await import("@careeros/database");
  const repo = createProjectRunsRepository(getDatabase());
  if (input.mode === "delete") {
    const removed = await repo.remove(user.id, input.runId);
    return removed ? { ok: true } : { ok: false, message: "That project is already gone." };
  }
  await repo.abandon(user.id, input.runId);
  return { ok: true };
}

/* --------------------------------------------------------- detect, never control */

export type DetectedResource = {
  label: string;
  kind: string;
  arch: string | null;
  virtualization: string;
  memoryMb: number | null;
  /** Free space on this machine. Null when host access was not granted. */
  diskGb: number | null;
  detail: string;
};

/**
 * Look at this machine and PROPOSE what it could host.
 *
 * Fadi runs on the user's own laptop, so asking them to type what is installed is asking
 * them to transcribe something Fadi can read. It reads it.
 *
 * It proposes; it does not register. Detecting a hypervisor must not silently grant Fadi
 * a resource it may later be asked to provision on — the same boundary as network
 * discovery, applied to the machine underneath. The user confirms what gets saved.
 */
export async function detectLocalResources(): Promise<{
  ok: boolean;
  detected?: DetectedResource[];
  absent?: string[];
  /** What Fadi was not allowed to look at, so the user can allow it here and retry. */
  needsGrant?: Array<{ capability: string; summary: string; limit: string }>;
  message?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { scanLocalMachine } = await import("@/lib/lab/local-probe");
  // actor "user" because a person clicked this. When a model or an MCP client asks, it
  // says so — and that distinction is the whole value of the audit log.
  const scan = await scanLocalMachine({
    userId: user.id,
    actor: "user",
    origin: "dashboard:detect_local",
  });

  const detected: DetectedResource[] = scan.findings.map((f) => ({
    label: f.label,
    kind: f.kind,
    // Null when host access was not granted. It stays null rather than defaulting to
    // x86_64: a guess that looks like a reading is worse than an absent reading.
    arch: scan.host?.arch ?? null,
    virtualization: f.virtualization,
    // Real memory, read from the machine rather than remembered by its owner — this is
    // the number AM01 kept reporting as "not enough recorded to tell".
    memoryMb: scan.host?.memoryMb ?? null,
    diskGb: scan.host?.freeDiskGb ?? null,
    detail: f.detail,
  }));

  return { ok: true, detected, absent: scan.absent, needsGrant: scan.needsGrant };
}

export type ComputerLabView = {
  runId: string;
  projectTitle: string;
  labLabel: string;
  phase: string;
  detail: string;
};

/**
 * The labs on this computer, for the Machines page — one row per project that has one.
 *
 * Reported: "why are these lab containers not listed in Machines?" They were only visible
 * inside their own project. Read through the same observer the project page uses, so it
 * needs no broader Docker access than that page does, and says the same thing.
 */
export type LeftoverLabView = {
  name: string;
  /** False when only the saved disk remains. */
  container: boolean;
  /** A named volume survives `docker rm`; removing the container does not free this. */
  keptData: boolean;
  detail: string;
};

export async function listComputerLabsAction(): Promise<{
  ok: boolean;
  labs: ComputerLabView[];
  leftovers: LeftoverLabView[];
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, labs: [], leftovers: [] };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const { observeProjectRuntime } = await import("@/lib/lab/runtime-observer");
  const { runtimeMessage } = await import("@/lib/lab/runtime-contract");
  const runs = (await createProjectRunsRepository(getDatabase()).listForUser(user.id)).filter(
    (run) => run.status !== "abandoned"
  );
  const observed = await Promise.all(
    runs.map(async (run) => ({ run, runtime: await observeProjectRuntime(user.id, run.id) }))
  );
  // LEFTOVERS. Deleting a project left its container behind — found with a stopped nginx lab
  // and a Windows disk nobody could see or remove. Only containers Fadi itself created for this
  // person are considered, the same list the broker enforces for removal.
  //
  // Association comes from durable records — the lab.start request each current project made —
  // not from whether observing it succeeded: a failed observation must not make a project's lab
  // look like a leftover someone could remove.
  const { createLabActionRequestsRepository } = await import("@careeros/database");
  const { containerState, classifyExit, volumeExists } = await import("@/lib/lab/runtime-observer");
  const requests = createLabActionRequestsRepository(getDatabase());
  const created = new Set([
    ...(await requests.createdNames(user.id, "lab.start")),
    ...(await requests.createdNames(user.id, "container.run")),
  ]);
  const inProjects = new Set(
    (
      await Promise.all(runs.map((run) => requests.latestForRun(user.id, run.id, "lab.start")))
    ).flatMap((request) => {
      const name = (request?.params as { name?: unknown } | null)?.name;
      return typeof name === "string" ? [name] : [];
    })
  );
  const leftovers = (
    await Promise.all(
      [...created]
        .filter((name) => !inProjects.has(name))
        .map(async (name): Promise<LeftoverLabView | null> => {
          const [state, hasData] = await Promise.all([
            containerState(name),
            volumeExists(`fadi-${name}-storage`),
          ]);
          if (!state && !hasData) return null;
          return {
            name,
            container: Boolean(state),
            // An older lab may keep its disk in an unnamed volume; that survives removal too.
            keptData: hasData || (state?.volumes ?? 0) > 0,
            detail: !state
              ? "Container removed · its saved disk is still on this computer"
              : state.running
                ? "Running"
                : classifyExit(state).phase === "failed"
                  ? "Stopped with an error"
                  : "Stopped",
          };
        })
    )
  ).filter((lab): lab is LeftoverLabView => Boolean(lab));

  return {
    ok: true,
    leftovers,
    labs: observed.flatMap(({ run, runtime }) =>
      runtime
        ? [
            {
              runId: run.id,
              projectTitle: run.title,
              labLabel: runtime.templateLabel,
              phase: runtime.phase,
              detail: runtimeMessage(runtime),
            },
          ]
        : []
    ),
  };
}

/** Ask to remove a leftover lab container. Irreversible, so the broker asks for its name. */
export async function proposeRemoveLeftoverLabAction(input: {
  name: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  // Revalidated now, not trusted from the page: a project may have claimed this lab since.
  const current = await listComputerLabsAction();
  if (!current.leftovers.some((lab) => lab.name === input.name && lab.container)) {
    return { ok: false, message: "That lab belongs to a current project, or is already gone." };
  }
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "container.remove",
    params: { name: input.name },
    actor: "user",
    origin: "dashboard:machines",
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval." }
    : { ok: false, message: proposal.message };
}

/**
 * Run a project on this computer instead of a machine Fadi can't reach. Explicit, and only for an
 * unconnected target: a project on a reachable VM keeps its placement unless that is a decision.
 */
export async function runOnThisComputerAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const runs = createProjectRunsRepository(getDatabase());
  const project = await runs.getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };
  const { target } = await targetFor(user.id, project.run);
  if (target.kind !== "unconnected") {
    return { ok: false, message: "This project already runs somewhere Fadi can reach." };
  }
  await runs.placeOnThisComputer(user.id, id.data);
  await recordRegistryChange(user.id, {
    capability: "project.placement",
    resourceId: target.resourceId,
    detail: `Moved "${project.run.title}" from ${target.label} to this computer.`,
  });
  return { ok: true, message: "This project now runs on this computer." };
}

export type LabDisksView = {
  labs: import("@/lib/lab/disks").LabDiskView[];
  bases: Array<{ template: string; label: string; bytes: number | null }>;
  totalBytes: number;
};

/**
 * Every lab Fadi created on this computer, what it really takes on disk, and whether it is
 * worth removing. Measured on request, not polled: each size is a short `du` in a helper.
 */
export async function labDisksAction(): Promise<{ ok: boolean; view?: LabDisksView }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const { createLabActionRequestsRepository, createProjectRunsRepository } =
    await import("@careeros/database");
  const { containerState, volumeExists, volumeUsageBytes } =
    await import("@/lib/lab/runtime-observer");
  const { describeLabDisk } = await import("@/lib/lab/disks");
  const { baseVolumeFor, labNameForRun, storageVolumeFor, supportsBase } =
    await import("@/lib/lab/templates");
  const db = getDatabase();
  const requests = createLabActionRequestsRepository(db);
  const names = new Set([
    ...(await requests.createdNames(user.id, "lab.start")),
    ...(await requests.createdNames(user.id, "container.run")),
  ]);
  const runs = await createProjectRunsRepository(db).listForUser(user.id);
  const runByLab = new Map(runs.map((run) => [labNameForRun(run.id), run]));

  const labs = (
    await Promise.all(
      [...names].map(async (name) => {
        const volume = storageVolumeFor("fadi-" + name);
        const [state, hasDisk] = await Promise.all([containerState(name), volumeExists(volume)]);
        if (!state && !hasDisk) return null;
        const run = runByLab.get(name) ?? null;
        return describeLabDisk({
          name,
          projectTitle: run?.title ?? null,
          projectStatus: run?.status ?? null,
          running: Boolean(state?.running),
          container: Boolean(state),
          lastActiveAt: state?.lastActiveAt ?? null,
          bytes: hasDisk ? await volumeUsageBytes(volume) : null,
        });
      })
    )
  ).filter((lab): lab is NonNullable<typeof lab> => Boolean(lab));

  const bases = (
    await Promise.all(
      (Object.keys(LAB_TEMPLATES) as Array<keyof typeof LAB_TEMPLATES>)
        .filter((key) => supportsBase(key as never))
        .map(async (key) => {
          const volume = baseVolumeFor(key as never);
          if (!(await volumeExists(volume))) return null;
          return {
            template: key,
            label: LAB_TEMPLATES[key].label,
            bytes: await volumeUsageBytes(volume),
          };
        })
    )
  ).filter((base): base is NonNullable<typeof base> => Boolean(base));

  const totalBytes = [...labs, ...bases].reduce((sum, item) => sum + (item.bytes ?? 0), 0);
  return { ok: true, view: { labs, bases, totalBytes } };
}

/**
 * Keep this project's installed Windows as the base new labs of its kind start from. Only once
 * Windows has finished installing, only while the lab is stopped (a disk copied mid-write is
 * a corrupt disk), and only when there is no base yet.
 */
export async function proposeSaveBaseAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const { baseVolumeFor, labNameForRun, storageVolumeFor, supportsBase } =
    await import("@/lib/lab/templates");
  const template = templateForProject({ title: project.run.title, detail: project.run.detail });
  if (!template || !supportsBase(template)) {
    return { ok: false, message: "Only Windows labs keep an installed base." };
  }
  const { containerState, volumeExists, windowsInstalled } =
    await import("@/lib/lab/runtime-observer");
  const name = labNameForRun(project.run.id);
  if (await volumeExists(baseVolumeFor(template))) {
    return {
      ok: false,
      message: `There is already a saved ${LAB_TEMPLATES[template].label} base.`,
    };
  }
  if ((await containerState(name))?.running) {
    return {
      ok: false,
      message: "Pause the lab first — a disk copied while Windows writes to it is a broken disk.",
    };
  }
  if (!(await windowsInstalled(storageVolumeFor("fadi-" + name)))) {
    return { ok: false, message: "Windows hasn't finished installing in this lab yet." };
  }
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "lab.saveBase",
    params: { template, name },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval. The copy takes a few minutes." }
    : { ok: false, message: proposal.message };
}

/** Remove a stopped lab and its disk. Irreversible, so the broker asks for its name. */
export async function proposeRemoveLabAction(input: {
  name: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  // Revalidated now, not trusted from the page.
  const current = await labDisksAction();
  const lab = current.view?.labs.find((item) => item.name === input.name);
  if (!lab) return { ok: false, message: "That lab is already gone." };
  if (lab.blocked === "running") return { ok: false, message: "Pause the lab first." };
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "lab.remove",
    params: { name: lab.name, container: lab.container },
    actor: "user",
    origin: "dashboard:machines",
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval." }
    : { ok: false, message: proposal.message };
}
