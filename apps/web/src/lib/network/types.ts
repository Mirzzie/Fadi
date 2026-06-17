/**
 * Pure, client-safe types for referrals — kept out of referrals.ts (which is
 * server-only) so client components can import them without dragging the server
 * AI/database chain into the browser bundle.
 */

import type { Relationship } from "./outreach";

export const REFERRAL_STATUSES = [
  "identified",
  "asked",
  "responded",
  "referred",
  "declined",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** Serializable referral row for the client. */
export type ReferralView = {
  id: string;
  applicationId: string | null;
  company: string;
  roleTitle: string | null;
  contactName: string | null;
  contactRole: string | null;
  relationship: Relationship;
  channel: string | null;
  status: ReferralStatus;
  outreachDraft: string | null;
  notes: string | null;
  askedAt: string | null;
};
