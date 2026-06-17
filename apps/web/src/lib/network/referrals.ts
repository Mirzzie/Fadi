import "server-only";

import { createReferralsRepository, type ReferralTarget } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { recordForwardMotion, type ForwardMotionOutcome } from "@/lib/resilience/service";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import {
  OUTREACH_SYSTEM,
  buildOutreachContext,
  fallbackOutreach,
  type OutreachInput,
  type Relationship,
} from "./outreach";
import { REFERRAL_STATUSES, type ReferralStatus, type ReferralView } from "./types";

/**
 * Draft a referral message with the user's own AI provider; falls back to a solid
 * template when there's no provider or on any error. Server-only (lives here, not
 * in the client-safe outreach.ts) so the provider chain never reaches the browser.
 */
async function draftReferralOutreach(userId: string, input: OutreachInput): Promise<string> {
  try {
    const generate = await getUserDocGenerate(userId);
    if (!generate) return fallbackOutreach(input);
    const text = (await generate.text(OUTREACH_SYSTEM, buildOutreachContext(input))).trim();
    return text || fallbackOutreach(input);
  } catch {
    return fallbackOutreach(input);
  }
}

export type { ReferralStatus, ReferralView } from "./types";

function repo() {
  return createReferralsRepository(getDatabase());
}

const RELATIONSHIPS: Relationship[] = [
  "alumni",
  "former_colleague",
  "second_degree",
  "friend",
  "recruiter",
  "cold",
];

function normRelationship(v: unknown): Relationship {
  const s = typeof v === "string" ? v : "";
  return (RELATIONSHIPS as string[]).includes(s) ? (s as Relationship) : "cold";
}

function toView(t: ReferralTarget): ReferralView {
  return {
    id: t.id,
    applicationId: t.applicationId,
    company: t.company,
    roleTitle: t.roleTitle,
    contactName: t.contactName,
    contactRole: t.contactRole,
    relationship: normRelationship(t.relationship),
    channel: t.channel,
    status: (REFERRAL_STATUSES as readonly string[]).includes(t.status)
      ? (t.status as ReferralStatus)
      : "identified",
    outreachDraft: t.outreachDraft,
    notes: t.notes,
    askedAt: t.askedAt ? t.askedAt.toISOString() : null,
  };
}

export async function listReferrals(userId: string): Promise<ReferralView[]> {
  const rows = await repo().listForUser(userId);
  return rows.map(toView);
}

export type AddReferralInput = {
  company: string;
  roleTitle?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  relationship?: Relationship;
  channel?: string | null;
  applicationId?: string | null;
  notes?: string | null;
};

export async function addReferralTarget(userId: string, input: AddReferralInput): Promise<ReferralView> {
  const created = await repo().create(userId, {
    company: input.company.trim(),
    roleTitle: input.roleTitle?.trim() || null,
    contactName: input.contactName?.trim() || null,
    contactRole: input.contactRole?.trim() || null,
    relationship: normRelationship(input.relationship),
    channel: input.channel?.trim() || null,
    applicationId: input.applicationId ?? null,
    notes: input.notes?.trim() || null,
    status: "identified",
    outreachDraft: null,
    askedAt: null,
  });
  return toView(created);
}

/** Draft (or redraft) the outreach message for a target and store it. */
export async function draftOutreachFor(
  userId: string,
  id: string,
): Promise<{ ok: boolean; draft?: string; message?: string }> {
  const r = repo();
  const target = await r.getForUser(userId, id);
  if (!target) return { ok: false, message: "I can't find that referral target." };

  const outreachInput: OutreachInput = {
    company: target.company,
    roleTitle: target.roleTitle,
    contactName: target.contactName,
    contactRole: target.contactRole,
    relationship: normRelationship(target.relationship),
  };
  const draft = await draftReferralOutreach(userId, outreachInput);
  await r.update(userId, id, { outreachDraft: draft });
  return { ok: true, draft };
}

export type MarkAskedResult = {
  ok: boolean;
  message?: string;
  motion?: ForwardMotionOutcome;
};

/**
 * Mark that the user actually reached out — the controllable forward-motion that
 * earns `referral_added` (highest-leverage). Awarded only on the FIRST ask so it
 * can't be farmed by re-clicking.
 */
export async function markReferralAsked(
  userId: string,
  id: string,
  channel?: string | null,
): Promise<MarkAskedResult> {
  const r = repo();
  const target = await r.getForUser(userId, id);
  if (!target) return { ok: false, message: "I can't find that referral target." };

  const firstAsk = target.status === "identified";
  await r.update(userId, id, {
    status: "asked",
    askedAt: target.askedAt ?? new Date(),
    channel: channel?.trim() || target.channel,
  });

  if (!firstAsk) return { ok: true };

  const motion = await recordForwardMotion(userId, "referral_added", {
    applicationId: target.applicationId ?? undefined,
    metadata: { company: target.company, relationship: target.relationship },
  });
  return { ok: true, motion };
}

/** Advance the funnel after the ask (responded / referred / declined). */
export async function setReferralStatus(
  userId: string,
  id: string,
  status: ReferralStatus,
): Promise<{ ok: boolean; message?: string }> {
  if (!(REFERRAL_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Unknown status." };
  }
  const updated = await repo().update(userId, id, { status });
  return updated ? { ok: true } : { ok: false, message: "I can't find that referral target." };
}

export async function deleteReferralTarget(userId: string, id: string): Promise<void> {
  await repo().delete(userId, id);
}
