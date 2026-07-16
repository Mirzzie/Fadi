"use server";

import { createEvidenceRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { publish } from "@/lib/events/bus";
import { extractEvidencePool, normKind, toEvidenceView, type EvidenceView } from "@/lib/evidence/pool";

const PATH = "/dashboard/evidence";

export async function buildEvidencePool(): Promise<
  { ok: true; items: EvidenceView[] } | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const res = await extractEvidencePool(user.id);
  if (!res.ok) return { ok: false, message: res.message };
  await publish("evidence.changed", { userId: user.id, reason: "extracted" });
  revalidatePath(PATH);
  return { ok: true, items: res.items };
}

export async function saveEvidence(input: {
  id?: string;
  kind: string;
  title: string;
  organization?: string;
  period?: string;
  detail?: string;
  metrics?: string;
  tags: string[];
}): Promise<{ ok: true; item: EvidenceView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "Give it a title." };

  const repo = createEvidenceRepository(getDatabase());
  const fields = {
    kind: normKind(input.kind),
    title: input.title.trim(),
    organization: input.organization?.trim() || null,
    period: input.period?.trim() || null,
    detail: (input.detail ?? "").trim(),
    metrics: input.metrics?.trim() || null,
    tags: input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
  };
  const row = input.id
    ? await repo.update(user.id, input.id, fields)
    : await repo.create(user.id, { ...fields, origin: "manual" });
  if (!row) return { ok: false, message: "I can't find that item." };
  await publish("evidence.changed", {
    userId: user.id,
    reason: input.id ? "updated" : "created",
    evidenceItemId: row.id,
  });
  revalidatePath(PATH);
  return { ok: true, item: toEvidenceView(row) };
}

export async function deleteEvidence(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createEvidenceRepository(getDatabase()).delete(user.id, input.id);
  await publish("evidence.changed", {
    userId: user.id,
    reason: "deleted",
    evidenceItemId: input.id,
  });
  revalidatePath(PATH);
  return { ok: true };
}
