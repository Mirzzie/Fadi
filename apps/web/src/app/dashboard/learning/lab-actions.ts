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
