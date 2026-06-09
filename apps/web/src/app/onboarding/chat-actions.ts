"use server";

import { z } from "zod";

import { completeOnboardingAction } from "@/app/onboarding/actions";
import { buildProviderChain } from "@/lib/ai/registry";
import { ResilientProvider } from "@/lib/ai/resilient";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { isProviderExhausted, isRateLimited } from "@/lib/ai/providers/errors";
import { experienceLevelOptions, type OnboardingFormValues } from "@/lib/onboarding/validation";
import { logger } from "@/lib/observability/logger";

/**
 * The Kai-led welcome as a REAL AI conversation. Each turn the model both replies
 * to the user AND tracks the structured fields it has gathered so far + whether
 * it's done — so onboarding feels like talking to Kai, not filling a form, while
 * staying reliable enough to actually create the profile + first track.
 *
 * Degrades honestly: a brand-new user has no AI key, so this falls back to the
 * server default; if that's unavailable the action returns { error: "provider" }
 * and the UI drops to the scripted welcome (no AI needed).
 */

export type OnboardingChatMessage = { role: "user" | "assistant"; content: string };

const collectedSchema = z.object({
  fullName: z.string().nullable(),
  targetRole: z.string().nullable(),
  locationPreference: z.string().nullable(),
  experienceLevel: z.string().nullable(),
  careerGoals: z.string().nullable(),
  resumeText: z.string().nullable(),
  linkedInProfile: z.string().nullable(),
});
export type CollectedFields = z.infer<typeof collectedSchema>;

const turnSchema = z.object({
  reply: z.string(),
  collected: collectedSchema,
  complete: z.boolean(),
});

export type OnboardingChatResult =
  | {
      ok: true;
      reply: string;
      collected: CollectedFields;
      done: boolean;
      redirectTo?: string;
    }
  | { ok: false; error: "provider" | "auth"; message: string };

const SYSTEM = `You are Kai, CareerOS's career operating system, welcoming a brand-new user on their first login. Run a warm, BRIEF conversation to set up their first career track.

Collect — conversationally, ONE topic at a time, reacting to each answer before moving on.

REQUIRED to finish (these five — get all of them before completing):
- fullName — what to call them
- targetRole — the role or field they're aiming for (this becomes their first track; help them narrow it if they're unsure)
- locationPreference — a city, country, or "remote"
- experienceLevel — map to exactly one of: entry, mid, senior, lead, executive, career_switcher
- careerGoals — what they actually want from this move (money, stability, growth, a fresh start)

OPTIONAL bonuses (ask once, in passing — NEVER block finishing on them; if they skip or don't have one, move on):
- resumeText — a summary of their experience, skills, and education (a paragraph is fine)
- linkedInProfile — a LinkedIn URL or a couple of lines about their background

Style: warm, sharp, concise (1-3 sentences). Never dump a list of questions. This serves ANY field — finance, healthcare, trades, tech — not just tech.

Every turn, output: reply (your next message), collected (EVERYTHING gathered so far across the whole conversation — keep a field null until you truly have it), and complete. Set complete=true as soon as you have the five REQUIRED fields — do NOT keep the user waiting for the optional bonuses. NEVER invent, assume, or guess a field — only fill it from what the user actually told you. ONLY when complete is true, make reply a short warm closing line telling them you're setting up their Career OS now; until then, NEVER say you're setting things up.`;

function normalizeExperience(value: string | null): OnboardingFormValues["experienceLevel"] {
  const s = (value ?? "").toLowerCase();
  if (/switch|career.?chang|transition|pivot|new to/.test(s)) return "career_switcher";
  if (/exec|c-?level|cxo|chief|director|vp|head of/.test(s)) return "executive";
  if (/lead|principal|staff|manage/.test(s)) return "lead";
  if (/senior|\bsr\b/.test(s)) return "senior";
  if (/entry|junior|\bjr\b|grad|student|intern|fresh|no experience/.test(s)) return "entry";
  if (experienceLevelOptions.includes(s as OnboardingFormValues["experienceLevel"])) {
    return s as OnboardingFormValues["experienceLevel"];
  }
  return "mid";
}

export async function onboardingChatAction(
  history: OnboardingChatMessage[],
): Promise<OnboardingChatResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: "auth", message: "Sign in to continue." };

  const provider = new ResilientProvider(buildProviderChain(await getUserProviderConfigs(user.id)));
  if (!provider.isConfigured) {
    return { ok: false, error: "provider", message: "No AI provider available." };
  }

  const messages = [
    { role: "system" as const, content: SYSTEM },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
  ];

  let turn: z.infer<typeof turnSchema>;
  try {
    turn = await provider.parseStructured(messages, turnSchema, "onboarding_turn", {
      temperature: 0.6,
      userId: user.id,
    });
  } catch (err) {
    // A dead/quota'd provider here means the new user has no working AI — let the
    // UI fall back to the scripted welcome rather than trapping them.
    logger.warn("onboarding.chat.provider_failed", {
      userId: user.id,
      exhausted: isProviderExhausted(err) || isRateLimited(err),
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, error: "provider", message: "Kai's AI is unavailable right now." };
  }

  // Don't depend on the model flipping `complete` — some models never do, which
  // used to strand users in the chat. Once the FIVE essentials are actually
  // gathered, we finish regardless: the model can declare complete, OR we
  // force-complete after enough turns. The userTurns floor still guards against
  // weak models that fabricate everything in the first reply.
  const c = turn.collected;
  const essentialsReady = Boolean(
    c.fullName?.trim() &&
      c.targetRole?.trim() &&
      c.locationPreference?.trim() &&
      c.experienceLevel?.trim() &&
      c.careerGoals?.trim(),
  );
  const userTurns = history.filter((m) => m.role === "user").length;
  const shouldComplete = essentialsReady && (turn.complete || userTurns >= 6);
  if (userTurns < 4 || !shouldComplete) {
    return { ok: true, reply: turn.reply, collected: turn.collected, done: false };
  }

  // Validate + persist via the real onboarding path.
  const values: OnboardingFormValues = {
    fullName: turn.collected.fullName ?? "",
    targetRole: turn.collected.targetRole ?? "",
    locationPreference: turn.collected.locationPreference ?? "",
    experienceLevel: normalizeExperience(turn.collected.experienceLevel),
    careerGoals: turn.collected.careerGoals ?? "",
    resumeText: turn.collected.resumeText ?? "",
    linkedInProfile: turn.collected.linkedInProfile ?? "",
  };

  const saved = await completeOnboardingAction(values);
  if (!saved.ok) {
    // The model jumped the gun (e.g. CV too thin) — keep talking, ask for the gap.
    return {
      ok: true,
      reply: `Almost there — ${saved.message ?? "I need a little more detail."}`,
      collected: turn.collected,
      done: false,
    };
  }

  logger.info("onboarding.chat.completed", { userId: user.id, forced: !turn.complete });
  // If we force-completed, the model's reply is probably still a question —
  // replace it with a proper closing line so the handoff reads right.
  const firstName = (values.fullName.split(/\s+/)[0] ?? "").trim();
  const closing = turn.complete
    ? turn.reply
    : `That's everything I need${firstName ? `, ${firstName}` : ""} — setting up your Career OS now.`;
  return {
    ok: true,
    reply: closing,
    collected: turn.collected,
    done: true,
    redirectTo: saved.redirectTo ?? "/dashboard",
  };
}
