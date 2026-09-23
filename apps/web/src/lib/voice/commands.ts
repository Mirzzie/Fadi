import { DESTINATIONS, NAV_TARGETS } from "@/components/os/navigation";

/**
 * What someone said, turned into something Fadi can do — without a model.
 *
 * This exists for the person who cannot look at the screen. That changes the rules:
 *
 * - A wrong guess is not a small cost. Someone watching can see Fadi open the wrong page and
 *   correct it in a second; someone with their eyes shut has to be TOLD, and told accurately.
 *   So this matches deliberately and returns `unknown` rather than its best idea, and an
 *   unknown answer is spoken back as "I didn't catch that" rather than acted on.
 * - Transcripts are dirty. Whisper punctuates, capitalises and sometimes hears "Fadi" as
 *   "Friday", so matching is done on a flattened form.
 * - Anything consequential comes back with `confirm: true`. Eyes-free means the only way to
 *   know what is about to happen is to be asked, out loud, first.
 *
 * A question Fadi cannot answer as a command is still a question, and falls through to `ask`.
 */

export type VoiceCommand =
  | { kind: "navigate"; href: string; label: string }
  | { kind: "read"; what: "today" | "plan" | "next" | "did" }
  | { kind: "advance" }
  | { kind: "stopPlan"; confirm: true }
  | { kind: "startProposal"; confirm: true }
  | { kind: "dismissProposal"; confirm: true }
  | { kind: "apply"; target: string; confirm: true }
  | { kind: "yes" }
  | { kind: "no" }
  | { kind: "repeat" }
  | { kind: "stopTalking" }
  | { kind: "sleep" }
  | { kind: "help" }
  | { kind: "ask"; text: string }
  | { kind: "unknown" };

