"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import {
  addReferralTarget,
  deleteReferralTarget,
  draftOutreachFor,
  markReferralAsked,
  setReferralStatus,
  type AddReferralInput,
  type ReferralStatus,
  type ReferralView,
} from "@/lib/network/referrals";
import type { Relationship } from "@/lib/network/outreach";

const PATH = "/dashboard/network";

export async function addReferral(input: {
  company: string;
  roleTitle?: string;
  contactName?: string;
  contactRole?: string;
  relationship?: Relationship;
  channel?: string;
}): Promise<{ ok: boolean; message: string; referral?: ReferralView }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.company?.trim()) return { ok: false, message: "Add a company first." };

  try {
    const referral = await addReferralTarget(user.id, input as AddReferralInput);
    revalidatePath(PATH);
    return { ok: true, message: "Added.", referral };
  } catch (error) {
    logger.error("network.add_referral_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function draftOutreach(input: {
  id: string;
}): Promise<{ ok: boolean; draft?: string; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const res = await draftOutreachFor(user.id, input.id);
    if (res.ok) revalidatePath(PATH);
    return res;
  } catch (error) {
    logger.error("network.draft_outreach_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't draft the message. Please try again." };
  }
}

export async function markAsked(input: {
  id: string;
  channel?: string;
}): Promise<{ ok: boolean; message: string; momentum?: number; delta?: number }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const res = await markReferralAsked(user.id, input.id, input.channel);
    if (!res.ok) return { ok: false, message: res.message ?? "Couldn't update." };
    revalidatePath(PATH);
    return {
      ok: true,
      message: res.motion?.message ?? "Marked as asked.",
      momentum: res.motion?.momentum,
      delta: res.motion?.delta,
    };
  } catch (error) {
    logger.error("network.mark_asked_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function updateReferralStatus(input: {
  id: string;
  status: ReferralStatus;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const res = await setReferralStatus(user.id, input.id, input.status);
  if (res.ok) revalidatePath(PATH);
  return res;
}

export async function removeReferral(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await deleteReferralTarget(user.id, input.id);
  revalidatePath(PATH);
  return { ok: true };
}
