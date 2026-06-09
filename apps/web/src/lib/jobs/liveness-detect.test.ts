import { describe, expect, it } from "vitest";

import { detectClosedSignal } from "./liveness-detect";

describe("detectClosedSignal", () => {
  it("treats 404/410 as closed", () => {
    expect(detectClosedSignal(404, "Not Found").state).toBe("closed");
    expect(detectClosedSignal(410, "").state).toBe("closed");
  });

  it("treats a normal live page as live", () => {
    expect(detectClosedSignal(200, "<h1>Senior Designer</h1><p>Apply now!</p>").state).toBe("live");
  });

  it("detects explicit closed-posting language", () => {
    for (const body of [
      "We are no longer accepting applications for this role.",
      "This position has been filled.",
      "This job has expired and is no longer available.",
      "Applications are now closed.",
      "Job not found",
    ]) {
      expect(detectClosedSignal(200, body).state).toBe("closed");
    }
  });

  it("does not cry wolf: bot walls / errors are unknown", () => {
    expect(detectClosedSignal(403, "Access denied").state).toBe("unknown");
    expect(detectClosedSignal(500, "Internal Server Error").state).toBe("unknown");
    expect(detectClosedSignal(429, "Too Many Requests").state).toBe("unknown");
  });

  it("does not false-positive on benign uses of 'close'", () => {
    expect(detectClosedSignal(200, "Our office is close to the station. Apply today!").state).toBe("live");
    expect(detectClosedSignal(200, "The closing date is next month.").state).toBe("live");
  });
});
