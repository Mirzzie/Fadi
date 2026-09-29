import { describe, expect, it } from "vitest";

import { completionPackage, completionReview } from "./project-review";

const steps = [
  {
    ordinal: 2,
    title: "Configure TLS",
    status: "done",
    artifact: "nginx -t: syntax is ok",
    completion: "evidenced",
  },
  { ordinal: 1, title: "Install nginx", status: "done", artifact: null, completion: "attested" },
  {
    ordinal: 3,
    title: "Check headers",
    status: "done",
    artifact: "HSTS present",
    completion: "verified",
  },
];

describe("what a finished project can honestly say", () => {
  it("labels each step by what it can show, in order", () => {
    const review = completionReview("Harden nginx", steps);
    expect(review.lines.map((l) => [l.ordinal, l.proof])).toEqual([
      [1, "self-reported"],
      [2, "result recorded"],
      [3, "checked"],
    ]);
  });

  it("a ticked step with nothing recorded never becomes an outcome in the summary", () => {
    const review = completionReview("Harden nginx", steps);
    expect(review.summary).not.toMatch(/Install nginx/);
    expect(review.summary).toMatch(/Configure TLS: nginx -t: syntax is ok/);
    expect(review.summary).toMatch(/Check headers \(checked in the lab: HSTS present\)/);
    expect(review.shownCount).toBe(2);
  });

  it("a project finished with only ticks has nothing to show, and says only what happened", () => {
    const review = completionReview(
      "Harden nginx",
      steps.map((s) => ({ ...s, artifact: null, completion: "attested" }))
    );
    expect(review.shownCount).toBe(0);
    expect(review.summary).toBe('Worked through "Harden nginx" in a local lab.');
  });

  it("a check's result shows what was found, not Fadi's command", () => {
    const review = completionReview("Harden nginx", [
      {
        ordinal: 1,
        title: "Validate config",
        status: "done",
        completion: "verified",
        artifact: "Checked in the lab: nginx -t 2>&1 | grep -o 'syntax is ok' → syntax is ok",
      },
    ]);
    expect(review.lines[0].result).toBe("syntax is ok");
    expect(review.summary).toBe(
      'Worked through "Harden nginx" in a local lab.\n- Validate config (checked in the lab: syntax is ok)'
    );
    expect(review.summary).not.toMatch(/grep/);
  });

  it("a typed result is never called an attachment", () => {
    const review = completionReview("Harden nginx", steps);
    expect(JSON.stringify(review)).not.toMatch(/attach/i);
  });
});

describe("what a saved project can become", () => {
  it("offers every proposal once the record is settled", () => {
    expect(
      completionPackage({ recordStatus: "saved", onPortfolio: false, storyAdded: false })
    ).toEqual([
      { key: "record", state: "done" },
      { key: "portfolio", state: "ready" },
      { key: "story", state: "ready" },
      { key: "post", state: "ready" },
    ]);
  });

  it("does not offer again what is already done", () => {
    const items = completionPackage({ recordStatus: "saved", onPortfolio: true, storyAdded: true });
    expect(items.find((i) => i.key === "portfolio")?.state).toBe("done");
    expect(items.find((i) => i.key === "story")?.state).toBe("done");
  });

  it("builds nothing on a record still waiting for the person's decision", () => {
    const items = completionPackage({
      recordStatus: "needs-review",
      onPortfolio: false,
      storyAdded: false,
    });
    expect(items.every((i) => i.state === "waiting")).toBe(true);
  });
});
