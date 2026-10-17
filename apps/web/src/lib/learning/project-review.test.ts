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
    expect(review.summary).toMatch(/Check headers \(verified: HSTS present\)/);
    expect(review.shownCount).toBe(2);
  });

  it("a project finished with only ticks has nothing to show, and says only what happened", () => {
    const review = completionReview(
      "Harden nginx",
      steps.map((s) => ({ ...s, artifact: null, completion: "attested" }))
    );
    expect(review.shownCount).toBe(0);
    expect(review.summary).toBe('Completed practical work for "Harden nginx".');
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
      'Completed practical work for "Harden nginx".\n- Validate config (verified: syntax is ok)'
    );
    expect(review.summary).not.toMatch(/grep/);
  });

  it("does not invent a lab for browser, document or external work", () => {
    const review = completionReview("Write an incident brief", [
      {
        ordinal: 1,
        title: "Submit the brief",
        place: "browser",
        status: "done",
        artifact: "brief.pdf",
        completion: "evidenced",
      },
    ]);
    expect(review.summary).toBe(
      'Completed practical work for "Write an incident brief".\n- Submit the brief: brief.pdf'
    );
    expect(review.summary).not.toMatch(/lab|machine|terminal/i);
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

describe("setup is not the person's work (16 Oct 2026)", () => {
  it("leaves out steps Fadi did, so 'Start Wazuh containers' never reaches a résumé", () => {
    const review = completionReview("SIEM", [
      {
        ordinal: 1,
        title: "Start Wazuh containers",
        place: "fadi",
        status: "done",
        artifact: null,
        completion: "attested",
      },
      {
        ordinal: 2,
        title: "Install the agent",
        place: "lab",
        status: "done",
        artifact: "WazuhSvc Running",
        completion: "verified",
      },
    ]);
    expect(review.lines.map((line) => line.title)).toEqual(["Install the agent"]);
    expect(review.summary).not.toContain("Start Wazuh containers");
  });
});
