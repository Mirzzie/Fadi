import { describe, expect, it } from "vitest";

import { formatMemory } from "./sizes";

describe("memory in words a person reads correctly", () => {
  it("THE BUG: 128MB is not 0GB", () => {
    // A real approval card said "this needs 0GB" for the nginx lab.
    expect(formatMemory(128)).toBe("128MB");
    expect(formatMemory(512)).toBe("512MB");
  });

  it("keeps a decimal where it matters on a laptop", () => {
    expect(formatMemory(1536)).toBe("1.5GB");
    expect(formatMemory(4096)).toBe("4GB");
  });

  it("rounds large amounts to whole gigabytes", () => {
    expect(formatMemory(23437)).toBe("23GB");
  });

  it("never renders a nonsense value", () => {
    expect(formatMemory(0)).toBe("0MB");
    expect(formatMemory(Number.NaN)).toBe("0MB");
  });
});
