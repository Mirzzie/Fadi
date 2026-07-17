/**
 * Psychological framing for the Resilience Engine — Fadi's voice.
 *
 * Every line here obeys the standing mandate: protect the user's mindset and
 * locus of control. Rules: reward effort the user controls; never shame a dip;
 * never inflate hope or deny difficulty; always leave a concrete next step.
 * This is the honest mentor, not a cheerleader.
 */

import type { CadenceAdherence, ForwardMotionKind, MomentumBand } from "./engine";

/** What Fadi says when momentum sits in a given band. Honest, never hollow. */
export function momentumMessage(band: MomentumBand): string {
  switch (band) {
    case "peak":
      return "You're running a genuinely strong process right now. This is what consistency looks like — protect it, and remember rest is part of it.";
    case "strong":
      return "You've built real momentum. The work you're putting in is the kind that compounds, even before the results show up.";
    case "building":
      return "You're building. Progress in a job search is rarely linear — what matters is that you're doing the things you control well.";
    case "warming":
      return "You're getting going again. Small, consistent moves beat heroic bursts. One good action today is enough.";
    case "dormant":
      return "It's quiet right now — and that's okay, not a verdict on you. When you're ready, there's one small step waiting. No pressure, no catch-up debt.";
  }
}

/** Acknowledgement when a forward-motion action lands. Credits the controllable act. */
export function forwardMotionMessage(kind: ForwardMotionKind): string {
  switch (kind) {
    case "quality_application":
      return "That was a quality, targeted application — the kind that actually moves the odds. That's the work that counts.";
    case "rejection_logged":
      return "Logged. Facing a 'no' honestly takes more than most people manage. Now let's make it useful.";
    case "rejection_autopsy":
      return "This is the move that separates people who break through from people who burn out: you turned a rejection into a lesson. That sharpens every application after it.";
    case "skill_closed":
      return "You closed a real skill gap. That's permanent — it raises your floor for every role you'll ever target.";
    case "referral_added":
      return "A genuine connection activated — your highest-leverage move. A referral is an independent draw: it routes around the same screening software that rejects cold applications in correlated batches, instead of facing the same filter again.";
    case "rest_day":
      return "Rest logged — and your momentum is protected while you recover. Choosing to rest on purpose is discipline, not a lapse.";
    case "comeback":
      return "Welcome back. You stepped away and you returned — that's the muscle that actually wins a long search. We pick up, we don't start over.";
  }
}

/** Cadence feedback — always against the user's OWN commitment, never an imposed quota. */
export function cadenceMessage(adherence: CadenceAdherence): string {
  switch (adherence) {
    case "ahead":
      return "You're ahead of the pace you set for yourself. If you've got more in you, great — but you've already met your commitment.";
    case "on_track":
      return "You're on track with your own plan. Steady is the goal.";
    case "behind":
      return "You're a bit behind the pace you set — no judgement. Want to adjust the plan, or take one small step toward it now?";
    case "resting":
      return "You're in a rest window you chose. Nothing is slipping. Come back when you're ready.";
    case "unset":
      return "You haven't set a cadence yet. A small, sustainable commitment — even one quality application a week — beats an ambitious one you can't keep.";
  }
}

/**
 * The rejection autopsy prompts — what Fadi asks after a "no". The framing turns
 * a loss into information: data that improves the next application.
 */
export const REJECTION_AUTOPSY_PROMPTS: ReadonlyArray<{ key: string; question: string }> = [
  {
    key: "stage",
    question: "How far did it get? (No response, early screen, after an interview, or final round?) This tells us where the real friction is.",
  },
  {
    key: "feedback",
    question: "Did you get any feedback — even one line? If not, that's the norm: 75% of applications get none. We'll infer the pattern from the stage instead.",
  },
  {
    key: "lesson",
    question: "Looking at it honestly: is there one thing about the match, the application, or the timing you'd do differently? (\"Nothing — it was a long shot\" is a completely valid answer.)",
  },
  {
    key: "nextAction",
    question: "What's the one small next move this points to? I can turn it into a concrete step.",
  },
] as const;

/**
 * Honest nudge when self-reported activity looks implausible (anomaly detection).
 * Not an accusation — an invitation to add the real data so Fadi can actually help.
 */
export function anomalyNudge(rejectionsLogged: number, applicationsSent: number): string {
  return `I'm seeing ${rejectionsLogged} rejections but only ${applicationsSent} applications on file. I can't spot a useful pattern without the applications behind them — want to add them? These numbers aren't a score anyone else sees; they only exist so I can read your situation and give you better advice. Inflating them just makes my read worse.`;
}
