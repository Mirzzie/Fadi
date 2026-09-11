import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * THE PLAN MUST KNOW WHAT MACHINE IT IS FOR.
 *
 * A real plan told the owner to "select the Windows 64-bit .msi" and save it to
 * C:\Users\%USERNAME%\Downloads — on a Linux laptop. Every step was unfollowable. Nothing
 * in the prompt had ever said what OS they were on, so the model filled the gap with the
 * most common answer, confidently.
 *
 * Structural, because the property lives in what is SENT: a behavioural test would need a
 * model, and the failure was that a line was missing from a prompt.
 */
const SRC = readFileSync(join(process.cwd(), "src/lib/lab/plan-run.ts"), "utf8");

describe("the planner is told the operating system", () => {
  it("reads the real platform rather than assuming one", () => {
    // Asserting the phrase merely APPEARS was satisfied by its own explanatory comment —
    // hardcoding `const platform = "linux"` passed. The assignment is the property.
    const code = SRC.split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
    expect(code).toMatch(/const platform\s*=\s*process\.platform/);
  });

  it("puts the OS into the prompt, not just into a variable", () => {
    // The bug would have survived a version that computed this and never sent it.
    const promptAssembly = SRC.slice(SRC.indexOf("`Project: ${input.title}`"));
    expect(promptAssembly.slice(0, 200)).toContain("osLine");
  });

  it("names every platform it might run on, including the unexpected one", () => {
    for (const platform of ["linux", "darwin", "win32"]) {
      expect(SRC, platform).toContain(`"${platform}"`);
    }
    // A platform nobody anticipated must produce an honest sentence rather than falling
    // through to whichever branch happens to be last.
    expect(SRC).toMatch(/reports platform/);
  });

  it("forbids the exact mistake that was made", () => {
    // Naming the failure in the instruction is what stops it recurring: a general "use the
    // right OS" reads as filler, and this model had already ignored the general case.
    expect(SRC).toMatch(/\.msi/);
    expect(SRC).toMatch(/PowerShell/);
  });
});
