/**
 * A FINISHED PROJECT, PACKAGED SO A HIRING MANAGER GETS IT IN TWO MINUTES.
 *
 * A reviewer with fifty CVs open will not read a repo of lab files. They look for the problem,
 * what was built, the decisions behind it, what went wrong and how it was fixed, and the result.
 * Listing steps shows someone followed a tutorial; the decisions and the mistakes show they
 * think like the person being hired. So the finish review asks for both, and everything packaged
 * from the record — the README, the walkthrough outline, the posts — is built from what the
 * person wrote and what the steps recorded. Nothing here invents an architecture, a number or a
 * finding: a section with nothing true to say is left out, never filled with a placeholder.
 *
 * Pure, so every rule about what may appear is pinned by tests.
 */

export type Reflection = { decision: string; wentWrong: string };

const DECISION = "Key decision:";
const WENT_WRONG = "What went wrong, and the fix:";

/** The record as saved: the person's summary, then their decision and their mistake, labelled. */
export function withReflection(summary: string, reflection: Reflection): string {
  return [
    summary.trim(),
    reflection.decision.trim() ? `${DECISION} ${reflection.decision.trim()}` : "",
    reflection.wentWrong.trim() ? `${WENT_WRONG} ${reflection.wentWrong.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Read a saved record back into its parts. A record saved before these existed is all body. */
export function readReflection(detail: string): { body: string } & Reflection {
  const paragraphs = detail.split(/\n{2,}/);
  const take = (label: string) =>
    paragraphs
      .find((p) => p.startsWith(label))
      ?.slice(label.length)
      .trim() ?? "";
  return {
    body: paragraphs
      .filter((p) => !p.startsWith(DECISION) && !p.startsWith(WENT_WRONG))
      .join("\n\n")
      .trim(),
    decision: take(DECISION),
    wentWrong: take(WENT_WRONG),
  };
}

export type CaseStudyInput = {
  title: string;
  kind: "project" | "course";
  /** The problem it answers, as planned — the suggestion's scenario. */
  scenario: string | null;
  /** The saved record's text. */
  detail: string;
  /** Step results backed by more than the person's word. */
  results: Array<{ title: string; proof: "checked" | "result recorded"; result: string | null }>;
  /** Every step, in order — how someone else could reproduce it. */
  steps: string[];
  walkthroughUrl?: string | null;
  repoUrl?: string | null;
};

/** README.md for the project's repository. */
export function caseStudyReadme(input: CaseStudyInput): string {
  const { body, decision, wentWrong } = readReflection(input.detail);
  // A summary that already lists a result need not list it twice.
  const unsaid = input.results.filter((line) => !body.includes(line.title));
  const sections: Array<[string, string]> = [
    ["The problem", input.scenario?.trim() ?? ""],
    ["What I did", body],
    [
      "What it shows",
      unsaid
        .map(
          (line) =>
            `- ${line.title}${line.result ? ` — ${line.result}` : ""}${line.proof === "checked" ? " _(checked)_" : ""}`
        )
        .join("\n"),
    ],
    ["Key decision", decision],
    ["What went wrong, and the fix", wentWrong],
    [
      "Walkthrough",
      input.walkthroughUrl ? `A five-minute walkthrough: ${input.walkthroughUrl}` : "",
    ],
    [
      "Reproduce it",
      input.kind === "project" ? input.steps.map((step, i) => `${i + 1}. ${step}`).join("\n") : "",
    ],
  ];
  return (
    [
      `# ${input.title}`,
      ...sections
        .filter(([, text]) => text.trim())
        .map(([head, text]) => `## ${head}\n\n${text.trim()}`),
    ].join("\n\n") + "\n"
  );
}

/**
 * What to say in a five-minute walkthrough, in order, from the record. Each beat quotes what is
 * true; a beat with nothing behind it is dropped rather than left for the person to invent.
 */
export function walkthroughOutline(input: CaseStudyInput): Array<{ at: string; say: string }> {
  const { body, decision, wentWrong } = readReflection(input.detail);
  const first = (text: string) => text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  const beats = [
    input.scenario ? `The problem: ${first(input.scenario)}` : `What this is: ${input.title}.`,
    body ? `What you built, shown on screen: ${first(body)}` : "",
    input.results[0]
      ? `Prove it works: show "${input.results[0].title}"${input.results[0].result ? ` — ${input.results[0].result}` : ""}.`
      : "",
    decision ? `The decision, and the trade-off: ${decision}` : "",
    wentWrong ? `What went wrong, and how you found and fixed it: ${wentWrong}` : "",
    "What you would do next, and where the repo is.",
  ].filter(Boolean);
  const step = Math.max(1, Math.floor(300 / beats.length));
  return beats.map((say, i) => {
    const s = i * step;
    return { at: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, say };
  });
}

/**
 * One project, several honest posts. Each angle is a different true thing about the same work;
 * an angle whose material is missing (no mistake recorded, no walkthrough) is not offered.
 */
export type PostAngle = "problem" | "build" | "mistake" | "result";

export function availableAngles(detail: string, kind: "project" | "course"): PostAngle[] {
  const { decision, wentWrong } = readReflection(detail);
  if (kind === "course") return ["result"];
  return ["problem", "build", ...(wentWrong || decision ? (["mistake"] as const) : []), "result"];
}

export const ANGLE_LABEL: Record<PostAngle, string> = {
  problem: "The problem",
  build: "What I built",
  mistake: "What went wrong",
  result: "The result",
};

export const ANGLE_BRIEF: Record<PostAngle, string> = {
  problem:
    "Lead with the workplace problem this project answers and why it matters; one line on the approach; end by saying a follow-up post will show how it was built.",
  build:
    "Walk through what was built and the one decision behind it, naming the real tools; say it plainly as work done, not as studying.",
  mistake:
    "Tell the story of what went wrong and how it was found and fixed — the record's own words. This is the most credible post; keep it specific.",
  result:
    "State what was finished and what it demonstrates, with the repo and walkthrough if recorded; one line on what comes next only if the record says so.",
};
