"use server";

import { z } from "zod";

import { createLabResourcesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { placeLab, type Resource } from "@/lib/lab/capability";
import { specForProject } from "@/lib/lab/spec-from-project";

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
  kind: z.enum(["laptop", "server", "hypervisor", "sbc", "microcontroller", "cloud"]),
  arch: z.enum(["x86_64", "arm64", "mcu"]).default("x86_64"),
  memoryMb: z.number().int().positive().max(4_194_304).nullable().optional(),
  diskGb: z.number().int().positive().max(1_000_000).nullable().optional(),
  virtualization: z.enum(["none", "containers", "vms", "nested"]).default("none"),
  alwaysOn: z.boolean().default(false),
  notes: z.string().trim().max(400).optional(),
});

export type LabResourceView = Resource & { notes: string | null };

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
  }));
}

export async function listLabResources(): Promise<{ ok: boolean; resources: LabResourceView[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, resources: [] };
  return { ok: true, resources: await load(user.id) };
}

export async function addLabResource(
  input: z.input<typeof resourceInput>,
): Promise<{ ok: boolean; message?: string; resources?: LabResourceView[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const parsed = resourceInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the details and try again." };

  await createLabResourcesRepository(getDatabase()).create(user.id, {
    ...parsed.data,
    memoryMb: parsed.data.memoryMb ?? null,
    diskGb: parsed.data.diskGb ?? null,
    notes: parsed.data.notes || null,
    // Read-only until a write scope is deliberately granted (ADR 0011).
    scopes: ["read"],
  });
  return { ok: true, resources: await load(user.id) };
}

export async function removeLabResource(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false };
  await createLabResourcesRepository(getDatabase()).remove(user.id, parsed.data);
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
      unverified: unverified.map((u) => ({ id: u.resource.id, label: u.resource.label, checks: u.checks })),
      misses: misses.map((m) => ({ id: m.resource.id, label: m.resource.label, reasons: m.reasons })),
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
};
export type RunView = {
  id: string;
  title: string;
  resourceLabel: string | null;
  status: string;
  steps: StepView[];
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
  const runs = await repo.listForUser(user.id);
  const out: RunView[] = [];
  for (const r of runs.filter((x) => x.status !== "abandoned")) {
    const detail = await repo.getWithSteps(user.id, r.id);
    if (!detail) continue;
    out.push({
      id: r.id,
      title: r.title,
      resourceLabel: r.resourceLabel,
      status: r.status,
      steps: detail.steps.map((s) => ({
        id: s.id,
        ordinal: s.ordinal,
        title: s.title,
        instruction: s.instruction,
        verify: s.verify,
        produces: s.produces,
        status: s.status,
        artifact: s.artifact,
      })),
    });
  }
  return { ok: true, runs: out };
}

export async function completeStepAction(input: {
  stepId: string;
  artifact?: string | null;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const updated = await createProjectRunsRepository(getDatabase()).setStepStatus(user.id, input.stepId, {
    status: "done",
    artifact: input.artifact ?? null,
  });
  return { ok: Boolean(updated) };
}

/* --------------------------------------------------------- detect, never control */

export type DetectedResource = {
  label: string;
  kind: string;
  arch: string | null;
  virtualization: string;
  memoryMb: number | null;
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
    detail: f.detail,
  }));

  return { ok: true, detected, absent: scan.absent, needsGrant: scan.needsGrant };
}