/** Lower-case, no punctuation, single spaces — what every pattern below is matched against. */
export function flatten(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip the name and any politeness that wraps the actual instruction. */
function core(said: string): string {
  return said
    .replace(/^(hey |ok |okay |hi )?(fadi|friday|faddy|fadhi|body)\b[, ]*/i, "")
    .replace(/\b(please|thanks|thank you)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const YES = /^(yes|yeah|yep|yup|sure|go ahead|do it|please do|confirm|correct|okay|ok)\b/;
const NO = /^(no|nope|cancel|stop that|don t|dont|never mind|nevermind|not now)\b/;

/** "Read me" phrasings, which are how an eyes-free session asks what is on the screen. */
const READ = [
  {
    what: "today" as const,
    re: /\b(what s on today|read today|catch me up|where am i|what s going on|status)\b/,
  },
  { what: "plan" as const, re: /\b(read (me )?(the |my )?plan|what s the plan|where are we)\b/ },
  {
    what: "next" as const,
    re: /\b(what s next|what should i do|what now|my next (step|action))\b/,
  },
  {
    what: "did" as const,
    re: /\b(what (have you|did you) (done|do)|what happened|read receipts)\b/,
  },
];

export function parseVoiceCommand(raw: string): VoiceCommand {
  const said = core(flatten(raw));
  // Punctuation and stray sounds flatten to nothing sayable. Whisper returns "." for a cough.
  if (!/[a-z0-9]/.test(said)) return { kind: "unknown" };

  if (YES.test(said)) return { kind: "yes" };
  if (NO.test(said)) return { kind: "no" };

  if (/\b(say that again|repeat|pardon|come again|what did you say)\b/.test(said)) {
    return { kind: "repeat" };
  }
  if (/\b(be quiet|shush|shut up|stop talking|quiet)\b/.test(said)) return { kind: "stopTalking" };
  if (/\b(stop listening|go to sleep|that s all|we re done|goodbye|bye fadi)\b/.test(said)) {
    return { kind: "sleep" };
  }
  if (/\b(what can you do|help|what can i say|commands)\b/.test(said)) return { kind: "help" };

  // Plan control BEFORE reading, because "do the next step" and "what's next" share a word and
  // only one of them is an instruction. An instruction that gets read out instead of done is
  // the eyes-free version of a button that does nothing.
  if (/\b(do the next|next step|carry on|keep going|continue|go on)\b/.test(said)) {
    return { kind: "advance" };
  }

  for (const entry of READ) {
    if (entry.re.test(said)) return { kind: "read", what: entry.what };
  }
  if (/\b(start it|start that|take it|go ahead with (it|that)|yes start)\b/.test(said)) {
    return { kind: "startProposal", confirm: true };
  }
  if (/\b(not now|skip (it|that)|dismiss|drop (it|that)|don t bother)\b/.test(said)) {
    return { kind: "dismissProposal", confirm: true };
  }
  if (/\b(stop the plan|stop working|abandon|put it down|cancel the plan)\b/.test(said)) {
    return { kind: "stopPlan", confirm: true };
  }

  // Applying. The target is resolved on the server against the person's own board, and the
  // spoken confirmation names what it found before anything starts.
  const apply = /\b(?:apply (?:to|for)|go for|tailor (?:my )?(?:cv|resume) for)\s+(.{2,})$/.exec(
    said
  );
  if (apply) {
    const target = apply[1]!.replace(/^(the|a|that|this)\s+/, "").trim();
    return { kind: "apply", target, confirm: true };
  }

  // Navigation. Matched against the same list the dock and ⌘K use, so voice can reach every
  // area by the name a person sees — and only by a name that exists.
  const go = /\b(?:go to|open|show me|take me to|switch to)\s+(.{2,})$/.exec(said);
  if (go) {
    // Both forms: "my career" IS a destination's name, so stripping "my" before matching lost
    // it and left "career", which then matched "Career report" — a different page entirely.
    const spoken = go[1]!.trim();
    const stripped = spoken
      .replace(/\b(the|page|screen|section|tab)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const target = matchArea(spoken) ?? matchArea(stripped);
    if (target) return { kind: "navigate", href: target.href, label: target.label };
  }

  return { kind: "ask", text: raw.trim() };
}

/**
 * Exact-ish only: a near miss on navigation sends someone who cannot see to the wrong screen.
 *
 * Destinations are matched FIRST and by exact name. "Open my career" is the destination, not a
 * loose match on the word "career" — which otherwise landed on "Career report", a different
 * page under a different destination.
 */
function matchArea(wanted: string): { href: string; label: string } | null {
  if (!wanted) return null;

  for (const destination of DESTINATIONS) {
    if (flatten(destination.label) === wanted) {
      return { href: destination.href, label: destination.label };
    }
  }

  const words = wanted.split(" ").filter(Boolean);
  let best: { href: string; label: string; score: number } | null = null;
  for (const target of NAV_TARGETS) {
    const label = flatten(target.label);
    const within = flatten(target.within);
    let score = 0;
    if (label === wanted) score = 1;
    // Containment only counts when the label is most of what was said. Otherwise "billing
    // settings for my invoices" matched "Settings" on a substring and sent someone there.
    else if (
      (label.includes(wanted) || wanted.includes(label)) &&
      Math.min(label.length, wanted.length) / Math.max(label.length, wanted.length) >= 0.6
    ) {
      score = 0.9;
    } else {
      const hits = words.filter((word) => word.length > 2 && label.includes(word)).length;
      const inWithin = words.filter((word) => word.length > 2 && within.includes(word)).length;
      score = (hits + inWithin * 0.5) / Math.max(words.length, 1);
    }
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { href: target.href, label: target.label, score };
    }
  }
  return best ? { href: best.href, label: best.label } : null;
}

/** What Fadi says when asked what it can do — spoken, so it is short and in pairs. */
export const VOICE_HELP = [
  "You can say: what's on today, what's next, or read me the plan.",
  "To work: apply to a role by name, do the next step, or stop the plan.",
  "To move around: open my career, open opportunities, open practice.",
  "Anything else, just ask me a question. Say 'go to sleep' when you're done.",
].join(" ");
