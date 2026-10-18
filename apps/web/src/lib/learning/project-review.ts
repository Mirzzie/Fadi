import { completionOf, type CompletableStep } from "@/lib/lab/completion";
import { isFacilitatorPlace } from "@/lib/practice/contract";

/**
 * WHAT A FINISHED PROJECT CAN HONESTLY SAY.
 *
 * The draft a person reviews before saving a project as evidence. Built from what the steps
 * recorded and nothing else — no model call — because this text becomes a résumé line and a
 * post, and every sentence in it has to trace back to something they wrote down or a check that
 * passed. The person edits it; Fadi does not embellish it.
 *
 * Wording follows what each step can show: a typed result is "result recorded", not "artifact
 * attached" (a path in a text box does not prove a file exists), and a step ticked with nothing
 * written is "self-reported" and never appears in the summary as an outcome.
 */

export type ReviewStep = CompletableStep & {
  id?: string;
  ordinal: number;
  title: string;
  /** Legacy delivery place. "fadi" steps were setup — not the person's work. */
  place?: string | null;
};

export type ReviewReceipt = {
  id: string;
  stepId: string | null;
  verdict: string;
  strength: string;
  assessmentKind: string;
  evidence: { seen: string; excerpt?: string };
  observedAt: Date | string;
};

export type ReviewLine = {
  ordinal: number;
  title: string;
  /** How it was established. "reviewed" = Fadi's rubric review: observed, never verified. */
  proof: "checked" | "reviewed" | "result recorded" | "self-reported";
  result: string | null;
  /** The immutable assessment receipt behind a checked line, if there is one. */
  receiptId: string | null;
};

export type CompletionReview = {
  lines: ReviewLine[];
  /** Editable starting text. Only steps with a recorded result or a check contribute outcomes. */
  summary: string;
  /** Steps backed by more than the person's word. Zero means there is nothing to show yet. */
  shownCount: number;
};

export function completionReview(
  title: string,
  steps: ReviewStep[],
  receipts: ReviewReceipt[] = []
): CompletionReview {
  const passedReceipt = newestPassingReceiptByStep(receipts);
  const lines: ReviewLine[] = [...steps]
    // Setup is not learning: "Start Wazuh containers" is not something to claim on a résumé.
    .filter((step) => !isFacilitatorPlace(step.place))
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((step) => {
      const kind = completionOf(step);
      const receipt = step.id ? passedReceipt.get(step.id) : undefined;
      return {
        ordinal: step.ordinal,
        title: step.title,
        proof:
          receipt?.strength === "verified" || (!receipt && kind === "verified")
            ? "checked"
            : receipt?.assessmentKind === "rubric"
              ? "reviewed"
              : kind === "evidenced"
                ? "result recorded"
                : "self-reported",
        // A rubric receipt's one-line account ("3 of 3 criteria met, unaided"), not its criteria list.
        result: receipt
          ? receipt.assessmentKind === "rubric"
            ? receipt.evidence.seen.trim() || null
            : receipt.evidence.excerpt?.trim() || receipt.evidence.seen.trim() || null
          : readableResult(step.artifact),
        receiptId: receipt?.id ?? null,
      };
    });

  const shown = lines.filter((line) => line.proof !== "self-reported");
  const summary = [
    `Completed practical work for "${title}".`,
    ...shown.map((line) =>
      line.proof === "checked"
        ? `- ${line.title} (verified${line.result ? `: ${line.result}` : ""})`
        : line.proof === "reviewed"
          ? `- ${line.title} (reviewed against a rubric${line.result ? `: ${line.result}` : ""})`
          : `- ${line.title}${line.result ? `: ${line.result}` : ""}`
    ),
  ].join("\n");

  return { lines, summary, shownCount: shown.length };
}

function newestPassingReceiptByStep(receipts: ReviewReceipt[]): Map<string, ReviewReceipt> {
  const latest = new Map<string, ReviewReceipt>();
  for (const receipt of receipts) {
    if (!receipt.stepId || receipt.verdict !== "pass") continue;
    const held = latest.get(receipt.stepId);
    if (!held || new Date(receipt.observedAt).getTime() > new Date(held.observedAt).getTime()) {
      latest.set(receipt.stepId, receipt);
    }
  }
  return latest;
}

/**
 * A check's stored result is "Checked in the lab: <Fadi's command> → <what it found>". The command
 * is Fadi's, not the person's — so the review shows what was found, not how Fadi looked.
 */
function readableResult(artifact: string | null | undefined): string | null {
  const text = artifact?.trim();
  if (!text) return null;
  if (text.startsWith("Checked in the lab:") && text.includes(" → ")) {
    return text.slice(text.lastIndexOf(" → ") + 3).trim() || null;
  }
  return text;
}

/**
 * WHAT A SAVED PROJECT CAN BECOME, ON ONE SCREEN.
 *
 * Saving used to end in three exits — open Evidence, go to Interview, draft a post — each
 * a different part of the app the person had to know to visit. The record is now the one
 * fact, and everything else is offered beside it as a proposal they accept or skip here.
 *
 * A record the evidence gate held for review (it may be work already recorded) is not a
 * settled fact yet, so nothing is built on it until the person decides.
 */
export type PackageItem = {
  key: "record" | "portfolio" | "story" | "post";
  state: "done" | "ready" | "waiting";
};

export function completionPackage(input: {
  recordStatus: "saved" | "needs-review";
  onPortfolio: boolean;
  storyAdded: boolean;
}): PackageItem[] {
  if (input.recordStatus === "needs-review") {
    return [
      { key: "record", state: "waiting" },
      { key: "portfolio", state: "waiting" },
      { key: "story", state: "waiting" },
      { key: "post", state: "waiting" },
    ];
  }
  return [
    { key: "record", state: "done" },
    { key: "portfolio", state: input.onPortfolio ? "done" : "ready" },
    { key: "story", state: input.storyAdded ? "done" : "ready" },
    { key: "post", state: "ready" },
  ];
}
