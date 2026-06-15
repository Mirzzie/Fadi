/**
 * Fadi's "good to see you" briefing — the spoken, proactive open. Pure on purpose
 * (the dashboard already fetches everything; pass it in) so it stays testable and
 * the honesty rule is enforceable in one place: every line traces to real data, and
 * a section is omitted when there's nothing true to say. A brand-new, empty account
 * gets just a greeting — never a fabricated "here's what's happening".
 */

export type BriefingItem = { label: string; detail: string; href: string };

export type BriefingInput = {
  firstName: string;
  /** Injected for deterministic greetings/tests; defaults to now. */
  now?: Date;
  /** Background-agency findings (digest.findings) — "while you were away". */
  findings?: Array<{ kind: string; title: string; href?: string | null }>;
  topJob?: { title: string; company: string } | null;
  signal?: { title: string; url?: string | null } | null;
  momentum?: {
    cadenceTarget: number | null;
    cadencePeriod: string | null;
    qualityApplicationsThisPeriod: number;
    isResting: boolean;
  } | null;
  learning?: { title: string } | null;
};

export type Briefing = {
  /** Display text (one line per sentence). */
  text: string;
  /** Speech-friendly form for Fadi to read aloud. */
  spoken: string;
  /** Glanceable cards for the briefing UI. */
  items: BriefingItem[];
};

function timeOfDay(now: Date): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function composeBriefing(input: BriefingInput): Briefing {
  const now = input.now ?? new Date();
  const name = input.firstName?.trim() || "there";
  const sentences: string[] = [`Good ${timeOfDay(now)}, ${name}.`];
  const items: BriefingItem[] = [];

  const findings = input.findings ?? [];
  if (findings.length > 0) {
    const lead = findings[0];
    const extra = findings.length > 1 ? ` and ${findings.length - 1} more` : "";
    sentences.push(`While you were away, I found ${lead.title}${extra}.`);
    items.push({
      label: findings.length > 1 ? `While you were away · ${findings.length}` : "While you were away",
      detail: lead.title,
      href: lead.href ?? "/dashboard",
    });
  }

  if (input.topJob) {
    const j = input.topJob;
    sentences.push(`A new role worth a look: ${j.title} at ${j.company}.`);
    items.push({ label: "New role", detail: `${j.title} · ${j.company}`, href: "/dashboard/jobs" });
  }

  if (input.signal) {
    sentences.push(`In your market: ${input.signal.title}.`);
    items.push({ label: "Market signal", detail: input.signal.title, href: "/dashboard" });
  }

  const m = input.momentum;
  if (m) {
    if (m.isResting) {
      sentences.push("You're on a planned rest — protect it; I'll keep watch.");
      items.push({ label: "Resting", detail: "Planned recovery — momentum is protected.", href: "/dashboard" });
    } else if (m.cadenceTarget != null) {
      const remaining = Math.max(0, m.cadenceTarget - m.qualityApplicationsThisPeriod);
      const period = m.cadencePeriod ?? "week";
      if (remaining > 0) {
        sentences.push(
          `Your commitment this ${period}: ${remaining} more quality application${remaining === 1 ? "" : "s"}.`,
        );
        items.push({
          label: "Commitment",
          detail: `${remaining} more quality application${remaining === 1 ? "" : "s"} this ${period}`,
          href: "/dashboard/applications",
        });
      } else {
        sentences.push(`You've hit your ${period}'s commitment — nicely done.`);
      }
    }
  }

  if (input.learning) {
    sentences.push(`To learn next: ${input.learning.title}.`);
    items.push({ label: "Learn next", detail: input.learning.title, href: "/dashboard/learning" });
  }

  // Nothing real beyond the greeting — keep it honest and quiet, but inviting.
  if (sentences.length === 1) {
    sentences.push("Your space is quiet right now. Ask me anything, or tell me what you want to work on.");
  } else {
    sentences.push("Tell me what you want to do — you can even say “start a new direction.”");
  }

  const text = sentences.join(" ");
  return { text, spoken: text, items };
}
